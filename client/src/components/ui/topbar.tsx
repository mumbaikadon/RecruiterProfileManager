import React from "react";
import { Bell, Menu, Search, TextIcon, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";

interface TopbarProps {
  onMenuClick: () => void;
  isLargeText?: boolean;
  onToggleLargeText?: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ 
  onMenuClick, 
  isLargeText = false,
  onToggleLargeText 
}) => {
  return (
    <header className="bg-card border-b border-border shadow-sm sticky top-0 z-20">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={onMenuClick}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-primary/20 transition duration-150 ease-in-out"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex-shrink-0 flex items-center md:hidden">
              <h1 className="text-xl font-bold ml-2 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                RecruiterTracker
              </h1>
            </div>
            
            {/* Search bar - hidden on small screens */}
            <div className="ml-6 hidden md:flex md:flex-1 max-w-md">
              <div className="w-full relative rounded-full bg-muted/30 hover:bg-muted/50 transition-colors group focus-within:ring-2 focus-within:ring-primary/20">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Search className="h-4 w-4" />
                </div>
                <Input
                  type="text"
                  placeholder="Search..."
                  className="h-9 border-0 bg-transparent rounded-full pl-10 focus-visible:ring-0 w-full"
                />
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <TooltipProvider>
              {/* Accessibility toggle for larger text */}
              {onToggleLargeText && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={onToggleLargeText}
                      className={cn(
                        "rounded-full text-muted-foreground",
                        isLargeText && "bg-accent/30 text-accent-foreground"
                      )}
                      aria-label="Toggle large text mode"
                    >
                      {isLargeText ? (
                        <ZoomOut className="h-5 w-5" />
                      ) : (
                        <ZoomIn className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isLargeText ? "Normal text" : "Larger text"}</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="rounded-full overflow-hidden">
                    <ThemeToggle />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Toggle theme</p>
                </TooltipContent>
              </Tooltip>
              
              {/* Notifications */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full text-muted-foreground hover:text-foreground relative"
                    aria-label="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Notifications</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* User menu - optional addition */}
            <div className="ml-1 md:ml-2 flex-shrink-0 hidden sm:block">
              <div className="h-8 w-8 rounded-full bg-primary/90 flex items-center justify-center text-white font-medium text-sm shadow-sm">
                JD
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
