"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSecurityData, type SecurityStats, type Threat, type FirewallRule } from "../data/security-data";
import { blockIp, unblockIp } from "../data/security-data";

const WS_BASE_URL = "ws://192.168.1.4:8000/ws";
const API_BASE_URL = "http://192.168.1.4:8000";
const clientId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
let socketInstance: WebSocket | null = null;
let listeners: Set<(message: WebSocketMessage) => void> = new Set();
let isConnecting = false;

export type WebSocketMessage = {
  type: string;
  data?: any;
  command?: string;
  ip?: string;
  reason?: string;
  scan_type?: "quick" | "full" | "custom";
  target_ips?: string[];
};

export type UseWebSocketReturn = {
  connected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  stats: SecurityStats;
  activeThreats: number;
  threats: Threat[];
  firewallRules: FirewallRule[];
  alerts: any[];
  blockIp: (ip: string, destinationIp?: string, reason?: string) => Promise<{ success: boolean }>;
  unblockIp: (ip: string) => Promise<{ success: boolean }>;
  startScan: (scanType: "quick" | "full" | "custom", targetIps?: string[]) => void;
  updateSecurityData: (data: Partial<{ connected: boolean; stats: SecurityStats; threats: Threat[]; firewallRules: FirewallRule[] }>) => void;
};

const initializeWebSocket = (updateSecurityData: (data: Partial<{ connected: boolean; stats: SecurityStats; threats: Threat[]; firewallRules: FirewallRule[] }>) => void) => {
  if (socketInstance && socketInstance.readyState === WebSocket.OPEN) return socketInstance;
  if (isConnecting) return socketInstance;

  isConnecting = true;
  socketInstance = new WebSocket(`${WS_BASE_URL}/${clientId}`);

  socketInstance.onopen = () => {
    console.log("WebSocket connected");
    updateSecurityData({ connected: true });
    isConnecting = false;
  };

  socketInstance.onmessage = (event) => {
    const message: WebSocketMessage = JSON.parse(event.data);
    listeners.forEach(listener => listener(message));
  };

  socketInstance.onclose = () => {
    console.log("WebSocket closed");
    updateSecurityData({ connected: false });
    socketInstance = null;
    isConnecting = false;
    setTimeout(() => initializeWebSocket(updateSecurityData), 2000);
  };

  socketInstance.onerror = (error) => {
    console.error("WebSocket error:", error);
    socketInstance?.close();
  };

  return socketInstance;
};

export const useWebSocket = (): UseWebSocketReturn => {
  const { connected, stats, threats, firewallRules, updateSecurityData } = useSecurityData();
  const lastMessageRef = useRef<WebSocketMessage | null>(null);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketInstance?.readyState === WebSocket.OPEN) {
      socketInstance.send(JSON.stringify(message));
      console.log("Sent:", message);
    } else {
      console.warn("WebSocket not connected:", message);
    }
  }, []);

  const fetchRecentThreats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/threats/recent`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies if needed
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
      }
      const newThreats: Threat[] = await response.json();
      updateSecurityData({ threats: newThreats });
      console.log("Fetched recent threats:", newThreats);
    } catch (error) {
      console.error("Failed to fetch threats:", error);
    }
  }, [updateSecurityData]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    lastMessageRef.current = message;
    switch (message.type) {
      case "initial_data":
        updateSecurityData({
          stats: message.data.stats,
          threats: message.data.threats,
          firewallRules: message.data.firewall_rules,
        });
        break;
      case "threat_update":
        const newThreat = message.data.threat;
        const updatedThreats = threats.filter(t => t.id !== newThreat.id).concat(newThreat);
        updateSecurityData({
          stats: message.data.stats,
          threats: updatedThreats,
        });
        break;
      case "firewall_update":
        if (message.data.action === "block") {
          const updatedThreats = threats.map(t =>
            t.source === message.data.ip ? { ...t, status: "blocked" } : t
          ).filter(t => t.status !== "blocked");
          updateSecurityData({
            stats: message.data.stats,
            threats: updatedThreats,
            firewallRules: [...firewallRules, {
              id: `rule-${Date.now()}`,
              source_ip: message.data.ip,
              destination_ip: message.data.destination_ip || null,
              port: null,
              protocol: null,
              action: "block",
              reason: message.data.reason,
              timestamp: new Date().toISOString(),
            }],
          });
        } else if (message.data.action === "unblock") {
          const updatedRules = firewallRules.filter(r => r.source_ip !== message.data.ip);
          const updatedThreats = message.data.threat
            ? threats.filter(t => t.id !== message.data.threat.id).concat({ ...message.data.threat, status: "detected" })
            : threats;
          updateSecurityData({
            stats: message.data.stats,
            threats: updatedThreats,
            firewallRules: updatedRules,
          });
        }
        break;
      case "heartbeat":
        sendMessage({ type: "pong" });
        break;
    }
  }, [threats, firewallRules, updateSecurityData, sendMessage]);

  useEffect(() => {
    initializeWebSocket(updateSecurityData);
    listeners.add(handleMessage);

    const pollingInterval = setInterval(fetchRecentThreats, 15000);

    return () => {
      listeners.delete(handleMessage);
      clearInterval(pollingInterval);
    };
  }, [fetchRecentThreats, handleMessage]);

  return {
    connected,
    lastMessage: lastMessageRef.current,
    sendMessage,
    stats,
    activeThreats: threats.filter(t => t.status === "detected").length,
    threats,
    firewallRules,
    alerts: [],
    blockIp,
    unblockIp,
    updateSecurityData,
    startScan: () => console.log("Scans not implemented"),
  };
};