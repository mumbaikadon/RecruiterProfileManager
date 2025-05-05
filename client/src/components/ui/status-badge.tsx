import React from "react";
import { 
  BarChart, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Info, 
  Sparkles,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type StatusType = 
  | "new" 
  | "updated" 
  | "pending" 
  | "completed" 
  | "cancelled" 
  | "success" 
  | "error" 
  | "warning" 
  | "info" 
  | "default";

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  withAnimation?: boolean;
  showIcon?: boolean;
  tooltip?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function StatusBadge({
  status,
  label,
  withAnimation = false,
  showIcon = true,
  tooltip,
  className,
  size = "md"
}: StatusBadgeProps) {
  // Get status-specific properties
  const {
    icon: StatusIcon,
    baseClassName,
    pulseAnimation
  } = getStatusConfig(status);
  
  // Size variants
  const sizeClasses = {
    sm: "text-xs py-0.5 px-2",
    md: "text-xs py-1 px-2.5",
    lg: "text-sm py-1.5 px-3",
  };
  
  // Build component
  const badge = (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-full whitespace-nowrap transition-all duration-200",
        baseClassName,
        sizeClasses[size],
        withAnimation && pulseAnimation,
        className
      )}
    >
      {showIcon && (
        <StatusIcon className={cn("flex-shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />
      )}
      {label || capitalizeFirstLetter(status)}
    </span>
  );
  
  // Add tooltip if specified
  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badge}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  return badge;
}

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function getStatusConfig(status: StatusType) {
  switch (status) {
    case "new":
      return {
        icon: Sparkles,
        baseClassName: "bg-info/10 text-info border border-info/20",
        pulseAnimation: "animate-pulse"
      };
    case "updated":
      return {
        icon: RefreshCw,
        baseClassName: "bg-purple-500/10 text-purple-500 border border-purple-500/20",
        pulseAnimation: "animate-pulse"
      };
    case "pending":
      return {
        icon: Clock,
        baseClassName: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
        pulseAnimation: ""
      };
    case "completed":
    case "success":
      return {
        icon: CheckCircle2,
        baseClassName: "bg-green-500/10 text-green-600 border border-green-500/20",
        pulseAnimation: ""
      };
    case "cancelled":
    case "error":
      return {
        icon: AlertCircle,
        baseClassName: "bg-red-500/10 text-red-600 border border-red-500/20",
        pulseAnimation: ""
      };
    case "warning":
      return {
        icon: AlertCircle,
        baseClassName: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
        pulseAnimation: ""
      };
    case "info":
      return {
        icon: Info,
        baseClassName: "bg-blue-500/10 text-blue-600 border border-blue-500/20",
        pulseAnimation: ""
      };
    default:
      return {
        icon: BarChart,
        baseClassName: "bg-gray-100 text-gray-600 border border-gray-200",
        pulseAnimation: ""
      };
  }
}

// Dark mode adjustments will be handled by Tailwind's dark mode utilities