"use client"

import { useEffect, useRef } from "react"

import { DOTS } from "./data/security-data"

export function ThreatMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = 800
    canvas.height = 400

    const img = new Image()
    img.src = "/2dmap.jpg?height=400&width=800"
    img.crossOrigin = "anonymous"

    img.onload = () => {
      const animate = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Draw map with blue tint
        ctx.globalAlpha = 0.8
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        ctx.globalAlpha = 1

        // Draw grid lines
        ctx.strokeStyle = "rgba(59, 130, 246, 0.1)"
        ctx.lineWidth = 1

        // Horizontal lines
        for (let y = 0; y < canvas.height; y += 20) {
          ctx.beginPath()
          ctx.moveTo(0, y)
          ctx.lineTo(canvas.width, y)
          ctx.stroke()
        }

        // Vertical lines
        for (let x = 0; x < canvas.width; x += 20) {
          ctx.beginPath()
          ctx.moveTo(x, 0)
          ctx.lineTo(x, canvas.height)
          ctx.stroke()
        }

        // Draw threat points with animation
        const time = Date.now() / 1000
        DOTS.forEach((dot) => {
          // Animated glow effect
          const glowSize = 20 + Math.sin(time * 2) * 5
          const gradient = ctx.createRadialGradient(dot.x, dot.y, 0, dot.x, dot.y, glowSize)
          gradient.addColorStop(0, dot.color + "80") // 50% opacity
          gradient.addColorStop(1, dot.color + "00") // 0% opacity
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(dot.x, dot.y, glowSize, 0, Math.PI * 2)
          ctx.fill()

          // Center point with pulse effect
          const pointSize = 4 + Math.sin(time * 2) * 2
          ctx.fillStyle = dot.color
          ctx.beginPath()
          ctx.arc(dot.x, dot.y, pointSize, 0, Math.PI * 2)
          ctx.fill()

          // Connection lines between points
          ctx.strokeStyle = dot.color + "40" // 25% opacity
          ctx.lineWidth = 1
          DOTS.forEach((otherDot) => {
            if (dot !== otherDot) {
              ctx.beginPath()
              ctx.moveTo(dot.x, dot.y)
              ctx.lineTo(otherDot.x, otherDot.y)
              ctx.stroke()
            }
          })
        })

        requestAnimationFrame(animate)
      }

      animate()
    }
  }, [])

  return (
    <div className="relative rounded-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
      <canvas ref={canvasRef} className="h-[400px] w-full" />
    </div>
  )
}

