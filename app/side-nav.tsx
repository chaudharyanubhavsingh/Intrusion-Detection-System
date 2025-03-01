import { Activity, BarChart3, Globe, Home, Lock, Settings, Shield, Users } from "lucide-react"
import Link from "next/link"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar"

const navigation = [
  { name: "Overview", href: "/", icon: Home, color: "text-blue-400" },
  { name: "Threats", href: "/", icon: Shield, color: "text-purple-400" },
  { name: "Network", href: "/", icon: Globe, color: "text-emerald-400" },
  { name: "Analytics", href: "/", icon: BarChart3, color: "text-pink-400" },
  { name: "Activity", href: "/", icon: Activity, color: "text-orange-400" },
  { name: "Access", href: "/", icon: Lock, color: "text-cyan-400" },
  { name: "Users", href: "/", icon: Users, color: "text-violet-400" },
  { name: "Settings", href: "/", icon: Settings, color: "text-amber-400" },
]

export function SideNav() {
  return (
    <SidebarProvider defaultOpen style={{ width: "auto" }}>
      <Sidebar className="bg-gray-900/50 backdrop-blur-sm border-gray-800">
        <SidebarHeader className="border-gray-800">
          <div className="flex h-[60px] items-center px-6">
            <Shield className="mr-2 h-6 w-6 text-blue-400" />
            <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              SecureIDS
            </span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel className="text-white text-sm font-medium">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild className="hover:bg-gray-800/50 data-[active=true]:bg-gray-800">
                      <Link href={item.href}>
                        <item.icon className={`h-4 w-4  ${item.color}`} />
                        <span className="text-white">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}

