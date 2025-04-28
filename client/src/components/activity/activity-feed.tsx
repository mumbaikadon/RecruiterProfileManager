import React from "react";
import { 
  CheckCircle, 
  UserPlus, 
  AlertTriangle,
  Bell,
  Briefcase,
  MapPin,
  Shield,
  Clock
} from "lucide-react";
import { formatTimeAgo } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: number;
  type: string;
  userId?: number;
  jobId?: number;
  candidateId?: number;
  submissionId?: number;
  message: string;
  createdAt: string;
  user?: {
    id: number;
    name: string;
  };
  job?: {
    id: number;
    jobId: string;
    title: string;
  };
  candidate?: {
    id: number;
    firstName: string;
    lastName: string;
    location: string;
    workAuthorization: string;
  };
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No activity to display.
      </div>
    );
  }

  const getIconForActivity = (type: string) => {
    switch (type) {
      case "job_created":
        return <Briefcase className="h-5 w-5 text-white" />;
      case "candidate_submitted":
        return <UserPlus className="h-5 w-5 text-white" />;
      case "status_changed":
        return <CheckCircle className="h-5 w-5 text-white" />;
      case "duplicate_detected":
        return <AlertTriangle className="h-5 w-5 text-white" />;
      default:
        return <Bell className="h-5 w-5 text-white" />;
    }
  };

  const getColorForActivity = (type: string) => {
    switch (type) {
      case "job_created":
        return "bg-blue-500 dark:bg-blue-600";
      case "candidate_submitted":
        return "bg-blue-500 dark:bg-blue-600";
      case "status_changed":
        return "bg-purple-500 dark:bg-purple-600";
      case "duplicate_detected":
        return "bg-red-500 dark:bg-red-600";
      default:
        return "bg-slate-500 dark:bg-slate-600";
    }
  };

  const getStatusBadgeForActivity = (type: string) => {
    switch (type) {
      case "job_created":
      case "candidate_submitted":
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            New
          </p>
        );
      case "status_changed":
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
            Updated
          </p>
        );
      case "duplicate_detected":
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            Alert
          </p>
        );
      default:
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
            Info
          </p>
        );
    }
  };

  return (
    <ul className="divide-y divide-border">
      {activities.map((activity) => (
        <li key={activity.id} className="px-4 py-4 sm:px-6 transition-colors duration-200 hover:bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={cn(
                  "flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center shadow-sm",
                  getColorForActivity(activity.type)
                )}
              >
                {getIconForActivity(activity.type)}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-foreground">{activity.message}</p>
                {activity.job && (
                  <p className="text-sm text-muted-foreground">
                    {activity.job.title} • {activity.job.jobId}
                  </p>
                )}
              </div>
            </div>
            <div className="ml-2 flex-shrink-0 flex">
              {getStatusBadgeForActivity(activity.type)}
            </div>
          </div>
          <div className="mt-2 sm:flex sm:justify-between">
            <div className="sm:flex flex-wrap gap-x-6 gap-y-2">
              {activity.candidate && (
                <>
                  <p className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="flex-shrink-0 mr-1.5 h-4 w-4 text-muted-foreground/70" />
                    {activity.candidate.location}
                  </p>
                  {activity.candidate.workAuthorization && (
                    <p className="mt-2 flex items-center text-sm text-muted-foreground sm:mt-0">
                      <Shield className="flex-shrink-0 mr-1.5 h-4 w-4 text-muted-foreground/70" />
                      {activity.candidate.workAuthorization === "citizen"
                        ? "US Citizen"
                        : activity.candidate.workAuthorization === "green-card"
                        ? "Green Card"
                        : activity.candidate.workAuthorization === "h1b"
                        ? "H1-B Visa"
                        : activity.candidate.workAuthorization === "ead"
                        ? "EAD"
                        : activity.candidate.workAuthorization}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="mt-2 flex items-center text-sm text-muted-foreground sm:mt-0">
              <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-muted-foreground/70" />
              <p>{formatTimeAgo(activity.createdAt)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ActivityFeed;
