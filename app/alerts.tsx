import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"

const alerts = [
  {
    id: 1,
    title: "High-severity threat detected",
    description: "Multiple login attempts from suspicious IP",
    type: "error",
    time: "2 minutes ago",
  },
  {
    id: 2,
    title: "Firewall rule updated",
    description: "New rule added for port 443",
    type: "success",
    time: "10 minutes ago",
  },
  {
    id: 3,
    title: "Unusual network activity",
    description: "Increased traffic from region: Asia",
    type: "warning",
    time: "25 minutes ago",
  },
]

export function Alerts() {
  return (
    <div className="grid gap-4 p-4">
      {alerts.map((alert) => (
        <div key={alert.id} className="flex items-start gap-4">
          {alert.type === "error" && <AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />}
          {alert.type === "warning" && <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-500" />}
          {alert.type === "success" && <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />}
          <div className="grid gap-1">
            <p className="text-sm font-medium leading-none">{alert.title}</p>
            <p className="text-sm text-muted-foreground">{alert.description}</p>
            <p className="text-xs text-muted-foreground">{alert.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

