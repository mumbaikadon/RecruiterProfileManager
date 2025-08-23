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
  Zap,
  ChevronRight,
  Building2,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDashboardStats } from "@/hooks/use-submissions";
import logo from "@/assets/images/logo.png";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import CreateJobDialog from "@/components/job/create-job-dialog";

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isActive?: boolean;
  badge?: number;
}

const SidebarLink = ({
  href,
  icon,
  children,
  isActive,
  badge,
}: SidebarLinkProps) => {
  return (
    <Link href={href}>
      <div
        className={cn(
          "flex items-center px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200 group relative",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/20 hover:text-sidebar-foreground",
        )}
      >
        <span
          className={cn(
            "mr-3 h-5 w-5 transition-transform group-hover:scale-110",
            isActive
              ? "text-sidebar-primary-foreground"
              : "text-sidebar-foreground/70",
          )}
        >
          {icon}
        </span>
        <span>{children}</span>

        {/* Badge for notifications/counts */}
        {badge && (
          <Badge
            variant="secondary"
            className="ml-auto bg-sidebar-primary/20 text-sidebar-foreground text-xs"
          >
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
  const { user } = useAuth();
  const { data: statsData } = useDashboardStats();

  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-sidebar text-sidebar-foreground shadow-lg rounded-r-2xl">
        {/* App logo */}
        <div className="flex items-center justify-center h-16 border-b border-sidebar-border/30">
          <div className="flex items-center">
            <img
              src={logo}
              alt="Company Logo"
              className="h-10 w-auto object-contain filter brightness-0 invert"
            />
          </div>
        </div>

        <div className="flex flex-col flex-grow overflow-y-auto">
          {/* Main navigation */}
          <SidebarSection title="Main" />
          <nav className="flex-1 px-2 py-2 space-y-1">
            <SidebarLink
              href="/dashboard"
              icon={<Home />}
              isActive={location === "/dashboard"}
            >
              Dashboard
            </SidebarLink>

            <SidebarLink
              href="/jobs"
              icon={<Briefcase />}
              isActive={location.startsWith("/jobs")}
              badge={statsData?.totalJobs}
            >
              Jobs
            </SidebarLink>

            <SidebarLink
              href="/candidates"
              icon={<Users />}
              isActive={location.startsWith("/candidates")}
              badge={statsData?.totalCandidates}
            >
              Candidates
            </SidebarLink>

            <SidebarLink
              href="/submissions"
              icon={<ClipboardList />}
              isActive={location.startsWith("/submissions")}
              badge={statsData?.totalSubmissions}
            >
              Submissions
            </SidebarLink>

            <SidebarLink
              href="/profile-record"
              icon={<UserCheck />}
              isActive={location.startsWith("/profile-record")}
            >
              Profile Record
            </SidebarLink>
          </nav>

          {/* Admin section - only show for admin users */}
          {user?.role === "admin" && (
            <>
              <SidebarSection title="Administration" />
              <nav className="flex-1 px-2 py-2 space-y-1">
                <SidebarLink
                  href="/organization"
                  icon={<Building2 />}
                  isActive={location.startsWith("/organization")}
                >
                  Organization
                </SidebarLink>
              </nav>
            </>
          )}

          {/* Reports section - can be extended later */}
          <SidebarSection title="Reports" />
          <nav className="flex-1 px-2 py-2 space-y-1">
            <SidebarLink
              href="/reports"
              icon={<BarChart4 />}
              isActive={location.startsWith("/reports")}
            >
              Analytics
            </SidebarLink>
          </nav>

          {/* Settings section */}
          <SidebarSection title="Account" />
          <nav className="flex-1 px-2 py-2 space-y-1">
            <SidebarLink
              href="/settings"
              icon={<Settings />}
              isActive={location.startsWith("/settings")}
            >
              Settings
            </SidebarLink>
          </nav>

          {/* Quick Action */}
          <div className="px-4 py-4 mt-auto">
            <CreateJobDialog buttonVariant="default" />
          </div>
        </div>

        {/* User profile section */}
        <div className="p-4 border-t border-sidebar-border/30">
          <div className="flex items-center">
            <div className="h-10 w-10 rounded-full bg-primary/90 flex items-center justify-center text-white font-bold shadow-md">
              JD
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-sidebar-foreground">
                {user?.name || "User"}
              </p>
              <p className="text-xs font-medium text-sidebar-foreground/60 capitalize">
                {user?.role || "Role"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
