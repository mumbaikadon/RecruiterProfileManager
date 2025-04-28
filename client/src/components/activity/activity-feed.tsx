import React from "react";
import { 
  CheckCircle, 
  UserPlus, 
  AlertTriangle,
  Bell,
  Briefcase
} from "lucide-react";
import { formatTimeAgo } from "@/lib/date-utils";

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
      <div className="text-center py-8 text-gray-500">
        No activity to display.
      </div>
    );
  }

  const getIconForActivity = (type: string) => {
    switch (type) {
      case "job_created":
        return <Briefcase className="h-6 w-6 text-white" />;
      case "candidate_submitted":
        return <UserPlus className="h-6 w-6 text-white" />;
      case "status_changed":
        return <CheckCircle className="h-6 w-6 text-white" />;
      case "duplicate_detected":
        return <AlertTriangle className="h-6 w-6 text-white" />;
      default:
        return <Bell className="h-6 w-6 text-white" />;
    }
  };

  const getColorForActivity = (type: string) => {
    switch (type) {
      case "job_created":
        return "bg-primary";
      case "candidate_submitted":
        return "bg-primary";
      case "status_changed":
        return "bg-amber-500";
      case "duplicate_detected":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadgeForActivity = (type: string) => {
    switch (type) {
      case "job_created":
      case "candidate_submitted":
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
            New
          </p>
        );
      case "status_changed":
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
            Updated
          </p>
        );
      case "duplicate_detected":
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
            Alert
          </p>
        );
      default:
        return (
          <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            Info
          </p>
        );
    }
  };

  return (
    <ul className="divide-y divide-gray-200">
      {activities.map((activity) => (
        <li key={activity.id} className="px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                className={`flex-shrink-0 h-10 w-10 ${getColorForActivity(
                  activity.type
                )} rounded-full flex items-center justify-center`}
              >
                {getIconForActivity(activity.type)}
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                {activity.job && (
                  <p className="text-sm text-gray-500">
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
            <div className="sm:flex">
              {activity.candidate && (
                <>
                  <p className="flex items-center text-sm text-gray-500">
                    <svg
                      className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {activity.candidate.location}
                  </p>
                  {activity.candidate.workAuthorization && (
                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                      <svg
                        className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
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
            <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
              <svg
                className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p>{formatTimeAgo(activity.createdAt)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default ActivityFeed;
