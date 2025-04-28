import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = "sm" 
}) => {
  // Map status to color
  const statusColors: Record<string, string> = {
    // Job statuses
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    closed: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    
    // Submission statuses
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    interview: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    offer: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    hired: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  
  // Determine text size based on size prop
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  
  // Format status text (capitalize first letter)
  const formattedStatus = status.charAt(0).toUpperCase() + status.slice(1);
  
  return (
    <span 
      className={cn(
        "px-2 inline-flex leading-5 font-semibold rounded-full",
        textSize,
        statusColors[status] || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
      )}
    >
      {formattedStatus}
    </span>
  );
};

export default StatusBadge;
