import React, { useState } from "react";
import { useJobs } from "@/hooks/use-jobs";
import { useSubmissions } from "@/hooks/use-submissions";
import JobTable from "@/components/job/job-table";
import JobFilter from "@/components/job/job-filter";
import CreateJobDialog from "@/components/job/create-job-dialog";
import EditJobDialog from "@/components/job/edit-job-dialog";
import { Job } from "@shared/schema";

const JobsPage: React.FC = () => {
  const [filters, setFilters] = useState<{
    status?: string;
    date?: string;
    search?: string;
  }>({});
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Fetch jobs with filters - now includes assignedRecruiters and submissionCount
  const { data: jobs, isLoading } = useJobs(filters);
  
  const handleFilterChange = (newFilters: {
    status?: string;
    date?: string;
    search?: string;
  }) => {
    setFilters(newFilters);
  };

  const handleEditJob = (job: Job) => {
    setEditingJob(job);
  };

  const handleCloseEditDialog = () => {
    setEditingJob(null);
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
          isLoading={isLoading} 
          onEdit={handleEditJob}
        />
      </div>
      
      {/* Edit Job Dialog */}
      {editingJob && (
        <EditJobDialog
          job={editingJob}
          isOpen={true}
          onClose={handleCloseEditDialog}
        />
      )}
    </div>
  );
};

export default JobsPage;
