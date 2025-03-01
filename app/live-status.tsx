"use client"

import { Shield } from "lucide-react"

interface LiveStatusProps {
  activeThreats: number
}

export function LiveStatus({ activeThreats }: LiveStatusProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900/50 backdrop-blur-sm border border-gray-800">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Shield className="h-5 w-5 text-emerald-400" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-400" />
        </div>
        <span className="text-sm text-emerald-400">System Online</span>
      </div>
      <div className="w-px h-4 bg-gray-800" />
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${activeThreats > 0 ? "bg-red-400 animate-pulse" : "bg-emerald-400"}`} />
        <span className="text-sm">{activeThreats} Active Threats</span>
      </div>
    </div>
  )
}

