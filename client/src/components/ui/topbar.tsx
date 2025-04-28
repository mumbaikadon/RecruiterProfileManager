import React from "react";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopbarProps {
  onMenuClick: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  return (
    <div className="bg-card border-b border-border">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <button
              onClick={onMenuClick}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none focus:bg-accent focus:text-foreground transition duration-150 ease-in-out"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-shrink-0 flex items-center md:hidden">
              <h1 className="text-xl font-bold">RecruiterTracker</h1>
            </div>
          </div>
          <div className="flex items-center">
            <div className="ml-4 flex items-center gap-2 md:ml-6">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Bell className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
