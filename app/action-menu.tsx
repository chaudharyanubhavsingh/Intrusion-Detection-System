"use client"

import { useState } from "react"
import { AlertCircle, Lock, MoreHorizontal, RefreshCw, Shield, Siren } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

export function ActionMenu() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed bottom-8 right-8 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            className={`h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg hover:shadow-blue-500/25 transition-all duration-300 ${
              isOpen ? "rotate-45" : ""
            }`}
          >
            <MoreHorizontal className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 p-2 bg-gray-900/90 backdrop-blur-sm border-gray-800">
          <DropdownMenuItem className="flex items-center gap-2 p-3 cursor-pointer hover:bg-red-500/10 hover:text-red-400">
            <Lock className="h-5 w-5" />
            <span>Emergency Lockdown</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 p-3 cursor-pointer hover:bg-yellow-500/10 hover:text-yellow-400">
            <Siren className="h-5 w-5" />
            <span>Alert Security Team</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 p-3 cursor-pointer hover:bg-emerald-500/10 hover:text-emerald-400">
            <RefreshCw className="h-5 w-5" />
            <span>Run System Scan</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 p-3 cursor-pointer hover:bg-blue-500/10 hover:text-blue-400">
            <Shield className="h-5 w-5" />
            <span>Update Firewall</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="flex items-center gap-2 p-3 cursor-pointer hover:bg-purple-500/10 hover:text-purple-400">
            <AlertCircle className="h-5 w-5" />
            <span>View Alerts</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

