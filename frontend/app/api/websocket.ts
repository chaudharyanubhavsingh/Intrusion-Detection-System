"use client";

import { useEffect, useRef, useCallback } from "react";
import { useSecurityData, type SecurityStats, type Threat, type FirewallRule } from "../data/security-data";
import { blockIp, unblockIp } from "../data/security-data";

const WS_BASE_URL = "ws://localhost:8000/ws";
const API_BASE_URL = "http://localhost:8000";
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

export type Alert = {
  id: string;
  type: "error" | "warning" | "success" | "info";
  title: string;
  description: string;
  time: string;
};

export type UseWebSocketReturn = {
  connected: boolean;
  lastMessage: WebSocketMessage | null;
  sendMessage: (message: WebSocketMessage) => void;
  stats: SecurityStats;
  activeThreats: number;
  threats: Threat[];
  firewallRules: FirewallRule[];
  alerts: Alert[];
  blockIp: (ip: string, destinationIp?: string, reason?: string) => Promise<{ success: boolean }>;
  unblockIp: (ip: string) => Promise<{ success: boolean }>;
  startScan: (scanType: "quick" | "full" | "custom", targetIps?: string[]) => void;
  updateSecurityData: (data: Partial<{ connected: boolean; stats: SecurityStats; threats: Threat[]; firewallRules: FirewallRule[]; alerts: Alert[] }>) => void;
};

