"use client";

import { useEffect } from "react";
import { create } from "zustand";

export interface Threat {
  id: string;
  source: string;
  destination: string;
  type: string;
  severity: "low" | "medium" | "high";
  status: "detected" | "blocked";
  timestamp: string;
  details?: string;
}

export interface FirewallRule {
  id: string;
  source_ip: string;
  destination_ip?: string | null;
  port?: number | null;
  protocol?: string | null;
  action: "allow" | "block";
  reason?: string;
  timestamp: string;
}

export interface SecurityStats {
  total_threats: number;
  blocked_attacks: number;
  network_traffic: string;
  active_users: number;
}

export interface SystemHealth {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_usage: number;
}

export interface NavigationItem {
  name: string;
  href: string;
  icon: string;
  color: string;
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://192.168.1.4:8000";
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://192.168.1.4:8000/ws";

interface SecurityState {
  connected: boolean;
  stats: SecurityStats;
  threats: Threat[];
  firewallRules: FirewallRule[];
  systemHealth: SystemHealth;
  updateSecurityData: (data: Partial<SecurityState>) => void;
}

export const useSecurityData = create<SecurityState>((set) => ({
  connected: false,
  stats: {
    total_threats: 0,
    blocked_attacks: 0,
    network_traffic: "0 MB",
    active_users: 0,
  },
  threats: [],
  firewallRules: [],
  systemHealth: {
    cpu_usage: 0,
    memory_usage: 0,
    disk_usage: 0,
    network_usage: 0,
  },
  updateSecurityData: (data) => set((state) => {
    const newState = {
      ...state,
      ...data,
      stats: data.stats ? { ...state.stats, ...data.stats } : state.stats,
      threats: data.threats || state.threats,
      firewallRules: data.firewallRules || state.firewallRules,
      systemHealth: data.systemHealth ? { ...state.systemHealth, ...data.systemHealth } : state.systemHealth,
    };
    console.log("Security data updated:", newState);
    return newState;
  }),
}));

export async function blockIp(ip: string, destinationIp?: string, reason?: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/firewall/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_ip: ip, destination_ip: destinationIp, action: "block", reason }),
    });
    if (!response.ok) throw new Error(`Failed to block IP: ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.error("Error blocking IP:", error);
    return { success: false };
  }
}

export async function unblockIp(ip: string): Promise<{ success: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/firewall/rules/${encodeURIComponent(ip)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Failed to unblock IP: ${response.statusText}`);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error unblocking IP:", error);
    return { success: false };
  }
}
// Removed unused code for brevity

// Remove startScan if not implemented in backend
// export async function startScan(scanType: "quick" | "full" | "custom", targetIps?: string[]): Promise<{ scan_id: string }> {
//   try {
//     const response = await fetch(`${API_BASE_URL}/scan`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ scan_type: scanType, target_ips: targetIps }),
//     });
//     if (!response.ok) throw new Error(`Failed to start scan: ${response.statusText}`);
//     return await response.json();
//   } catch (error) {
//     console.error("Error starting scan:", error);
//     return { scan_id: "" };
//   }
// }

// Static Mock Data (optional, only for development)
export const MOCK_THREATS: Threat[] = [
  {
    id: "1",
    source: "192.168.1.100",
    destination: "10.0.0.5",
    type: "SQL Injection",
    severity: "high",
    status: "blocked",
    timestamp: "2024-02-20T10:30:45Z",
  },
  {
    id: "2",
    source: "172.16.0.23",
    destination: "10.0.0.8",
    type: "Brute Force",
    severity: "medium",
    status: "detected",
    timestamp: "2024-02-20T10:28:30Z",
  },
];

export const MOCK_STATS: SecurityStats = {
  total_threats: 2,
  blocked_attacks: 1,
  network_traffic: "1.2 TB",
  active_users: 573,
};

export const MOCK_SYSTEM_HEALTH: SystemHealth = {
  cpu_usage: 45,
  memory_usage: 72,
  disk_usage: 28,
  network_usage: 64,
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { name: "Overview", href: "/", icon: "Home", color: "text-blue-400" },
  { name: "Threats", href: "/", icon: "Shield", color: "text-purple-400" },
  { name: "Network", href: "/", icon: "Globe", color: "text-emerald-400" },
  { name: "Analytics", href: "/", icon: "BarChart3", color: "text-pink-400" },
  { name: "Activity", href: "/", icon: "Activity", color: "text-orange-400" },
  { name: "Access", href: "/", icon: "Lock", color: "text-cyan-400" },
  { name: "Users", href: "/", icon: "Users", color: "text-violet-400" },
  { name: "Settings", href: "/", icon: "Settings", color: "text-amber-400" },
];

export const DOTS = [
  { x: 150, y: 100, color: "#3b82f6" },
  { x: 450, y: 150, color: "#a855f7" },
  { x: 350, y: 200, color: "#ec4899" },
  { x: 550, y: 180, color: "#10b981" },
  { x: 650, y: 250, color: "#6366f1" },
  { x: 250, y: 280, color: "#f97316" },
];

export const markers = [
  { x: 1, y: 2, z: 4 },
  { x: -3, y: 1, z: -2 },
  { x: 2, y: -2, z: 3 },
  { x: 1, y: 2, z: 3 },
];