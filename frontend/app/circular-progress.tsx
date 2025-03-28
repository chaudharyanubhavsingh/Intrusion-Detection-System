"use client";

import { useEffect, useState } from "react";

interface CircularProgressProps {
  value: number;
  color?: "blue" | "purple" | "emerald" | "pink";
}

export function CircularProgress({ value, color = "blue" }: CircularProgressProps) {
  const [progress, setProgress] = useState(0);

  // Smoothly update the progress whenever the value changes
  useEffect(() => {
    // Use a small delay to ensure the initial render doesn't jump
    const timer = setTimeout(() => {
      setProgress(value);
    }, 50);

    return () => clearTimeout(timer);
  }, [value]);

  const getColor = () => {
    switch (color) {
      case "blue":
        return ["from-blue-500", "to-blue-300"];
      case "purple":
        return ["from-purple-500", "to-purple-300"];
      case "emerald":
        return ["from-emerald-500", "to-emerald-300"];
      case "pink":
        return ["from-pink-500", "to-pink-300"];
      default:
        return ["from-blue-500", "to-blue-300"];
    }
  };

  const [fromColor, toColor] = getColor();
  const roundedValue = Number(value.toFixed(2));
  const circumference = 251.2; // 2 * π * r (where r = 40)
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative h-20 w-20">
      {/* Background circle */}
      <svg className="h-full w-full" viewBox="0 0 100 100">
        <circle
          className="stroke-gray-800"
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
        />
        {/* Progress circle */}
        <circle
          className={`stroke-current transition-all duration-700 ease-in-out ${fromColor}`}
          cx="50"
          cy="50"
          r="40"
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-medium text-${color}-400`}>{roundedValue}%</span>
      </div>
      {/* Glow effect */}
      <div
        className={`absolute inset-0 rounded-full blur-xl opacity-20 bg-gradient-to-r ${fromColor} ${toColor}`}
      />
    </div>
  );
}