import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

// Add CircularProgress component
interface CircularProgressProps {
  value: number
  size?: "small" | "medium" | "large"
  showValue?: boolean
}

const CircularProgress = ({
  value,
  size = "medium",
  showValue = false,
}: CircularProgressProps) => {
  // Define the circle radius
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate the size based on the prop
  const dimensions = {
    small: { width: 50, height: 50, strokeWidth: 5, fontSize: "0.8rem" },
    medium: { width: 80, height: 80, strokeWidth: 6, fontSize: "1rem" },
    large: { width: 120, height: 120, strokeWidth: 8, fontSize: "1.5rem" }
  };
  
  const { width, height, strokeWidth, fontSize } = dimensions[size];
  
  // Normalize value to be between 0 and 100
  const normalizedValue = Math.min(Math.max(value, 0), 100);
  
  // Calculate the stroke dashoffset
  const strokeDashoffset = circumference - (normalizedValue / 100) * circumference;
  
  // Determine stroke color based on value
  const getColor = (value: number) => {
    if (value < 30) return "var(--destructive)";
    if (value < 70) return "var(--warning)";
    return "var(--success)";
  };
  
  return (
    <div className="relative inline-flex" style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 100 100`}>
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke="var(--secondary)"
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="transparent"
          stroke={getColor(normalizedValue)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 50 50)"
          strokeLinecap="round"
        />
      </svg>
      
      {showValue && (
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold"
          style={{ fontSize }}
        >
          {Math.round(normalizedValue)}%
        </div>
      )}
    </div>
  );
};

export { Progress, CircularProgress }