"use client";

import { useEffect, useState, useMemo } from "react";
import { Activity, Bell, Lock, Settings, Shield, Users } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart } from "@/components/ui/chart";
import { ActionMenu } from "./action-menu";
import { QuickActions } from "./quick-actions";
import { Alerts } from "./alerts";
import { CircularProgress } from "./circular-progress";
import { LiveStatus } from "./live-status";
import { ParticleBackground } from "./particle-background";
import { SideNav } from "./side-nav";
import { ThreatGlobe } from "./threat-globe";
import { ThreatMap } from "./threat-map";
import { ThreatTable } from "./threat-table";
import { useSecurityData, type Threat, type TrafficEntry } from "./data/security-data";
import { useWebSocket } from "./api/websocket";

// Function to group threats by time intervals, separating blocked and detected
const groupThreatsBySessionTime = (threats: Threat[], intervalMinutes: number = 5, maxIntervals: number = 12) => {
  console.log("Threats received:", threats);

  const now = new Date();
  const windowDurationMs = maxIntervals * intervalMinutes * 60 * 1000;
  const startTime = new Date(now.getTime() - windowDurationMs);

  console.log("Now:", now.toISOString());
  console.log("Start time:", startTime.toISOString());

  const labels: string[] = [];
  const blockedData: number[] = [];
  const detectedData: number[] = [];

  for (let i = 0; i < maxIntervals; i++) {
    const startMin = i * intervalMinutes;
    const label = `${startMin}`;
    labels.push(label);
    blockedData.push(0);
    detectedData.push(0);
  }

  const sortedThreats = [...threats].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  sortedThreats.forEach((threat) => {
    const threatTime = new Date(threat.timestamp);
    const timeSinceStartMs = threatTime.getTime() - startTime.getTime();
    const intervalIndex = Math.floor(timeSinceStartMs / (intervalMinutes * 60 * 1000));

    console.log(`Threat ${threat.id}: timestamp=${threat.timestamp}, timeSinceStartMs=${timeSinceStartMs}, intervalIndex=${intervalIndex}`);

    if (intervalIndex >= 0 && intervalIndex < maxIntervals) {
      if (threat.status === "blocked") {
        blockedData[intervalIndex] += 1;
        console.log(`Incremented blockedData at interval ${intervalIndex}: ${blockedData[intervalIndex]}`);
      } else if (threat.status === "detected") {
        detectedData[intervalIndex] += 1;
        console.log(`Incremented detectedData at interval ${intervalIndex}: ${detectedData[intervalIndex]}`);
      }
    } else {
      console.log(`Threat ${threat.id} out of bounds: intervalIndex=${intervalIndex}`);
    }
  });
  const reversedLabels = labels.map((_, index) => `${(maxIntervals - 1 - index) * intervalMinutes}`);
  console.log("Processed labels (before):", labels);
  console.log("Processed blockedData (before):", blockedData);
  console.log("Processed detectedData (before):", detectedData);

  const result = {
    labels: reversedLabels,
    datasets: [
      { name: "Blocked Threats", data: blockedData, color: "red" },
      { name: "Detected Threats", data: detectedData, color: "orange" },
    ],
  };

  console.log("Threat trend data:", result);
  return result;
};

