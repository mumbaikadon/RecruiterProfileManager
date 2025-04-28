import React from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "primary" | "secondary" | "amber" | "accent";
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => {
  const colorClasses = {
    primary: "bg-blue-100 text-blue-500 dark:bg-blue-950/50 dark:text-blue-400",
    secondary: "bg-green-100 text-green-500 dark:bg-green-950/50 dark:text-green-400",
    amber: "bg-purple-100 text-purple-500 dark:bg-purple-950/50 dark:text-purple-400",
    accent: "bg-sky-100 text-sky-500 dark:bg-sky-950/50 dark:text-sky-400",
  };

  const iconBgClasses = {
    primary: "bg-blue-500 dark:bg-blue-600",
    secondary: "bg-green-500 dark:bg-green-600",
    amber: "bg-purple-500 dark:bg-purple-600", 
    accent: "bg-sky-500 dark:bg-sky-600",
  };

  return (
    <div className="bg-card dark:bg-card overflow-hidden shadow hover:shadow-md transition-shadow duration-300 rounded-lg border border-border">
      <div className="px-6 py-5 flex items-center">
        <div className={cn("flex-shrink-0 rounded-md p-2 mr-4 shadow-sm", iconBgClasses[color])}>
          <div className="h-5 w-5 text-white">{icon}</div>
        </div>
        <div className="flex flex-col">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
