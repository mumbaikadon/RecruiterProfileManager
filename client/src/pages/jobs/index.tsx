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
  submissions?.forEach((submission) => {
    submissionCounts[submission.jobId] = (submissionCounts[submission.jobId] || 0) + 1;
  });
  
  // Process assigned recruiters from job assignments
  // This would need an additional API call in a real implementation
  // For now we'll use an empty object
  const assignedRecruiters: Record<number, { id: number; name: string }[]> = {};
  
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
          <h2 className="text-2xl font-semibold text-gray-900">Jobs</h2>
          <p className="mt-1 text-sm text-gray-500">View and manage all job listings</p>
        </div>
        <div className="mt-4 md:mt-0">
          <CreateJobDialog />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
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
