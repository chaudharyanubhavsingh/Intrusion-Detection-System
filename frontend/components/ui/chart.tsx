"use client";

import type React from "react";
import { Line } from "react-chartjs-2";
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
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface LineChartProps {
  labels: string[];
  datasets: { name: string; data: number[]; color: string }[];
}

export const LineChart: React.FC<LineChartProps> = ({ labels, datasets }) => {
  const getGradient = (ctx: CanvasRenderingContext2D, color: string) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    if (color === "blue") {
      gradient.addColorStop(0, "rgba(59, 130, 246, 0.5)");
      gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
    } else if (color === "green") {
      gradient.addColorStop(0, "rgba(34, 197, 94, 0.5)");
      gradient.addColorStop(1, "rgba(34, 197, 94, 0)");
    } else if (color === "red") {
      gradient.addColorStop(0, "rgba(239, 68, 68, 0.5)");
      gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    } else if (color === "orange") {
      gradient.addColorStop(0, "rgba(249, 115, 22, 0.5)");
      gradient.addColorStop(1, "rgba(249, 115, 22, 0)");
    }
    return gradient;
  };

  const chartData = {
    labels,
    datasets: datasets.map((dataset) => ({
      label: dataset.name,
      data: dataset.data,
      fill: true,
      backgroundColor: (context: any) => {
        const ctx = context.chart.ctx;
        return getGradient(ctx, dataset.color);
      },
      borderColor: dataset.color === "blue" ? "rgb(59, 130, 246)" :
                  dataset.color === "green" ? "rgb(34, 197, 94)" :
                  dataset.color === "red" ? "rgb(239, 68, 68)" :
                  "rgb(249, 115, 22)", // orange
      borderWidth: 2,
      tension: 0.4,
      pointBackgroundColor: dataset.color === "blue" ? "rgb(59, 130, 246)" :
                           dataset.color === "green" ? "rgb(34, 197, 94)" :
                           dataset.color === "red" ? "rgb(239, 68, 68)" :
                           "rgb(249, 115, 22)",
      pointBorderColor: "#fff",
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: "top" as const,
        labels: {
          color: "rgba(255, 255, 255, 0.8)",
          boxWidth: 20, // Reduce legend box size
          padding: 10, // Reduce padding around legend
        },
      },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        padding: 12,
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
        titleColor: "#fff",
        bodyColor: "#fff",
        displayColors: true,
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
          callback: function (value: number, index: number, values: any[]) {
            return index % 2 === 0 ? labels[index] : "";
          },
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: Math.max(...datasets.flatMap(d => d.data)) * 1.2 || 10,
        ticks: {
          color: "rgba(255, 255, 255, 0.5)",
          stepSize: Math.max(1, Math.ceil(Math.max(...datasets.flatMap(d => d.data)) / 5)),
        },
        grid: {
          display: true,
          color: "rgba(255, 255, 255, 0.05)",
        },
      },
    },
    layout: {
      padding: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
      },
    },
  };

  return <Line data={chartData} options={options} />;
};