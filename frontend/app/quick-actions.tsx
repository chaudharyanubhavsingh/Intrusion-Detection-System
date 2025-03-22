"use client"

import { Lock, RefreshCw, Shield, Siren } from "lucide-react"

import { Button } from "@/components/ui/button"

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Button
        variant="outline"
        className="flex flex-col items-center gap-2 h-auto p-4 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50"
      >
        <Lock className="h-6 w-6" />
        <span>Lockdown</span>
      </Button>
      <Button
        variant="outline"
        className="flex flex-col items-center gap-2 h-auto p-4 hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/50"
      >
        <Siren className="h-6 w-6" />
        <span>Alert Team</span>
      </Button>
      <Button
        variant="outline"
        className="flex flex-col items-center gap-2 h-auto p-4 hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/50"
      >
        <RefreshCw className="h-6 w-6" />
        <span>Scan Now</span>
      </Button>
      <Button
        variant="outline"
        className="flex flex-col items-center gap-2 h-auto p-4 hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/50"
      >
        <Shield className="h-6 w-6" />
        <span>Firewall</span>
      </Button>
    </div>
  )
}

