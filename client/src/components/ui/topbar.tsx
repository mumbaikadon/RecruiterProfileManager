import React from "react";
import { Bell, Menu, Search, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { AccessibilityMenu } from "@/components/accessibility-menu";
import { UserProfileMenu } from "@/components/ui/user-profile-menu";

interface TopbarProps {
  onMenuClick: () => void;
  isLargeText?: boolean;
  onToggleLargeText?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ 
  onMenuClick, 
  isLargeText = false,
  onToggleLargeText = () => {}
}) => {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-20 transition-all duration-300">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button
              onClick={onMenuClick}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200 ease-in-out"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            
            {/* Mobile app title */}
            <div className="flex-shrink-0 flex items-center md:hidden">
              <div className="ml-2 font-bold text-xl bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                RecruiterTracker
              </div>
            </div>
            
            {/* Search bar - hidden on small screens */}
            <div className="ml-6 hidden md:flex md:flex-1 max-w-md">
              <div className="w-full relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Search className="h-4 w-4" />
                </div>
                <Input
                  type="text"
                  placeholder="Search jobs, candidates, or submissions..."
                  className="h-9 pl-10 w-full bg-muted/20 hover:bg-muted/30 focus:bg-muted/40 border-0 focus-visible:ring-1 focus-visible:ring-primary/30 transition-all duration-200"
                />
              </div>
            </div>
          </div>
          
          {/* Right Side Navigation Elements */}
          <div className="flex items-center space-x-1.5">
            <TooltipProvider>
              {/* Date Picker */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full text-muted-foreground hover:text-foreground transition-all duration-200"
                    aria-label="Calendar"
                  >
                    <CalendarDays className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Calendar</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Accessibility Menu */}
              <AccessibilityMenu 
                isLargeText={isLargeText} 
                onToggleLargeText={onToggleLargeText}
              />
              
              {/* Notifications with animated badge */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full text-muted-foreground hover:text-foreground relative transition-all duration-200"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notifications</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* User Profile Dropdown Menu */}
            <UserProfileMenu />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
