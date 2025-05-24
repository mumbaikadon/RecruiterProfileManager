import React from "react";
import { Bell, Menu, Search, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { AccessibilityMenu } from "@/components/accessibility-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";

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
  // Initialize from localStorage or default to 3
  const [notificationCount, setNotificationCount] = React.useState(() => {
    const savedCount = localStorage.getItem('notificationCount');
    return savedCount !== null ? parseInt(savedCount, 10) : 3;
  });
  
  // Update localStorage whenever notification count changes
  React.useEffect(() => {
    localStorage.setItem('notificationCount', notificationCount.toString());
  }, [notificationCount]);
  
  const markAllAsRead = () => {
    setNotificationCount(0);
    // In a real implementation, this would call an API to mark notifications as read
  };
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
              
              {/* Notifications with dynamic badge and dropdown */}
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full text-muted-foreground hover:text-foreground relative transition-all duration-200"
                        aria-label="Notifications"
                      >
                        <Bell className="h-5 w-5" />
                        {notificationCount > 0 && (
                          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold rounded-full bg-primary text-white">
                            {notificationCount}
                          </span>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Notifications</p>
                  </TooltipContent>
                </Tooltip>
                
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    <Button variant="ghost" size="sm" className="text-xs h-auto py-1" 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markAllAsRead();
                            }}>
                      Mark all as read
                    </Button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {/* New application notification */}
                  <div className="p-0 cursor-pointer">
                    <a href="/candidates/71" className="block">
                      <div className="flex items-start gap-3 p-3 hover:bg-accent transition-colors">
                        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full flex-shrink-0">
                          <CalendarDays className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">New application received</p>
                          <p className="text-xs text-muted-foreground mt-1">Aman Rauniyar applied for Java Developer</p>
                          <p className="text-xs text-muted-foreground mt-1">3 minutes ago</p>
                        </div>
                      </div>
                    </a>
                  </div>
                  
                  {/* Another notification example */}
                  <div className="p-0 cursor-pointer">
                    <a href="/candidates/72" className="block">
                      <div className="flex items-start gap-3 p-3 hover:bg-accent transition-colors">
                        <div className="bg-green-100 dark:bg-green-900 p-2 rounded-full flex-shrink-0">
                          <CalendarDays className="h-4 w-4 text-green-600 dark:text-green-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">New application received</p>
                          <p className="text-xs text-muted-foreground mt-1">Manoj Kumar applied for Java Developer</p>
                          <p className="text-xs text-muted-foreground mt-1">15 minutes ago</p>
                        </div>
                      </div>
                    </a>
                  </div>
                  
                  <DropdownMenuSeparator />
                  <div className="p-0 text-center">
                    <a href="/notifications" className="block p-2 text-primary hover:bg-accent/50 transition-colors">
                      View all notifications
                    </a>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipProvider>
            
            {/* User Profile Dropdown Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="rounded-full h-8 w-8 p-0 ml-1 md:ml-2 transition-all duration-200 hover:ring-2 hover:ring-primary/20"
                >
                  <Avatar className="h-8 w-8 cursor-pointer">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white font-medium text-sm">
                      JD
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">John Doe</p>
                    <p className="text-xs text-muted-foreground">john.doe@example.com</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Support</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
