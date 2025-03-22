"use client"

import type React from "react"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface LineChartProps {
  data: { name: string; value: number }[]
  color?: string
}

export const LineChart: React.FC<LineChartProps> = ({ data, color = "blue" }) => {
  const getGradient = (ctx: CanvasRenderingContext2D) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400)
    if (color === "blue") {
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.5)")
      gradient.addColorStop(1, "rgba(59, 130, 246, 0)")
    } else {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.5)")
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)")
    }
    return gradient
  }

  const chartData = {
    labels: data.map((item) => item.name),
    datasets: [
      {
        label: "Value",
        data: data.map((item) => item.value),
        fill: true,
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx
          return getGradient(ctx)
        },
        borderColor: color === "blue" ? "rgb(59, 130, 246)" : "rgb(239, 68, 68)",
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: color === "blue" ? "rgb(59, 130, 246)" : "rgb(239, 68, 68)",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#fff",
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: {
          display: true,
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
        },
      },
      y: {
        grid: {
          display: true,
          color: "rgba(255, 255, 255, 0.05)",
        },
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
        },
      },
    },
  }

  return <Line data={chartData} options={options} />
}

