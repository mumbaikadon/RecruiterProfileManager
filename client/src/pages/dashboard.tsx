import React from "react";
import { useLocation } from "wouter";
import { 
  Briefcase, 
  Users, 
  Calendar, 
  CheckCircle,
  ArrowRight,
  Search
} from "lucide-react";
import { useDashboardStats, useSubmissions, useActivities } from "@/hooks/use-submissions";
import { useJobs } from "@/hooks/use-jobs";
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
  
  // Fetch all submissions to count per job
  const { data: submissions } = useSubmissions();
  
  // Calculate submission counts per job
  const submissionCounts: Record<number, number> = {};
  submissions?.forEach((submission: { jobId: number }) => {
    submissionCounts[submission.jobId] = (submissionCounts[submission.jobId] || 0) + 1;
  });
  
  // Get assigned recruiters for each job
  const { data: allJobs } = useJobs();
  const assignedRecruiters: Record<number, { id: number; name: string }[]> = {};
  
  // Process job assignments when data is available
  React.useEffect(() => {
    if (allJobs) {
      allJobs.forEach(async (job) => {
        if (job.id) {
          try {
            // Fetch the complete job data including assignments
            const jobResponse = await fetch(`/api/jobs/${job.id}`);
            if (jobResponse.ok) {
              const jobData = await jobResponse.json();
              if (jobData.assignedRecruiters && jobData.assignedRecruiters.length > 0) {
                assignedRecruiters[job.id] = jobData.assignedRecruiters.map((r: any) => ({
                  id: r.id,
                  name: r.name || r.username
                }));
              }
            }
          } catch (error) {
            console.error(`Error fetching job details for ${job.id}:`, error);
          }
        }
      });
    }
  }, [allJobs]);
  
  // Fetch recent activities
  const { data: activitiesData, isLoading: isLoadingActivities } = useActivities(10);
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  const handleDateChange = (date: Date | undefined) => {
    setFilterDate(date);
  };
  
  const handleViewAllJobs = () => {
    setLocation("/jobs");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your jobs, candidates, and submissions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <div className="w-full sm:w-60">
            <DatePicker 
              date={filterDate} 
              onDateChange={handleDateChange} 
              placeholder="Filter by date" 
            />
          </div>
          <CreateJobDialog />
        </div>
      </div>
      
      {/* Stats Section */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          title="Assigned Active Jobs" 
          value={isLoadingStats ? "Loading..." : statsData?.assignedActiveJobs?.toString() || "0"}
          icon={<Briefcase />} 
          color="amber" 
        />
        
        <StatCard 
          title="Submissions This Week" 
          value={isLoadingStats ? "Loading..." : statsData?.submissionsThisWeek?.toString() || "0"} 
          icon={<Calendar />} 
          color="accent" 
        />
      </div>
      
      {/* Recent Jobs Section */}
      <div className="bg-card dark:bg-card shadow overflow-hidden rounded-lg border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-6">
          <div>
            <h3 className="text-lg font-medium text-foreground">Recent Jobs</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Active job listings and their current status</p>
          </div>
          <div className="relative w-full sm:w-auto">
            <Input 
              type="text" 
              value={searchTerm}
              onChange={handleSearchChange}
              className="pl-10 pr-3 py-2 w-full"
              placeholder="Search jobs..." 
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>
        
        <JobTable 
          jobs={jobsData?.slice(0, 5) || []} 
          submissionCounts={submissionCounts}
          assignedRecruiters={assignedRecruiters}
          isLoading={isLoadingJobs} 
        />
        
        <div className="bg-muted/30 px-4 py-3 flex justify-center border-t border-border">
          <Button variant="outline" size="sm" onClick={handleViewAllJobs} className="transition-all duration-200 hover:bg-primary/10">
            View All Jobs
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Recent Activity Section */}
      <div className="bg-card dark:bg-card shadow overflow-hidden rounded-lg border border-border">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium text-foreground">Recent Activity</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Latest candidate submissions and updates</p>
        </div>
        <div className="border-t border-border">
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
