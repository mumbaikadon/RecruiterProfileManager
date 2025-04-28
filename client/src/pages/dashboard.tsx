import React from "react";
import { useLocation } from "wouter";
import { 
  Briefcase, 
  Users, 
  Calendar, 
  CheckCircle,
  ArrowRight
} from "lucide-react";
import { useDashboardStats } from "@/hooks/use-submissions";
import { useJobs } from "@/hooks/use-jobs";
import { useActivities } from "@/hooks/use-submissions";
import StatCard from "@/components/stats/stat-card";
import JobTable from "@/components/job/job-table";
import ActivityFeed from "@/components/activity/activity-feed";
import CreateJobDialog from "@/components/job/create-job-dialog";
import DatePicker from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const Dashboard: React.FC = () => {
  const [filterDate, setFilterDate] = React.useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [_, setLocation] = useLocation();
  
  // Fetch dashboard stats
  const { data: statsData, isLoading: isLoadingStats } = useDashboardStats();
  
  // Fetch recent jobs
  const { data: jobsData, isLoading: isLoadingJobs } = useJobs({
    date: filterDate?.toISOString().split('T')[0],
    search: searchTerm
  });
  
  // Fetch recent activities
  const { data: activitiesData, isLoading: isLoadingActivities } = useActivities(10);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleDateChange = (date: Date | undefined) => {
    setFilterDate(date);
  };
  
  const handleViewAllJobs = () => {
    navigate("/jobs");
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">Manage your jobs, candidates, and submissions</p>
        </div>
        <div className="mt-4 md:mt-0">
          <div className="flex space-x-2">
            <div className="relative w-60">
              <DatePicker 
                date={filterDate} 
                onDateChange={handleDateChange} 
                placeholder="Filter by date" 
              />
            </div>
            <CreateJobDialog />
          </div>
        </div>
      </div>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard 
          title="Active Jobs" 
          value={isLoadingStats ? "Loading..." : statsData?.activeJobs.toString() || "0"} 
          icon={<Briefcase />} 
          color="primary" 
        />
        
        <StatCard 
          title="Submissions" 
          value={isLoadingStats ? "Loading..." : statsData?.totalSubmissions.toString() || "0"} 
          icon={<Users />} 
          color="secondary" 
        />
        
        <StatCard 
          title="New Today" 
          value={isLoadingStats ? "Loading..." : statsData?.newToday.toString() || "0"} 
          icon={<Calendar />} 
          color="amber" 
        />
        
        <StatCard 
          title="Success Rate" 
          value={isLoadingStats ? "Loading..." : `${statsData?.successRate || 0}%`} 
          icon={<CheckCircle />} 
          color="accent" 
        />
      </div>
      
      {/* Recent Jobs Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
        <div className="flex items-center justify-between px-4 py-5 sm:px-6">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Jobs</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">Active job listings and their current status</p>
          </div>
          <div>
            <div className="flex space-x-2 items-center">
              <div className="relative">
                <Input 
                  type="text" 
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 pr-3 py-2"
                  placeholder="Search jobs..." 
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <JobTable 
          jobs={jobsData?.slice(0, 5) || []} 
          isLoading={isLoadingJobs} 
        />
        
        <div className="bg-gray-50 px-4 py-3 flex justify-center border-t border-gray-200">
          <Button variant="outline" size="sm" onClick={handleViewAllJobs}>
            View All Jobs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Recent Activity Section */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900">Recent Activity</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Latest candidate submissions and updates</p>
        </div>
        <div className="border-t border-gray-200">
          <ActivityFeed 
            activities={activitiesData || []} 
            isLoading={isLoadingActivities} 
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
