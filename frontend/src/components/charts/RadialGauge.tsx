import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface RadialGaugeProps {
  value: number;
  maxValue?: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  colorClass?: string;
  showPercentage?: boolean;
  suffix?: string;
}

export function RadialGauge({
  value,
  maxValue = 100,
  label,
  size = 120,
  strokeWidth = 12,
  colorClass = "text-primary",
  showPercentage = true,
  suffix = "%",
}: RadialGaugeProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const normalizedValue = Math.min(Math.max(value, 0), maxValue);
  const percentage = (normalizedValue / maxValue) * 100;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  // Determine color based on value
  const getColorClass = () => {
    if (colorClass !== "auto") return colorClass;
    if (percentage >= 70) return "text-green-500";
    if (percentage >= 40) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            className={cn(getColorClass(), "transition-all duration-1000 ease-out")}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
              filter: "drop-shadow(0 0 6px currentColor)",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-bold", getColorClass())}>
            {showPercentage ? `${normalizedValue.toFixed(1)}${suffix}` : normalizedValue.toFixed(1)}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
