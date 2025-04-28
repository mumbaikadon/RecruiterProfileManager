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
    primary: "bg-blue-100 text-blue-500",
    secondary: "bg-green-100 text-green-500",
    amber: "bg-purple-100 text-purple-500",
    accent: "bg-sky-100 text-sky-500",
  };

  const iconBgClasses = {
    primary: "bg-blue-500",
    secondary: "bg-green-500",
    amber: "bg-purple-500", 
    accent: "bg-sky-500",
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="px-6 py-5 flex items-center">
        <div className={cn("flex-shrink-0 rounded-md p-2 mr-4", iconBgClasses[color])}>
          <div className="h-5 w-5 text-white">{icon}</div>
        </div>
        <div className="flex flex-col">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
