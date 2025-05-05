import React, { useState, useEffect } from "react";
import Sidebar from "@/components/ui/sidebar";
import Topbar from "@/components/ui/topbar";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isLargeText, setIsLargeText] = useState(false);

  // Check for stored accessibility preferences
  useEffect(() => {
    const storedPreference = localStorage.getItem("largeTextMode");
    if (storedPreference === "true") {
      setIsLargeText(true);
      document.documentElement.classList.add("large-text");
    }
  }, []);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

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
      "flex h-screen overflow-hidden bg-background transition-colors duration-300",
      isLargeText && "large-text"
    )}>
      {/* Sidebar overlay for mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 md:hidden transition-opacity" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - visible on desktop by default, controlled on mobile */}
      <div className={cn(
        isMobileSidebarOpen 
          ? 'fixed inset-0 z-40 animate-in slide-in-from-left duration-300' 
          : 'hidden',
        "md:flex md:flex-shrink-0"
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
        
        {/* Page content with scrolling */}
        <main className="flex-1 overflow-auto transition-all duration-300 relative">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
          
          {/* Gradient fade at bottom for visual polish */}
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        </main>
      </div>
    </div>
  );
};

export default Layout;
