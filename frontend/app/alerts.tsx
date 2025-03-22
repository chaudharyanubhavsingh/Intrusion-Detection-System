import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react"
import { useSecurityData } from "./data/security-data"


export function Alerts() {
  const { alerts } = useSecurityData()
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

