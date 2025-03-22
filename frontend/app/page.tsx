"use client";

import { useEffect, useState } from "react";
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
import { Alerts } from "./alerts";
import { CircularProgress } from "./circular-progress";
import { LiveStatus } from "./live-status";
import { ParticleBackground } from "./particle-background";
import { SideNav } from "./side-nav";
import { ThreatGlobe } from "./threat-globe";
import { ThreatMap } from "./threat-map";
import { ThreatTable } from "./threat-table";
import { useSecurityData, CHART_DATA,  } from "./data/security-data"
import { useWebSocket } from "./api/websocket"
import { MOCK_THREATS } from "./data/security-data"

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  // Initialize WebSocket connection at the top level
  useWebSocket();

  // Use the security data hook to get real-time data
  const securityData = useSecurityData();
  const { connected, stats, activeThreats, threats } = securityData;

  // Ensure mounting before rendering (Fixes hydration errors)
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }
  return (
    <div className="relative min-h-screen bg-[#0a0a0f]  dark overflow-hidden">
      <ParticleBackground />
      <div className="flex relative z-10">
        <SideNav />
        <main className="flex-1 p-8">
          {/* Header Section */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient">
                Security Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Real-time threat monitoring and analysis
              </p>
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
                <DropdownMenuContent align="end" className="w-[300px]">
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

          {/* Live Stats Cards */}
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Threats"
              value={stats.total_threats}
              icon={<Shield className="h-4 w-4 text-blue-400 group-hover:rotate-12 transition-transform" />}
              progressValue={45}
              color="blue"
            />
            <StatCard
              title="Network Traffic"
              value={stats.network_traffic}
              icon={<Activity className="h-4 w-4 text-purple-400 group-hover:rotate-12 transition-transform" />}
              progressValue={78}
              color="purple"
            />
            <StatCard
              title="Active Users"
              value={`+${stats.active_users}`}
              icon={<Users className="h-4 w-4 text-emerald-400 group-hover:rotate-12 transition-transform" />}
              progressValue={65}
              color="emerald"
            />
            <StatCard
              title="Blocked Attacks"
              value={stats.blocked_attacks}
              icon={<Lock className="h-4 w-4 text-pink-400 group-hover:rotate-12 transition-transform" />}
              progressValue={23}
              color="pink"
            />
          </div>

          {/* Threat Map & Network Activity */}
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Global Threat Map</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="map" className="space-y-4">
                  <TabsList className="bg-gray-900/50 border border-gray-800">
                    <TabsTrigger value="map" className="data-[state=active]:bg-gray-800">
                      2D Map
                    </TabsTrigger>
                    <TabsTrigger value="globe" className="data-[state=active]:bg-gray-800">
                      3D Globe
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="map">
                    <ThreatMap />
                  </TabsContent>
                  <TabsContent value="globe">
                    <ThreatGlobe />
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
                    <TabsTrigger value="traffic" className="data-[state=active]:bg-gray-800">
                      Traffic
                    </TabsTrigger>
                    <TabsTrigger value="threats" className="data-[state=active]:bg-gray-800">
                      Threats
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="traffic" className="h-[300px] relative">
                    <LineChart
                      data={[
                        { name: "Jan", value: 100 },
                        { name: "Feb", value: 120 },
                        { name: "Mar", value: 180 },
                        { name: "Apr", value: 140 },
                        { name: "May", value: 200 },
                        { name: "Jun", value: 160 },
                      ]}
                      color="blue"
                    />
                  </TabsContent>
                  <TabsContent value="threats" className="h-[300px] relative">
                    <LineChart
                      data={[
                        { name: "Jan", value: 20 },
                        { name: "Feb", value: 40 },
                        { name: "Mar", value: 30 },
                        { name: "Apr", value: 80 },
                        { name: "May", value: 50 },
                        { name: "Jun", value: 40 },
                      ]}
                      color="red"
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Recent Threats Table */}
          <div className="mt-8">
            <Card className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Recent Threats</CardTitle>
              </CardHeader>
              <CardContent>
              <ThreatTable threats={MOCK_THREATS} />
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <ActionMenu />
    </div>
  );
}

// Reusable Card Component for Live Stat
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

