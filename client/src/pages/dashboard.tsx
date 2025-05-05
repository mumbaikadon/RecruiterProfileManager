import React from "react";
import { useLocation } from "wouter";
import { 
  Briefcase, 
  Users, 
  Calendar,
  Clock,
  TrendingUp,
  ArrowRight,
  Search,
  Filter,
  ChevronDown,
  Plus
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Dashboard: React.FC = () => {
  const [filterDate, setFilterDate] = React.useState<Date | undefined>(undefined);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [_, setLocation] = useLocation();
  const [activeTab, setActiveTab] = React.useState("overview");
  
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
  const [assignedRecruiters, setAssignedRecruiters] = React.useState<Record<number, { id: number; name: string }[]>>({});
  
  // Process job assignments when data is available
  React.useEffect(() => {
    if (allJobs) {
      const fetchAssignedRecruiters = async () => {
        const recruitersMap: Record<number, { id: number; name: string }[]> = {};
        
        // Process each job to get assigned recruiters
        for (const job of allJobs) {
          if (job.id) {
            try {
              // Fetch the complete job data including assignments
              const jobResponse = await fetch(`/api/jobs/${job.id}`);
              if (jobResponse.ok) {
                const jobData = await jobResponse.json();
                if (jobData.assignedRecruiters && jobData.assignedRecruiters.length > 0) {
                  recruitersMap[job.id] = jobData.assignedRecruiters.map((r: any) => ({
                    id: r.id,
                    name: r.name || r.username
                  }));
                }
              }
            } catch (error) {
              console.error(`Error fetching job details for ${job.id}:`, error);
            }
          }
        }
        
        // Update state with all fetched recruiters
        setAssignedRecruiters(recruitersMap);
      };
      
      fetchAssignedRecruiters();
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
    <div className="space-y-8">
      {/* Page Header with modern design */}
      <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Dashboard
          </h1>
          <p className="mt-1.5 text-muted-foreground max-w-2xl">
            Overview of recruitment metrics, recent activity, and job listings
          </p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center">
          {/* Date Filter */}
          <div className="w-full sm:w-auto">
            <DatePicker 
              date={filterDate} 
              onDateChange={handleDateChange} 
              placeholder="Filter by date" 
              className="w-full"
            />
          </div>
          
          {/* Create Job Button */}
          <CreateJobDialog>
            <Button className="w-full sm:w-auto gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              Create Job
            </Button>
          </CreateJobDialog>
        </div>
      </div>
      
      {/* Dashboard Tabs */}
      <Tabs defaultValue="overview" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-8">
          {/* Stats Section - improved with new stat card design */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Active Jobs" 
              value={isLoadingStats ? "Loading..." : statsData?.activeJobs.toString() || "0"} 
              icon={<Briefcase />} 
              color="primary" 
              change={!isLoadingStats && statsData ? { value: 12, type: "increase" } : undefined}
              subtitle="Total active job listings"
            />
            
            <StatCard 
              title="Submissions" 
              value={isLoadingStats ? "Loading..." : statsData?.totalSubmissions.toString() || "0"} 
              icon={<Users />} 
              color="secondary" 
              change={!isLoadingStats && statsData ? { value: 8, type: "increase" } : undefined}
              subtitle="Total candidate submissions"
            />
            
            <StatCard 
              title="Assigned Jobs" 
              value={isLoadingStats ? "Loading..." : statsData?.assignedActiveJobs?.toString() || "0"}
              icon={<TrendingUp />} 
              color="amber" 
              change={!isLoadingStats && statsData ? { value: 5, type: "increase" } : undefined}
              subtitle="Jobs with recruiters assigned"
            />
            
            <StatCard 
              title="This Week" 
              value={isLoadingStats ? "Loading..." : statsData?.submissionsThisWeek?.toString() || "0"} 
              icon={<Clock />} 
              color="accent" 
              change={!isLoadingStats && statsData ? { value: 15, type: "increase" } : undefined}
              subtitle="Recent candidate submissions"
            />
          </div>
          
          {/* Dual Grid Layout for Jobs and Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Jobs Section */}
            <Card className="lg:col-span-2 shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
                <div>
                  <CardTitle>Recent Jobs</CardTitle>
                  <CardDescription>
                    Active job listings and their current status
                  </CardDescription>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {/* Search input with styled design */}
                  <div className="relative w-full sm:w-auto flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Input 
                      type="text" 
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-9 py-2 w-full rounded-full"
                      placeholder="Search jobs..." 
                    />
                  </div>
                  
                  {/* Filter dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="gap-1 rounded-full">
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                        <ChevronDown className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>All Jobs</DropdownMenuItem>
                      <DropdownMenuItem>Active Only</DropdownMenuItem>
                      <DropdownMenuItem>With Candidates</DropdownMenuItem>
                      <DropdownMenuItem>Assigned to Me</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="p-0 pt-2">
                <div className="table-container">
                  <JobTable 
                    jobs={jobsData?.slice(0, 5) || []} 
                    submissionCounts={submissionCounts}
                    assignedRecruiters={assignedRecruiters}
                    isLoading={isLoadingJobs} 
                  />
                </div>
                
                <div className="bg-muted/20 px-4 py-3 flex justify-center border-t border-border">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleViewAllJobs} 
                    className="transition-all duration-200 hover:bg-primary/10 rounded-full gap-1"
                  >
                    View All Jobs
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* Recent Activity Section */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates and submissions</CardDescription>
              </CardHeader>
              <CardContent className="p-0 pt-2">
                <div className="border-t border-border">
                  <ActivityFeed 
                    activities={activitiesData || []} 
                    isLoading={isLoadingActivities} 
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="performance">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Detailed metrics will be displayed here in the next update.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Performance charts coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Dashboard</CardTitle>
              <CardDescription>
                Detailed analytics will be displayed here in the next update.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80 flex items-center justify-center">
              <p className="text-muted-foreground">Analytics charts coming soon</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Dashboard;
