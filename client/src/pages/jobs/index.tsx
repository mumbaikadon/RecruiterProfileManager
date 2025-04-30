import React, { useState } from "react";
import { useJobs } from "@/hooks/use-jobs";
import { useSubmissions } from "@/hooks/use-submissions";
import JobTable from "@/components/job/job-table";
import JobFilter from "@/components/job/job-filter";
import CreateJobDialog from "@/components/job/create-job-dialog";

const JobsPage: React.FC = () => {
  const [filters, setFilters] = useState<{
    status?: string;
    date?: string;
    search?: string;
  }>({});

  // Fetch jobs with filters
  const { data: jobs, isLoading } = useJobs(filters);
  
  // Fetch all submissions to count per job
  const { data: submissions } = useSubmissions();
  
  // Calculate submission counts per job
  const submissionCounts: Record<number, number> = {};
  submissions?.forEach((submission: { jobId: number }) => {
    submissionCounts[submission.jobId] = (submissionCounts[submission.jobId] || 0) + 1;
  });
  
  // Get assigned recruiters for each job
  const [assignedRecruiters, setAssignedRecruiters] = React.useState<Record<number, { id: number; name: string }[]>>({});
  
  // Process job assignments when data is available
  React.useEffect(() => {
    if (jobs) {
      const fetchAssignedRecruiters = async () => {
        const recruitersMap: Record<number, { id: number; name: string }[]> = {};
        
        // Process each job to get assigned recruiters
        for (const job of jobs) {
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
  }, [jobs]);
  
  const handleFilterChange = (newFilters: {
    status?: string;
    date?: string;
    search?: string;
  }) => {
    setFilters(newFilters);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">Jobs</h2>
          <p className="mt-1 text-sm text-muted-foreground">View and manage all job listings</p>
        </div>
        <div className="mt-4 md:mt-0">
          <CreateJobDialog />
        </div>
      </div>

      <div className="bg-card shadow overflow-hidden sm:rounded-lg border border-border">
        <div className="px-4 py-5 sm:px-6 border-b border-border">
          <JobFilter onFilterChange={handleFilterChange} />
        </div>
        <JobTable 
          jobs={jobs || []} 
          assignedRecruiters={assignedRecruiters}
          submissionCounts={submissionCounts}
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
};

export default JobsPage;
