"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Shield, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { useWebSocket } from "./api/websocket";
import { Threat, FirewallRule } from "./data/security-data";

interface ThreatTableProps {
  threats?: Threat[];
}

interface CombinedEntry {
  id: string;
  source: string;
  destination: string;
  type: string;
  severity: "low" | "medium" | "high";
  status: "detected" | "blocked";
  timestamp: string;
  isRule?: boolean;
}

export function ThreatTable({ threats: initialThreats = [] }: ThreatTableProps) {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { threats, firewallRules, blockIp, unblockIp, stats } = useWebSocket();

  console.log("Threats:", threats, "Firewall Rules:", firewallRules, "Stats:", stats);

  const blockedIps = new Set(firewallRules.map((rule) => rule.source_ip));
  const activeThreats = threats
    .filter((threat) => !blockedIps.has(threat.source))
    .map((threat) => ({ ...threat, isRule: false }));
  const firewallEntries = firewallRules.map((rule) => ({
    id: rule.id,
    source: rule.source_ip,
    destination: rule.destination_ip || "N/A",
    type: "Firewall Rule",
    severity: "medium" as const,
    status: "blocked" as const,
    timestamp: rule.timestamp,
    isRule: true,
  }));

  const combinedEntries = [
    ...activeThreats.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    ...firewallEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
  ];

  const handleBlock = async (ip: string, destination: string, id: string) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await blockIp(ip, destination, "Manually blocked from dashboard");
      if (!result.success) throw new Error("Failed to block IP");
    } catch (error) {
      console.error("Error blocking IP:", error);
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleUnblock = async (ip: string, id: string) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await unblockIp(ip);
      if (!result.success) throw new Error("Failed to unblock IP");
    } catch (error) {
      console.error("Error unblocking IP:", error);
    } finally {
      setLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Timestamp</TableHead>
          <TableHead>Source IP</TableHead>
          <TableHead>Destination IP</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {combinedEntries.length > 0 ? (
          combinedEntries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-mono">{entry.timestamp}</TableCell>
              <TableCell className="font-mono">{entry.source}</TableCell>
              <TableCell className="font-mono">{entry.destination}</TableCell>
              <TableCell>{entry.type}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {entry.severity === "high" && <AlertCircle className="h-4 w-4 text-red-500" />}
                  {entry.severity === "medium" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                  {entry.severity === "low" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {entry.severity}
                </div>
              </TableCell>
              <TableCell>
                <div
                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                    entry.status === "blocked" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                  }`}
                >
                  {entry.status}
                </div>
              </TableCell>
              <TableCell>
                {entry.status === "detected" && !entry.isRule ? (
                  <Button
                    style={{ backgroundColor: "#402857" }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 h-7 text-xs text-rose-400"
                    onClick={() => handleBlock(entry.source, entry.destination, entry.id)}
                    disabled={loading[entry.id]}
                  >
                    <Shield className="h-3 w-3" />
                    {loading[entry.id] ? "Blocking..." : "Block"}
                  </Button>
                ) : entry.status === "blocked" ? (
                  <Button
                    style={{ backgroundColor: "#274857" }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 h-7 text-xs text-green-400"
                    onClick={() => handleUnblock(entry.source, entry.id)}
                    disabled={loading[entry.id]}
                  >
                    <Unlock className="h-3 w-3" />
                    {loading[entry.id] ? "Unblocking..." : "Accept"}
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={7} className="text-center">
              No threats or rules detected yet
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}