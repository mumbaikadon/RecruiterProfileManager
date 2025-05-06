import React from "react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "md";
  feedback?: string | null;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = "sm",
  feedback = null
}) => {
  // Map status to color
  const statusColors: Record<string, string> = {
    // Job statuses
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    closed: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    
    // Submission statuses
    new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    submitted_to_vendor: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    rejected_by_vendor: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    submitted_to_client: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400",
    interview_scheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    interview_completed: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
    offer_extended: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
    offer_accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    offer_declined: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  
  // Determine text size based on size prop
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  
  // Format status text (convert underscores to spaces and capitalize each word)
  const formattedStatus = status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Determine if we should show feedback (only for rejected status)
  const showFeedback = status === 'rejected' && feedback;
  
  return (
    <span 
      className={cn(
        "px-2 py-1 inline-flex items-center justify-center font-semibold rounded-full",
        textSize,
        statusColors[status] || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
        showFeedback && "pr-3" // Add more padding if feedback is shown
      )}
    >
      {formattedStatus}
      {showFeedback && (
        <span className="ml-1.5 font-normal italic">
          ({feedback})
        </span>
      )}
    </span>
  );
};

export default StatusBadge;
