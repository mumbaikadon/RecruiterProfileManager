import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SuspiciousBadgeProps {
  isSuspicious: boolean;
  suspiciousReason?: string | null;
  suspiciousSeverity?: string | null;
  size?: "sm" | "md";
}

const SuspiciousBadge: React.FC<SuspiciousBadgeProps> = ({
  isSuspicious,
  suspiciousReason,
  suspiciousSeverity = "MEDIUM",
  size = "md",
}) => {
  if (!isSuspicious) return null;
  
  const severityColor = {
    "LOW": "text-amber-500 bg-amber-50",
    "MEDIUM": "text-orange-500 bg-orange-50",
    "HIGH": "text-red-500 bg-red-50",
    "CRITICAL": "text-red-600 bg-red-100",
  }[suspiciousSeverity || "MEDIUM"];
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={cn(
              "inline-flex items-center rounded-full px-2 py-1", 
              severityColor,
              {
                "text-xs": size === "sm",
                "text-sm": size === "md",
              }
            )}
          >
            <AlertTriangle className={cn("mr-1", {
              "h-3 w-3": size === "sm",
              "h-4 w-4": size === "md",
            })} />
            <span>Suspicious</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            <p className="font-semibold">
              {suspiciousSeverity || "MEDIUM"} Risk: Suspicious Candidate
            </p>
            <p className="text-sm mt-1">
              {suspiciousReason || "This candidate has been flagged due to suspicious activity"}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default SuspiciousBadge;