import {
  API_BASE_URL,
  type SecurityStats,
  type Threat,
  type FirewallRule,
} from "../data/security-data";

export const securityApi = {
  async getStats(): Promise<SecurityStats> {
    const response = await fetch(`${API_BASE_URL}/stats`);
    if (!response.ok) throw new Error("Failed to fetch security stats");
    return await response.json();
  },

  async getThreats(limit = 10): Promise<Threat[]> {
    const response = await fetch(`${API_BASE_URL}/api/threats/recent`); // Updated to match main.py
    if (!response.ok) throw new Error("Failed to fetch threats");
    return await response.json();
  },

  async getFirewallRules(): Promise<FirewallRule[]> {
    const response = await fetch(`${API_BASE_URL}/firewall/rules`);
    if (!response.ok) throw new Error("Failed to fetch firewall rules");
    return await response.json();
  },

  async addFirewallRule(rule: Omit<FirewallRule, "id" | "timestamp">): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/firewall/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    if (!response.ok) throw new Error("Failed to add firewall rule");
    return await response.json();
  },

  async deleteFirewallRule(ip: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE_URL}/firewall/rules/${ip}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error("Failed to delete firewall rule");
    return await response.json();
  },

  
  async startScan(scanType: "quick" | "full" | "custom", targetIps?: string[]): Promise<{ scan_id: string }> {
    const response = await fetch(`${API_BASE_URL}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan_type: scanType, target_ips: targetIps }),
    });
    if (!response.ok) throw new Error("Failed to start scan");
    return await response.json();
  },

  async getScanStatus(scanId: string): Promise<ScanResult> {
    const response = await fetch(`${API_BASE_URL}/scan/${scanId}`);
    if (!response.ok) throw new Error("Failed to get scan status");
    return await response.json();
  },
};