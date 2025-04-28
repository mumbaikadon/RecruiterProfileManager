import React from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  Briefcase, 
  Users, 
  ClipboardList, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
}

const SidebarLink = ({ href, icon, children, isActive }: SidebarLinkProps) => {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
          isActive
            ? "bg-gray-700 text-white"
            : "text-gray-300 hover:bg-gray-700 hover:text-white"
        )}
      >
        <span className="mr-3 h-5 w-5">{icon}</span>
        {children}
      </div>
    </Link>
  );
};

const Sidebar = () => {
  const [location] = useLocation();

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-neutral text-white">
        <div className="flex items-center justify-center h-16 border-b border-gray-700">
          <h1 className="text-xl font-bold">RecruiterTracker</h1>
        </div>
        
        <div className="flex flex-col flex-grow overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-1">
            <SidebarLink 
              href="/" 
              icon={<Home />} 
              isActive={location === "/"}>
              Dashboard
            </SidebarLink>

            <SidebarLink 
              href="/jobs" 
              icon={<Briefcase />} 
              isActive={location.startsWith("/jobs")}>
              Jobs
            </SidebarLink>

            <SidebarLink 
              href="/candidates" 
              icon={<Users />} 
              isActive={location.startsWith("/candidates")}>
              Candidates
            </SidebarLink>

            <SidebarLink 
              href="/submissions" 
              icon={<ClipboardList />} 
              isActive={location.startsWith("/submissions")}>
              Submissions
            </SidebarLink>

            <SidebarLink 
              href="/settings" 
              icon={<Settings />} 
              isActive={location.startsWith("/settings")}>
              Settings
            </SidebarLink>
          </nav>
        </div>
        
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-gray-400 flex items-center justify-center text-white font-bold">
              JD
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-white">John Doe</p>
              <p className="text-xs font-medium text-gray-300">Recruiter Lead</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
