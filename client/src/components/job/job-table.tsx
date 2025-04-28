import React from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Job } from "@shared/schema";
import { formatDate } from "@/lib/date-utils";

interface JobTableProps {
  jobs: Job[];
  assignedRecruiters?: Record<number, { id: number; name: string }[]>;
  submissionCounts?: Record<number, number>;
  isLoading?: boolean;
}

const JobTable: React.FC<JobTableProps> = ({ 
  jobs, 
  assignedRecruiters = {}, 
  submissionCounts = {},
  isLoading = false
}) => {
  const [_, setLocation] = useLocation();

  const handleRowClick = (jobId: number) => {
    setLocation(`/jobs/${jobId}`);
  };

  // Status badge color mapping
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    reviewing: "bg-yellow-100 text-yellow-800",
    closed: "bg-gray-100 text-gray-800",
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No jobs found. Create a new job to get started.
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Assigned To</TableHead>
              <TableHead>Submissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow 
                key={job.id} 
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => handleRowClick(job.id)}
              >
                <TableCell className="font-medium">{job.jobId}</TableCell>
                <TableCell>{job.title}</TableCell>
                <TableCell>{formatDate(job.createdAt)}</TableCell>
                <TableCell>
                  {assignedRecruiters[job.id] && assignedRecruiters[job.id].length > 0 ? (
                    <div className="flex -space-x-2 overflow-hidden">
                      {assignedRecruiters[job.id].slice(0, 3).map((recruiter, index) => (
                        <div 
                          key={recruiter.id} 
                          className="inline-block h-6 w-6 rounded-full ring-2 ring-white bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-600"
                          title={recruiter.name}
                        >
                          {recruiter.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">None</span>
                  )}
                </TableCell>
                <TableCell>{submissionCounts[job.id] || 0}</TableCell>
                <TableCell>
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[job.status] || "bg-gray-100 text-gray-800"}`}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(job.id);
                    }}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination (static for now) */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button variant="outline" size="sm">Previous</Button>
          <Button variant="outline" size="sm">Next</Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{jobs.length}</span> of <span className="font-medium">{jobs.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <Button variant="outline" size="sm" className="rounded-l-md">
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="outline" size="sm" className="bg-primary border-primary text-white">
                1
              </Button>
              <Button variant="outline" size="sm" className="rounded-r-md">
                <span className="sr-only">Next</span>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobTable;
