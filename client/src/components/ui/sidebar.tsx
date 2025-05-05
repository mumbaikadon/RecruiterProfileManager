import React from "react";
import { Link, useLocation } from "wouter";
import { 
  Home, 
  Briefcase, 
  Users, 
  ClipboardList, 
  Settings,
  BarChart4,
  PlusCircle,
  LayoutGrid,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  badge?: number;
}

const SidebarLink = ({ href, icon, children, isActive, badge }: SidebarLinkProps) => {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200 group relative",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground"
        )}
      >
        <span className={cn(
          "mr-3 h-5 w-5 transition-transform group-hover:scale-110",
          isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"
        )}>
          {icon}
        </span>
        <span>{children}</span>
        
        {/* Badge for notifications/counts */}
        {badge && (
          <Badge variant="secondary" className="ml-auto bg-sidebar-primary/20 text-sidebar-foreground text-xs">
            {badge}
          </Badge>
        )}
        
        {/* Right indicator for active item */}
        {isActive && (
          <ChevronRight className="h-4 w-4 ml-auto text-sidebar-primary-foreground/70" />
        )}
      </div>
    </Link>
  );
};

// Section title component for sidebar
const SidebarSection = ({ title }: { title: string }) => (
  <div className="px-4 pt-5 pb-2">
    <h3 className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
      {title}
    </h3>
  </div>
);

const Sidebar = () => {
  const [location] = useLocation();

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-sidebar text-sidebar-foreground shadow-lg rounded-r-2xl">
        {/* App logo */}
        <div className="flex items-center justify-center h-16 border-b border-sidebar-border/30">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              RecruiterTracker
            </h1>
          </div>
        </div>
        
        <div className="flex flex-col flex-grow overflow-y-auto">
          {/* Main navigation */}
          <SidebarSection title="Main" />
          <nav className="flex-1 px-2 py-2 space-y-1">
            <SidebarLink 
              href="/" 
              icon={<Home />} 
              isActive={location === "/"}>
              Dashboard
            </SidebarLink>

            <SidebarLink 
              href="/jobs" 
              icon={<Briefcase />} 
              isActive={location.startsWith("/jobs")}
              badge={7}>
              Jobs
            </SidebarLink>

            <SidebarLink 
              href="/candidates" 
              icon={<Users />} 
              isActive={location.startsWith("/candidates")}
              badge={12}>
              Candidates
            </SidebarLink>

            <SidebarLink 
              href="/submissions" 
              icon={<ClipboardList />} 
              isActive={location.startsWith("/submissions")}
              badge={5}>
              Submissions
            </SidebarLink>
          </nav>

          {/* Reports section - can be extended later */}
          <SidebarSection title="Reports" />
          <nav className="flex-1 px-2 py-2 space-y-1">
            <SidebarLink 
              href="/reports/analytics" 
              icon={<BarChart4 />} 
              isActive={location.startsWith("/reports")}>
              Analytics
            </SidebarLink>
          </nav>
          
          {/* Settings section */}
          <SidebarSection title="Account" />
          <nav className="flex-1 px-2 py-2 space-y-1">
            <SidebarLink 
              href="/settings" 
              icon={<Settings />} 
              isActive={location.startsWith("/settings")}>
              Settings
            </SidebarLink>
          </nav>
          
          {/* Quick Action */}
          <div className="px-4 py-4 mt-auto">
            <button className="w-full bg-primary/10 hover:bg-primary/20 text-primary rounded-lg py-2 flex items-center justify-center gap-2 transition-colors">
              <PlusCircle className="h-4 w-4" />
              <span className="text-sm font-medium">New Job</span>
            </button>
          </div>
        </div>
        
        {/* User profile section */}
        <div className="p-4 border-t border-sidebar-border/30">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-primary/90 flex items-center justify-center text-white font-bold shadow-md">
              JD
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-sidebar-foreground">John Doe</p>
              <p className="text-xs font-medium text-sidebar-foreground/60">Recruiter Lead</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
