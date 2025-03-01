"use client"

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const threats = [
  {
    id: "1",
    source: "192.168.1.100",
    destination: "10.0.0.5",
    type: "SQL Injection",
    severity: "high",
    status: "blocked",
    timestamp: "2024-02-20 10:30:45",
  },
  {
    id: "2",
    source: "172.16.0.23",
    destination: "10.0.0.8",
    type: "Brute Force",
    severity: "medium",
    status: "detected",
    timestamp: "2024-02-20 10:28:30",
  },
  {
    id: "3",
    source: "192.168.1.150",
    destination: "10.0.0.12",
    type: "XSS Attack",
    severity: "high",
    status: "blocked",
    timestamp: "2024-02-20 10:25:15",
  },
  {
    id: "4",
    source: "172.16.0.45",
    destination: "10.0.0.3",
    type: "Port Scan",
    severity: "low",
    status: "detected",
    timestamp: "2024-02-20 10:20:00",
  },
]

export function ThreatTable() {
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {threats.map((threat) => (
          <TableRow key={threat.id}>
            <TableCell className="font-mono">{threat.timestamp}</TableCell>
            <TableCell className="font-mono">{threat.source}</TableCell>
            <TableCell className="font-mono">{threat.destination}</TableCell>
            <TableCell>{threat.type}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {threat.severity === "high" && <AlertCircle className="h-4 w-4 text-red-500" />}
                {threat.severity === "medium" && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                {threat.severity === "low" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {threat.severity}
              </div>
            </TableCell>
            <TableCell>
              <div
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  threat.status === "blocked" ? "bg-red-500/10 text-red-500" : "bg-yellow-500/10 text-yellow-500"
                }`}
              >
                {threat.status}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

