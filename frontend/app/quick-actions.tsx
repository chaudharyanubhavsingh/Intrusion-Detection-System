"use client";

import { useState } from "react";
import { Lock, RefreshCw, Shield, Siren, Clock, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWebSocket } from "./api/websocket";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useSecurityData } from "./data/security-data";
import emailjs from "emailjs-com";

export function QuickActions({ onClose }: { onClose: () => void }) {
  const [showTimeline, setShowTimeline] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const { sendMessage } = useWebSocket();
  const { isLockedDown } = useSecurityData(); // Use global state

  const handleEmergencyLockdown = () => {
    if (!isLockedDown) {
      console.log("Initiating Emergency Lockdown...");
      sendMessage({
        type: "emergency_lockdown",
        data: { action: "block_all" },
      });
    } else {
      console.log("Removing Emergency Lockdown...");
      sendMessage({
        type: "emergency_lockdown",
        data: { action: "unblock_all" },
      });
    }
  };

  const handleAlertSecurityTeam = () => {
    console.log("Alerting Security Team...");
    
    emailjs.send(
      "service_tegek6q", // Replace with your EmailJS service ID
      "template_ets2mdh", // Replace with your EmailJS template ID
      {
        message: "An emergency has been detected in the system. Immediate action required.",
        to_email: "Anubhavchaudhary674@gmail.com", // Replace with actual recipient email
      },
      "4AKoOjeFwzCfqxTL8" // Replace with your EmailJS user/public key
    ).then(
      (response) => {
        console.log("Security team alerted successfully.", response);
      },
      (error) => {
        console.error("Failed to alert security team:", error);
      }
    );
  };

  const handleRunSystemScan = () => {
    setIsScanning(true);
    console.log("Running System Scan...");
    sendMessage({
      type: "run_system_scan",
      data: { action: "restart_monitoring" },
    });
    setTimeout(() => {
      setIsScanning(false);
      setShowTimeline(true);
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <Card className="w-[500px] bg-gray-900/90 backdrop-blur-sm border-gray-800 rounded-xl shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800/50 pb-4">
          <CardTitle className="text-xl font-semibold text-white">Quick Actions</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className={`flex flex-col items-center gap-3 h-auto p-6 bg-gray-800/50 border-gray-700 rounded-lg shadow-md hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-all duration-300 transform hover:scale-105`}
              onClick={handleEmergencyLockdown}
            >
              <Lock className="h-8 w-8" />
              <span className="text-sm font-medium">
                {isLockedDown ? "Remove Emergency Lockdown" : "Emergency Lockdown"}
              </span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-3 h-auto p-6 bg-gray-800/50 border-gray-700 rounded-lg shadow-md hover:bg-yellow-500/20 hover:border-yellow-500/50 hover:text-yellow-400 transition-all duration-300 transform hover:scale-105"
              onClick={handleAlertSecurityTeam}
            >
              <Siren className="h-8 w-8" />
              <span className="text-sm font-medium">Alert Security Team</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-3 h-auto p-6 bg-gray-800/50 border-gray-700 rounded-lg shadow-md hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-400 transition-all duration-300 transform hover:scale-105"
              onClick={handleRunSystemScan}
              disabled={isScanning}
            >
              {isScanning ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <RefreshCw className="h-8 w-8" />
              )}
              <span className="text-sm font-medium">Run System Scan</span>
            </Button>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-3 h-auto p-6 bg-gray-800/50 border-gray-700 rounded-lg shadow-md hover:bg-purple-500/20 hover:border-purple-500/50 hover:text-purple-400 transition-all duration-300 transform hover:scale-105"
              onClick={() => setShowTimeline(true)}
            >
              <Clock className="h-8 w-8" />
              <span className="text-sm font-medium">Show Timeline</span>
            </Button>
          </div>
          {showTimeline && <SystemTimeline onClose={() => setShowTimeline(false)} />}
        </CardContent>
      </Card>
    </div>
  );
}

function SystemTimeline({ onClose }: { onClose: () => void }) {
  const { alerts, clearAlerts } = useSecurityData();

  const handleClearLogs = () => {
    clearAlerts();
  };

  return (
    <Card
      className="mt-6 w-full bg-gray-900/90 backdrop-blur-sm border-gray-800 rounded-xl shadow-lg"
      style={{ maxHeight: "30vh", overflowY: "auto", scrollbarWidth: "none" }}
    >
      <CardHeader className="flex flex-row items-center justify-between border-b border-gray-800/50 pb-4">
        <CardTitle className="text-xl font-semibold text-white">System Timeline & Alerts</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="max-h-[300px] overflow-y-auto pt-4" style={{ scrollbarWidth: "none" }}>
        {alerts.length > 0 ? (
          [...alerts].reverse().map((item) => (
            <div key={item.id} className="flex items-start gap-4 py-2">
              {item.type === "success" && (
                <div className="mt-1 p-1 rounded-full bg-emerald-400/10">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
              )}
              {item.type === "error" && (
                <div className="mt-1 p-1 rounded-full bg-red-400/10">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                </div>
              )}
              {item.type === "warning" && (
                <div className="mt-1 p-1 rounded-full bg-yellow-400/10">
                  <AlertCircle className="h-4 w-4 text-yellow-400" />
                </div>
              )}
              {item.type === "info" && (
                <div className="mt-1 p-1 rounded-full bg-blue-400/10">
                  <Clock className="h-4 w-4 text-blue-400" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{item.title}</span>
                <span className="text-xs text-gray-400">{item.description}</span>
                <span className="text-xs text-gray-400">{item.time}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400 text-center">No events yet</p>
        )}
      </CardContent>
      <div className="flex justify-end p-4 border-t border-gray-800/50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleClearLogs}
          className="flex items-center gap-2 text-red-400 border-red-400/50 hover:bg-red-500/20 hover:border-red-500/50"
        >
          <Trash2 className="h-4 w-4" />
          Clear Logs
        </Button>
      </div>
    </Card>
  );
}

export { SystemTimeline };