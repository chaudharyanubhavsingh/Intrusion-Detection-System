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

import { NAVIGATION_ITEMS } from "./data/security-data"

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
          <SidebarGroupLabel className="text-white text-md font-medium">Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAVIGATION_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild className="hover:bg-gray-800/50 data-[active=true]:bg-gray-800">
                      <Link href={item.href}>
                        {/* Dynamically render the icon based on the icon name */}
                        {item.icon === "Home" && <Home className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "Shield" && <Shield className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "Globe" && <Globe className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "BarChart3" && <BarChart3 className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "Activity" && <Activity className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "Lock" && <Lock className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "Users" && <Users className={`h-4 w-4 ${item.color}`} />}
                        {item.icon === "Settings" && <Settings className={`h-4 w-4 ${item.color}`} />}
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

