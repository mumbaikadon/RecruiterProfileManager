import React, { useEffect, useState } from "react";
import { 
  Eye, 
  ZoomIn, 
  ZoomOut, 
  Sun, 
  Moon, 
  Check,
  ChevronsUpDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";

interface AccessibilityMenuProps {
  isLargeText: boolean;
  onToggleLargeText: () => void;
}

export function AccessibilityMenu({ isLargeText, onToggleLargeText }: AccessibilityMenuProps) {
  const [isHighContrast, setIsHighContrast] = useState(false);
  
  // Check for stored accessibility preferences
  useEffect(() => {
    const storedHighContrast = localStorage.getItem("highContrastMode");
    if (storedHighContrast === "true") {
      setIsHighContrast(true);
      document.documentElement.classList.add("high-contrast");
    }
  }, []);
  
  const toggleHighContrast = () => {
    const newValue = !isHighContrast;
    setIsHighContrast(newValue);
    localStorage.setItem("highContrastMode", String(newValue));
    
    if (newValue) {
      document.documentElement.classList.add("high-contrast");
    } else {
      document.documentElement.classList.remove("high-contrast");
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full text-muted-foreground hover:text-foreground relative"
          aria-label="Accessibility options"
        >
          <Eye className="h-5 w-5" />
          {(isLargeText || isHighContrast) && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Accessibility Options</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={onToggleLargeText}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            {isLargeText ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
            <span>{isLargeText ? "Normal Text" : "Larger Text"}</span>
          </div>
          {isLargeText && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={toggleHighContrast}
          className="flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span>High Contrast</span>
          </div>
          {isHighContrast && <Check className="h-4 w-4" />}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem className="flex flex-col items-start gap-1 cursor-default focus:bg-transparent">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm font-medium">Theme</span>
            <ThemeToggle />
          </div>
          <span className="text-xs text-muted-foreground">
            Toggle between light and dark mode
          </span>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <p className="text-xs text-muted-foreground mb-1">
            Your accessibility preferences are saved for your next visit
          </p>
          
          <div className="flex items-center justify-center mt-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs h-8"
              onClick={() => {
                localStorage.removeItem("largeTextMode");
                localStorage.removeItem("highContrastMode");
                document.documentElement.classList.remove("large-text", "high-contrast");
                setIsHighContrast(false);
                if (isLargeText) onToggleLargeText();
              }}
            >
              Reset All Preferences
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}