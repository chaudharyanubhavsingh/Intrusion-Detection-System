"use client";

import { useEffect, useRef, useCallback } from "react";
import { WS_BASE_URL, useSecurityData, type SecurityStats, type Threat, type FirewallRule, MOCK_THREATS } from "../data/security-data";
import { blockIp, unblockIp } from "../data/security-data";

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
  blockIp: (ip: string, reason?: string) => Promise<{ success: boolean }>;
  unblockIp: (ip: string) => Promise<{ success: boolean }>;
  startScan: (scanType: "quick" | "full" | "custom", targetIps?: string[]) => void;
  updateSecurityData: (data: Partial<{ connected: boolean; stats: SecurityStats; threats: Threat[]; firewallRules: FirewallRule[] }>) => void;
};

export const useWebSocket = (): UseWebSocketReturn => {
  const { connected, stats, threats, firewallRules, updateSecurityData } = useSecurityData();
  const socketRef = useRef<WebSocket | null>(null);
  const lastMessageRef = useRef<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000;
  const API_BASE_URL = "http://192.168.1.4:8000";

  const activeThreats = threats.filter((t) => t.status === "detected").length;

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
      console.log("WebSocket message sent:", message);
    } else {
      console.error("WebSocket not connected, message not sent:", message);
    }
  }, []);

  const fetchRecentThreats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/threats/recent`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const newThreats: Threat[] = await response.json();
      console.log("Fetched recent threats:", newThreats);
      if (newThreats.length > 0) {
        updateSecurityData({
          threats: [...threats, ...newThreats.filter(nt => !threats.some(pt => pt.id === nt.id))],
        });
      }
    } catch (error) {
      console.error("Failed to fetch recent threats:", error);
    }
  }, [updateSecurityData, threats]);

  const connectWebSocket = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    console.log("Attempting WebSocket connection to:", WS_BASE_URL);
    const socket = new WebSocket(WS_BASE_URL);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connected successfully");
      updateSecurityData({ connected: true });
      reconnectAttemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      const message: WebSocketMessage = JSON.parse(event.data);
      lastMessageRef.current = message;
      console.log("WebSocket message received:", message);

      switch (message.type) {
        case "initial_data":
          console.log("Processing initial data:", message.data);
          updateSecurityData({
            stats: message.data.stats,
            threats: message.data.threats || [],
            firewallRules: message.data.firewall_rules || [],
          });
          break;
        case "active_threats":
          console.log("Processing active threats:", message.data.threats);
          updateSecurityData({
            threats: [...threats, ...(message.data.threats || []).filter(
              (nt: Threat) => !threats.some((pt: Threat) => pt.id === nt.id)
            )],
          });
          break;
        case "firewall_update":
          console.log("Processing firewall update:", message.data);
          if (message.data.action === "block") {
            updateSecurityData({
              threats: threats.filter((t) => t.source !== message.data.ip),
              firewallRules: [...firewallRules, {
                id: `rule-${Date.now()}`,
                source_ip: message.data.ip,
                destination_ip: null,
                port: null,
                protocol: null,
                action: "block",
                reason: message.data.reason,
                timestamp: new Date().toISOString(),
              }],
            });
          } else if (message.data.action === "unblock") {
            updateSecurityData({
              firewallRules: firewallRules.filter((r) => r.source_ip !== message.data.ip),
              threats: [...threats, {
                id: `threat-${Date.now()}`,
                source: message.data.ip,
                destination: "Unknown",
                type: "Previously Blocked",
                severity: "medium",
                status: "detected",
                timestamp: new Date().toISOString(),
              }],
            });
          }
          break;
        case "ping":
          console.log("Received ping from server");
          break;
        default:
          console.warn("Unknown message type:", message.type);
      }
    };

    socket.onclose = (event) => {
      console.log("WebSocket closed. Code:", event.code, "Reason:", event.reason);
      updateSecurityData({ connected: false });
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`Reconnecting (${reconnectAttemptsRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})...`);
          reconnectAttemptsRef.current += 1;
          connectWebSocket();
        }, RECONNECT_DELAY);
      } else {
        console.error("Max reconnect attempts reached. Using mock data as fallback.");
        updateSecurityData({ threats: MOCK_THREATS });
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }, [updateSecurityData, threats, firewallRules]);

  useEffect(() => {
    connectWebSocket();

    const intervalId = setInterval(() => {
      console.log("Polling for recent threats...");
      fetchRecentThreats();
    }, 5000);

    return () => {
      clearInterval(intervalId);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
        socketRef.current = null;
      }
    };
  }, [connectWebSocket, fetchRecentThreats]);

  return {
    connected,
    lastMessage: lastMessageRef.current,
    sendMessage,
    stats,
    activeThreats,
    threats,
    firewallRules,
    alerts: [],
    blockIp,
    unblockIp,
    updateSecurityData,
    startScan: () => console.log("Scans removed for live monitoring"),
  };
};