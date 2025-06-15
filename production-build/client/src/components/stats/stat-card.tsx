import React from "react";
import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: "primary" | "secondary" | "amber" | "accent";
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  subtitle?: string;
}

// Define variants for stat cards
const cardVariants = cva(
  "group bg-card dark:bg-card overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 rounded-xl border border-border/50 hover:border-border/90",
  {
    variants: {
      color: {
        primary: "hover:border-primary/30 dark:hover:border-primary/30",
        secondary: "hover:border-secondary-foreground/30 dark:hover:border-secondary-foreground/30",
        amber: "hover:border-purple-400/30 dark:hover:border-purple-400/30",
        accent: "hover:border-accent-foreground/30 dark:hover:border-accent-foreground/30",
      },
    },
    defaultVariants: {
      color: "primary",
    },
  }
);

const iconContainerVariants = cva(
  "flex-shrink-0 rounded-lg p-3 shadow-sm transition-all duration-300 group-hover:scale-105",
  {
    variants: {
      color: {
        primary: "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary",
        secondary: "bg-secondary-foreground/10 text-secondary-foreground dark:bg-secondary-foreground/20 dark:text-secondary-foreground/80",
        amber: "bg-purple-400/10 text-purple-500 dark:bg-purple-400/20 dark:text-purple-400",
        accent: "bg-accent-foreground/10 text-accent-foreground dark:bg-accent-foreground/20 dark:text-accent-foreground/80",
      },
    },
    defaultVariants: {
      color: "primary",
    },
  }
);

const changeVariants = cva(
  "inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded",
  {
    variants: {
      type: {
        increase: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-400",
        decrease: "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400",
      },
    },
    defaultVariants: {
      type: "increase",
    },
  }
);

const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon, 
  color, 
  change, 
  subtitle 
}) => {
  return (
    <div className={cn(cardVariants({ color }))}>
      <div className="p-5 flex items-start">
        <div className={cn(iconContainerVariants({ color }), "mr-4")}>
          <div className="h-6 w-6">{icon}</div>
        </div>
        <div className="flex flex-col">
          <div className="flex items-center">
            <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
            {change && (
              <span className={cn(changeVariants({ type: change.type }), "ml-2")}>
                {change.type === "increase" ? "+" : "-"}{Math.abs(change.value)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
      </div>
      
      {/* Subtle accent line at bottom to match color theme */}
      <div className={cn(
        "h-1 w-full transition-all duration-300",
        color === "primary" && "bg-primary/30 group-hover:bg-primary/80",
        color === "secondary" && "bg-secondary-foreground/30 group-hover:bg-secondary-foreground/80",
        color === "amber" && "bg-purple-400/30 group-hover:bg-purple-400/80",
        color === "accent" && "bg-accent-foreground/30 group-hover:bg-accent-foreground/80",
      )} />
    </div>
  );
};

export default StatCard;