// Function to process traffic history and calculate total throughput
const processTrafficHistory = (trafficHistory: TrafficEntry[], intervalMinutes: number = 5, maxIntervals: number = 12) => {
  console.log("Traffic history received:", trafficHistory);

  trafficHistory.slice(0, 5).forEach((entry, index) => {
    console.log(`Traffic entry ${index} timestamp:`, entry.timestamp, `value:`, entry.value);
  });

  const now = new Date();
  const earliestTrafficTime = trafficHistory.length > 0 
    ? Math.min(...trafficHistory.map(t => new Date(t.timestamp).getTime()))
    : now.getTime();
  const windowDurationMs = maxIntervals * intervalMinutes * 60 * 1000;
  const startTime = new Date(Math.max(earliestTrafficTime, now.getTime() - windowDurationMs));

  const labels: string[] = [];
  const totalTrafficData: number[] = [];
  const intervalCounts: number[] = [];

  for (let i = 0; i < maxIntervals; i++) {
    const startMin = i * intervalMinutes;
    const label = `${startMin}`;
    labels.push(label);
    totalTrafficData.push(0);
    intervalCounts.push(0);
  }

  const sortedTraffic = [...trafficHistory].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  for (let i = 1; i < sortedTraffic.length; i++) {
    const prevEntry = sortedTraffic[i - 1];
    const currEntry = sortedTraffic[i];
    const timeDiffMs = new Date(currEntry.timestamp).getTime() - new Date(prevEntry.timestamp).getTime();
    const timeDiffSec = timeDiffMs / 1000;
    if (timeDiffSec <= 0) continue;

    const valueDiff = currEntry.value - prevEntry.value;
    const throughput = Math.abs(valueDiff) / timeDiffSec;

    const entryTime = new Date(currEntry.timestamp);
    const timeSinceStartMs = entryTime.getTime() - startTime.getTime();
    const intervalIndex = Math.floor(timeSinceStartMs / (intervalMinutes * 60 * 1000));

    if (intervalIndex >= 0 && intervalIndex < maxIntervals) {
      totalTrafficData[intervalIndex] += throughput;
      intervalCounts[intervalIndex] += 1;
    }
  }

  for (let i = 0; i < maxIntervals; i++) {
    if (intervalCounts[i] > 0) {
      totalTrafficData[i] = totalTrafficData[i] / intervalCounts[i];
    }
  }

  console.log("Processed labels (before):", labels);
  console.log("Processed totalTrafficData (before):", totalTrafficData);

  const result = {
    labels: labels,
    datasets: [
      { name: "Total Traffic (MB/s)", data: totalTrafficData, color: "blue" },
    ],
  };

  console.log("Network traffic data:", result);
  return result;
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  useWebSocket();
  const { connected, stats, threats, alerts, trafficHistory } = useSecurityData();

  useEffect(() => {
    setMounted(true);
  }, []);

  const projectStartedAlert = alerts.find((alert) => alert.title === "Project Started");
  const sessionStart = projectStartedAlert ? new Date(projectStartedAlert.time) : new Date();

  const threatTrendData = useMemo(() => 
    threats.length > 0 ? groupThreatsBySessionTime(threats, 5) : { labels: [], datasets: [] }, 
    [threats]
  );
  const networkTrafficTrendData = useMemo(() => 
    trafficHistory.length > 1 ? processTrafficHistory(trafficHistory, 5) : { labels: [], datasets: [] }, 
    [trafficHistory]
  );

  // Dynamic markers for ThreatMap (2D) and ThreatGlobe (3D)
  const dynamicMarkers = useMemo(() => {
    return threats.map((threat) => {
      const x = Math.random() * 600 - 300; // Random x: -300 to 300
      const y = Math.random() * 400 - 200; // Random y: -200 to 200
      const z = Math.random() * 8 - 4;     // Random z: -4 to 4 for 3D globe
      const color = threat.status === "blocked" ? "#ff0000" : "#ffa500"; // Red for blocked, Orange for detected

      return {
        x,
        y,
        z, // Only used by ThreatGlobe
        status: threat.status,
        color,
        id: threat.id,
      };
    });
  }, [threats]);

  const activeThreats = stats.total_threats - stats.blocked_attacks;
  const totalThreatsProgress = stats.total_threats > 0 ? (activeThreats / stats.total_threats) * 100 : 0;

  const networkTrafficValue = parseFloat(stats.network_traffic) || 0;
  const networkTrafficProgress = Math.min(100, (networkTrafficValue / 100) * 100);

  const baseHealth = 1000;
  const healthDeductionFromActiveThreats = activeThreats * 50;
  const healthBonusFromBlockedAttacks = stats.blocked_attacks * 20;
  const healthDeductionFromNetworkTraffic = networkTrafficValue * 1;
  const healthDeductionFromActiveUsers = stats.active_users * 10;

  const rawSystemHealth =
    baseHealth -
    healthDeductionFromActiveThreats +
    healthBonusFromBlockedAttacks -
    healthDeductionFromNetworkTraffic -
    healthDeductionFromActiveUsers;
  const systemHealth = Math.max(0, Math.min(baseHealth, rawSystemHealth));
  const systemHealthProgress = (systemHealth / baseHealth) * 100;

  const blockedAttacksProgress = stats.total_threats > 0 ? (stats.blocked_attacks / stats.total_threats) * 100 : 0;

  if (!mounted) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-[#0a0a0f] dark overflow-hidden">
      <ParticleBackground />
      <div className="flex relative z-10">
        <SideNav />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient">
                Security Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">Real-time threat monitoring and analysis</p>
            </div>
            <div className="flex items-center gap-4">
              <LiveStatus activeThreats={activeThreats} />
              <DropdownMenu>
                <DropdownMenuTrigger className="relative">
                  <div className="p-2 rounded-full bg-gray-900/50 backdrop-blur-sm border border-gray-800 hover:border-gray-700 transition-colors">
                    <Bell className="h-5 w-5 text-blue-400" />
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 animate-pulse" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[300px]" style={{ maxHeight: "600px", overflow: "auto", scrollbarWidth: "none" }}>
                  <Alerts />
                </DropdownMenuContent>
              </DropdownMenu>
              <Link href="/">
                <div className="p-2 rounded-full bg-gray-900/50 backdrop-blur-sm border border-gray-800 hover:border-gray-700 transition-colors">
                  <Settings className="h-5 w-5 text-purple-400" />
                </div>
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Threats"
              value={stats.total_threats}
              icon={<Shield className="h-4 w-4 text-blue-400 group-hover:rotate-12 transition-transform" />}
              progressValue={totalThreatsProgress}
              color="blue"
            />
            <StatCard
              title="Network Traffic"
              value={stats.network_traffic}
              icon={<Activity className="h-4 w-4 text-purple-400 group-hover:rotate-12 transition-transform" />}
              progressValue={networkTrafficProgress}
              color="purple"
            />
            <StatCard
              title="System Health"
              value={`${Math.round(systemHealth)}/1000`}
              icon={<Users className="h-4 w-4 text-emerald-400 group-hover:rotate-12 transition-transform" />}
              progressValue={systemHealthProgress}
              color="emerald"
            />
            <StatCard
              title="Blocked Attacks"
              value={stats.blocked_attacks}
              icon={<Lock className="h-4 w-4 text-pink-400 group-hover:rotate-12 transition-transform" />}
              progressValue={blockedAttacksProgress}
              color="pink"
            />
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Global Threat Map</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="map" className="space-y-4">
                  <TabsList className="bg-gray-900/50 border border-gray-800">
                    <TabsTrigger value="map" className="data-[state=active]:bg-gray-800">2D Map</TabsTrigger>
                    <TabsTrigger value="globe" className="data-[state=active]:bg-gray-800">3D Globe</TabsTrigger>
                  </TabsList>
                  <TabsContent value="map">
                  <ThreatMap markers={dynamicMarkers.map(({ x, y, status, color, id }) => ({ x, y, status, color, id }))} />
                  </TabsContent>
                  <TabsContent value="globe">
                    <ThreatGlobe markers={dynamicMarkers} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Network Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="traffic" className="space-y-4">
                  <TabsList className="bg-gray-900/50 border border-gray-800">
                    <TabsTrigger value="traffic" className="data-[state=active]:bg-gray-800">Traffic</TabsTrigger>
                    <TabsTrigger value="threats" className="data-[state=active]:bg-gray-800">Threats</TabsTrigger>
                  </TabsList>
                  <TabsContent value="traffic" className="h-[300px] relative">
                    {networkTrafficTrendData.labels.length > 0 ? (
                      <div className="h-full w-full overflow-hidden">
                        <LineChart labels={networkTrafficTrendData.labels} datasets={networkTrafficTrendData.datasets} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Waiting for traffic data...
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="threats" className="h-[300px] relative">
                    {threatTrendData.labels.length > 0 ? (
                      <div className="h-full w-full overflow-hidden">
                        <LineChart labels={threatTrendData.labels} datasets={threatTrendData.datasets} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Waiting for threat data...
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Recent Threats</CardTitle>
              </CardHeader>
              <CardContent>
                <ThreatTable />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <ActionMenu onShowQuickActions={() => setShowQuickActions(true)} />
      {showQuickActions && <QuickActions onClose={() => setShowQuickActions(false)} />}
    </div>
  );
}

function StatCard({ title, value, icon, progressValue, color }) {
  return (
    <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800 hover:border-gray-700 transition-all group hover:transform hover:scale-105">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className={`text-2xl font-bold text-${color}-400`}>{value}</div>
        <CircularProgress value={progressValue} color={color} />
      </CardContent>
    </Card>
  );
}