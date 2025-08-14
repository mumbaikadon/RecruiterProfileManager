import React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Eye, RefreshCw, Download, XCircle, CheckCircle } from "lucide-react";

interface ActionItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive" | "success" | "warning";
  disabled?: boolean;
  title?: string;
}

interface ActionsDropdownProps {
  actions: ActionItem[];
  size?: "sm" | "md";
}

const ActionsDropdown: React.FC<ActionsDropdownProps> = ({ actions, size = "sm" }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-6 w-6 p-0 min-w-[24px] flex-shrink-0"
        >
          <span className="sr-only">Open actions menu</span>
          <MoreHorizontal className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[140px]">
        {actions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={`cursor-pointer ${
              action.variant === "destructive" 
                ? "text-red-600 hover:text-red-700 hover:bg-red-50" 
                : action.variant === "success"
                ? "text-green-600 hover:text-green-700 hover:bg-green-50"
                : action.variant === "warning"
                ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                : ""
            }`}
            title={action.title}
          >
            <span className="mr-2">{action.icon}</span>
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ActionsDropdown;