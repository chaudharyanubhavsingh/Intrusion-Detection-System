"use client"

import { useEffect, useState } from "react"

import { Progress } from "@/components/ui/progress"

interface SystemMetric {
  name: string
  value: number
  color: string
}

export function SystemHealth() {
  const [metrics, setMetrics] = useState<SystemMetric[]>([
    { name: "CPU Usage", value: 45, color: "bg-blue-400" },
    { name: "Memory", value: 72, color: "bg-purple-400" },
    { name: "Disk Space", value: 28, color: "bg-emerald-400" },
    { name: "Network", value: 64, color: "bg-pink-400" },
  ])

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((metrics) =>
        metrics.map((metric) => ({
          ...metric,
          value: Math.min(100, Math.max(0, metric.value + (Math.random() - 0.5) * 10)),
        })),
      )
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4">
      {metrics.map((metric) => (
        <div key={metric.name} className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{metric.name}</span>
            <span className="text-muted-foreground">{metric.value.toFixed(1)}%</span>
          </div>
          <Progress value={metric.value} className="h-2" indicatorClassName={metric.color} />
        </div>
      ))}
    </div>
  )
}

