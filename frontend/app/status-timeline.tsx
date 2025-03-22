import { AlertCircle, CheckCircle2, Clock } from "lucide-react"

const timeline = [
  {
    time: "11:45 AM",
    event: "Firewall Updated",
    type: "success",
  },
  {
    time: "10:30 AM",
    event: "Threat Detected",
    type: "error",
  },
  {
    time: "09:15 AM",
    event: "System Scan",
    type: "info",
  },
  {
    time: "08:00 AM",
    event: "Backup Complete",
    type: "success",
  },
]

export function StatusTimeline() {
  return (
    <div className="relative space-y-4">
      {timeline.map((item, index) => (
        <div key={index} className="flex items-start gap-4">
          {item.type === "success" && (
            <div className="mt-1 p-1 rounded-full bg-emerald-400/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
          )}
          {item.type === "error" && (
            <div className="mt-1 p-1 rounded-full bg-red-400/10">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
          )}
          {item.type === "info" && (
            <div className="mt-1 p-1 rounded-full bg-blue-400/10">
              <Clock className="h-4 w-4 text-blue-400" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">{item.event}</span>
            <span className="text-xs text-muted-foreground">{item.time}</span>
          </div>
        </div>
      ))}
      <div className="absolute left-[19px] top-8 bottom-0 w-px bg-gradient-to-b from-gray-800 to-transparent" />
    </div>
  )
}

