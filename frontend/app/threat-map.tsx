"use client";

import { useEffect, useRef } from "react";

interface Marker {
  x: number;
  y: number;
  status: string;
  color: string; // Will be overridden with random color
  id: string;
}

interface ThreatMapProps {
  markers: Marker[];
}

// Function to generate a random hex color
const getRandomColor = () => {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
};

export const ThreatMap: React.FC<ThreatMapProps> = ({ markers }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Create a map to store consistent random colors for each marker ID
  const colorMap = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 800;
    canvas.height = 400;

    const img = new Image();
    img.src = "/2dmap.jpg?height=400&width=800";
    img.crossOrigin = "anonymous";

    // Assign random colors to markers if not already assigned
    markers.forEach((marker) => {
      if (!colorMap.current.has(marker.id)) {
        colorMap.current.set(marker.id, getRandomColor());
      }
    });

    img.onload = () => {
      const animate = () => {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw map with blue tint
        ctx.globalAlpha = 0.8;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;

        // Draw grid lines
        ctx.strokeStyle = "rgba(59, 130, 246, 0.1)";
        ctx.lineWidth = 1;

        // Horizontal lines
        for (let y = 0; y < canvas.height; y += 20) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Vertical lines
        for (let x = 0; x < canvas.width; x += 20) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }

        // Draw threat points with animation using dynamic markers
        const time = Date.now() / 1000;
        markers.forEach((marker) => {
          // Adjust coordinates to fit canvas
          const adjustedX = marker.x + 400; // Shift to 0-800 range
          const adjustedY = marker.y + 200; // Shift to 0-400 range

          // Use random color from colorMap
          const markerColor = colorMap.current.get(marker.id) || "#FFFFFF"; // Fallback to white if not found

          // Animated glow effect
          const glowSize = 20 + Math.sin(time * 2) * 5;
          const gradient = ctx.createRadialGradient(adjustedX, adjustedY, 0, adjustedX, adjustedY, glowSize);
          gradient.addColorStop(0, markerColor + "80"); // 50% opacity
          gradient.addColorStop(1, markerColor + "00"); // 0% opacity
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(adjustedX, adjustedY, glowSize, 0, Math.PI * 2);
          ctx.fill();

          // Center point with pulse effect, adjusted opacity for status
          const pointSize = 4 + Math.sin(time * 2) * 2;
          ctx.fillStyle = markerColor;
          ctx.globalAlpha = marker.status === "blocked" ? 0.5 : 1; // Dim blocked threats
          ctx.beginPath();
          ctx.arc(adjustedX, adjustedY, pointSize, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1; // Reset opacity

          // Connection lines between points
          ctx.strokeStyle = markerColor + "40"; // 25% opacity
          ctx.lineWidth = 1;
          markers.forEach((otherMarker) => {
            if (marker.id !== otherMarker.id) {
              const otherX = otherMarker.x + 400;
              const otherY = otherMarker.y + 200;
              ctx.beginPath();
              ctx.moveTo(adjustedX, adjustedY);
              ctx.lineTo(otherX, otherY);
              ctx.stroke();
            }
          });
        });

        requestAnimationFrame(animate);
      };

      animate();
    };
  }, [markers]); // Re-run effect when markers change

  return (
    <div className="relative rounded-lg overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
      <canvas ref={canvasRef} className="h-[400px] w-full" />
    </div>
  );
};