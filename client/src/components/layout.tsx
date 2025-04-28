import React, { useState } from "react";
import Sidebar from "@/components/ui/sidebar";
import Topbar from "@/components/ui/topbar";

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar overlay for mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar - visible on desktop by default, controlled on mobile */}
      <div className={`${isMobileSidebarOpen ? 'fixed inset-0 z-40' : 'hidden'} md:flex md:flex-shrink-0`}>
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Topbar onMenuClick={toggleMobileSidebar} />
        
        {/* Page content with scrolling */}
        <div className="flex-1 overflow-auto bg-background transition-colors duration-300">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Layout;
