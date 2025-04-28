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
    active: "bg-green-100 text-green-800",
    reviewing: "bg-yellow-100 text-yellow-800",
    closed: "bg-gray-100 text-gray-800",
    
    // Submission statuses
    new: "bg-blue-100 text-blue-800",
    interview: "bg-purple-100 text-purple-800",
    offer: "bg-indigo-100 text-indigo-800",
    hired: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
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
        statusColors[status] || "bg-gray-100 text-gray-800"
      )}
    >
      {formattedStatus}
    </span>
  );
};

export default StatusBadge;
