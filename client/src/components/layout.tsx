import React, { useState, useEffect } from "react";
import Sidebar from "@/components/ui/sidebar";
import Topbar from "@/components/ui/topbar";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Check for stored accessibility preferences
  useEffect(() => {
    // Check for both accessibility settings
    const storedTextSize = localStorage.getItem("largeTextMode");
    const storedHighContrast = localStorage.getItem("highContrastMode");
    
    // Apply text size preference
    if (storedTextSize === "true") {
      setIsLargeText(true);
      document.documentElement.classList.add("large-text");
    }
    
    // Apply high contrast preference
    if (storedHighContrast === "true") {
      document.documentElement.classList.add("high-contrast");
    }
    
    // Mark as loaded to enable animations
    setTimeout(() => setIsLoaded(true), 100);
    
    // Close mobile sidebar when window is resized to desktop
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false);
      }
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Toggle mobile sidebar
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  // Toggle large text mode
  const toggleLargeText = () => {
    const newValue = !isLargeText;
    setIsLargeText(newValue);
    localStorage.setItem("largeTextMode", String(newValue));
    
    if (newValue) {
      document.documentElement.classList.add("large-text");
    } else {
      document.documentElement.classList.remove("large-text");
    }
  };

  return (
    <div className={cn(
      "flex h-screen overflow-hidden bg-background transition-all duration-300",
      isLargeText && "large-text",
      isLoaded && "animate-fade-in"
    )}>
      {/* Sidebar overlay for mobile - with blur effect */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-all duration-300" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - with smooth animations */}
      <div className={cn(
        "transition-all transform duration-300 ease-in-out",
        isMobileSidebarOpen 
          ? 'fixed inset-y-0 left-0 z-40 w-64 translate-x-0' 
          : 'fixed inset-y-0 left-0 z-40 w-64 -translate-x-full',
        "md:translate-x-0 md:static md:flex md:flex-shrink-0"
      )}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar 
          onMenuClick={toggleMobileSidebar} 
          isLargeText={isLargeText}
          onToggleLargeText={toggleLargeText}
        />
        
        {/* Page content with scrolling and animation */}
        <main 
          className={cn(
            "flex-1 overflow-auto transition-all duration-300 relative",
            isLoaded && "animate-slide-up animation-delay-150"
          )}
        >
          <div className="py-6 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              {/* Content with staggered animation */}
              <div className={cn(
                "stagger-animation",
                isLoaded && "animate-fade-in"
              )}>
                {children}
              </div>
            </div>
          </div>
          
          {/* Bottom gradient fade effect */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none opacity-70" />
        </main>
      </div>
    </div>
  );
};

export default Layout;
