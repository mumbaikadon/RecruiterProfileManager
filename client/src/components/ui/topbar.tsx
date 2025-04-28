import React, { useState } from "react";
import { Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  onMenuClick: () => void;
}

const Topbar: React.FC<TopbarProps> = ({ onMenuClick }) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <button
              onClick={onMenuClick}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 focus:text-gray-500 transition duration-150 ease-in-out"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex-shrink-0 flex items-center md:hidden">
              <h1 className="text-xl font-bold">RecruiterTracker</h1>
            </div>
          </div>
          <div className="flex items-center">
            <div className="ml-4 flex items-center md:ml-6">
              <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-500">
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