const initializeWebSocket = (
  updateSecurityData: (data: Partial<{ connected: boolean; stats: SecurityStats; threats: Threat[]; firewallRules: FirewallRule[]; alerts: Alert[] }>) => void
) => {
  if (socketInstance && socketInstance.readyState === WebSocket.OPEN) return socketInstance;
  if (isConnecting) return socketInstance;

  isConnecting = true;
  socketInstance = new WebSocket(`${WS_BASE_URL}/${clientId}`);

  socketInstance.onopen = () => {
    console.log("WebSocket connected");
    const newAlert: Alert = {
      id: `system-online-${Date.now()}`,
      type: "success",
      title: "System Online",
      description: "The system has connected to the WebSocket server.",
      time: new Date().toISOString(),
    };
    const currentAlerts = useSecurityData.getState().alerts;
    updateSecurityData({
      connected: true,
      alerts: [...currentAlerts, newAlert],
    });
    isConnecting = false;
  };

  socketInstance.onmessage = (event) => {
    const message: WebSocketMessage = JSON.parse(event.data);
    console.log("WebSocket message received:", message);
    listeners.forEach(listener => listener(message));
  };

  socketInstance.onclose = () => {
    console.log("WebSocket closed");
    const newAlert: Alert = {
      id: `system-offline-${Date.now()}`,
      type: "warning",
      title: "System Offline",
      description: "The system has disconnected from the WebSocket server.",
      time: new Date().toISOString(),
    };
    const currentAlerts = useSecurityData.getState().alerts;
    updateSecurityData({
      connected: false,
      alerts: [...currentAlerts, newAlert],
    });
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
  const { connected, stats, threats, firewallRules, alerts, updateSecurityData } = useSecurityData();
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
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
      }
      const fetchedThreats: Threat[] = await response.json();
      // Log the timestamps of fetched threats
      console.log("Fetched threats with timestamps:", fetchedThreats.map(t => ({ id: t.id, timestamp: t.timestamp })));
      // Append fetched threats to existing threats without overriding timestamps
      const combinedThreats = [
        ...threats.filter(t => !fetchedThreats.some(ft => ft.id === t.id)), // Keep existing threats not in fetched list
        ...fetchedThreats, // Add fetched threats with backend-provided timestamps
      ];
      updateSecurityData({ threats: combinedThreats });
      console.log("Updated threats:", combinedThreats);
    } catch (error) {
      console.error("Failed to fetch threats:", error);
    }
  }, [updateSecurityData, threats]);

  const startScan = useCallback((scanType: "quick" | "full" | "custom", targetIps?: string[]) => {
    const message: WebSocketMessage = {
      type: "start_scan",
      scan_type: scanType,
      target_ips: targetIps,
    };
    sendMessage(message);
    const newAlert: Alert = {
      id: `scan-${Date.now()}`,
      type: "info",
      title: "System Scan Initiated",
      description: `A ${scanType} scan has started${targetIps ? ` on IPs: ${targetIps.join(", ")}` : ""}.`,
      time: new Date().toISOString(),
    };
    updateSecurityData({
      alerts: [...alerts, newAlert],
    });
  }, [sendMessage, updateSecurityData, alerts]);

  const handleMessage = useCallback((message: WebSocketMessage) => {
    lastMessageRef.current = message;
    switch (message.type) {
      case "initial_data":
        console.log("Received initial data:", message.data);
        updateSecurityData({
          stats: message.data.stats,
          threats: message.data.threats,
          firewallRules: message.data.firewall_rules,
        });
        break;
      case "threat_update":
        console.log("Received threat update:", message.data);
        const newThreat = message.data.threat;
        // Log the timestamp of the new threat
        console.log("New threat timestamp:", newThreat.timestamp);
        const updatedThreats = threats.filter(t => t.id !== newThreat.id).concat(newThreat);
        const newThreatAlert: Alert = {
          id: newThreat.id,
          type: newThreat.severity === "high" ? "error" : newThreat.severity === "medium" ? "warning" : "success",
          title: `New Threat: ${newThreat.type}`,
          description: `${newThreat.source} - ${newThreat.details || "No details available"}`,
          time: new Date(newThreat.timestamp).toISOString(),
        };
        updateSecurityData({
          stats: message.data.stats,
          threats: updatedThreats,
          alerts: [...alerts, newThreatAlert],
        });
        break;
      case "firewall_update":
        if (message.data.action === "block") {
          const updatedThreats = threats.map(t =>
            t.source === message.data.ip ? { ...t, status: "blocked" } : t
          );
          const blockAlert: Alert = {
            id: `rule-${Date.now()}`,
            type: "success",
            title: "IP Blocked",
            description: `${message.data.ip} blocked - ${message.data.reason || "No reason provided"}`,
            time: new Date().toISOString(),
          };
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
            alerts: [...alerts, blockAlert],
          });
        } else if (message.data.action === "unblock") {
          const updatedRules = firewallRules.filter(r => r.source_ip !== message.data.ip);
          const updatedThreats = message.data.threat
            ? threats.map(t => t.source === message.data.ip ? { ...t, status: "detected" } : t)
            : threats;
          const unblockAlert: Alert = {
            id: `unblock-${Date.now()}`,
            type: "success",
            title: "IP Unblocked",
            description: `${message.data.ip} unblocked`,
            time: new Date().toISOString(),
          };
          updateSecurityData({
            stats: message.data.stats,
            threats: updatedThreats,
            firewallRules: updatedRules,
            alerts: [...alerts, unblockAlert],
          });
        }
        // Ensure trafficHistory is updated if new stats are provided
        if (message.data.stats?.network_traffic || message.data.stats?.rawNetworkTraffic) {
          const newRawTraffic = message.data.stats.rawNetworkTraffic || parseFloat(message.data.stats.network_traffic) || 0;
          const newEntry = { timestamp: new Date().toISOString(), value: newRawTraffic };
          console.log("Adding to trafficHistory from firewall_update:", newEntry);
          updateSecurityData({
            trafficHistory: [...useSecurityData.getState().trafficHistory, newEntry],
          });
        }
        break;
      case "stats_update":
        console.log("Stats update received:", message.data);
        updateSecurityData({
          stats: message.data,
        });
        break;
      case "heartbeat":
        sendMessage({ type: "pong" });
        break;
      case "scan_update":
        const scanAlert: Alert = {
          id: `scan-update-${Date.now()}`,
          type: message.data.status === "completed" ? "success" : "info",
          title: `Scan ${message.data.status}`,
          description: `Scan ${message.data.scan_id} ${message.data.status}${message.data.results ? `: ${message.data.results}` : ""}`,
          time: new Date().toISOString(),
        };
        updateSecurityData({
          alerts: [...alerts, scanAlert],
        });
        break;
    }
  }, [threats, firewallRules, alerts, stats, updateSecurityData, sendMessage]);

  useEffect(() => {
    console.log("Initializing WebSocket on mount");
    initializeWebSocket(updateSecurityData);
    listeners.add(handleMessage);

    const pollingInterval = setInterval(() => {
      fetchRecentThreats();
    }, 15000);

    return () => {
      console.log("Cleaning up WebSocket");
      listeners.delete(handleMessage);
      clearInterval(pollingInterval);
    };
  }, [fetchRecentThreats, handleMessage, updateSecurityData]);

  return {
    connected,
    lastMessage: lastMessageRef.current,
    sendMessage,
    stats,
    activeThreats: threats.filter(t => t.status === "detected").length,
    threats,
    firewallRules,
    alerts,
    blockIp,
    unblockIp,
    startScan,
    updateSecurityData,
  };
};