import React from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Eye, MapPin, Briefcase } from "lucide-react";

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
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    reviewing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    closed: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
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
      <div className="text-center py-8 text-muted-foreground">
        No jobs found. Create a new job to get started.
      </div>
    );
  }

  return (
    <div>
      <div className="table-container overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-[120px]">Job ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="hidden md:table-cell">Created</TableHead>
              <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
              <TableHead className="hidden md:table-cell">Submissions</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow 
                key={job.id} 
                className="cursor-pointer border-border transition-colors duration-200 hover:bg-accent/5"
                onClick={() => handleRowClick(job.id)}
              >
                <TableCell className="font-medium">{job.jobId}</TableCell>
                <TableCell className="font-medium md:font-normal">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip defaultOpen={false}>
                      <TooltipTrigger asChild>
                        <span 
                          className="cursor-help border-b border-dotted border-muted-foreground inline-block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {job.title}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" align="start" className="bg-background border border-border shadow-md p-3 max-w-xs z-50">
                        <div className="space-y-2">
                          <h4 className="font-semibold">{job.title}</h4>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Briefcase className="h-4 w-4 mr-2" />
                            <span className="capitalize">{job.jobType || 'Unspecified'}</span>
                          </div>
                          {(job.city || job.state) && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="h-4 w-4 mr-2" />
                              <span>{[job.city, job.state].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                          {job.clientFocus && (
                            <div className="text-sm mt-2">
                              <span className="font-medium">Key Focus:</span> {job.clientFocus}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {formatDate(job.createdAt)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {assignedRecruiters[job.id] && assignedRecruiters[job.id].length > 0 ? (
                    <div className="flex -space-x-2 overflow-hidden">
                      {assignedRecruiters[job.id].slice(0, 3).map((recruiter) => (
                        <div 
                          key={recruiter.id} 
                          className="inline-block h-6 w-6 rounded-full ring-2 ring-background bg-primary/10 flex items-center justify-center text-xs font-bold text-primary"
                          title={recruiter.name}
                        >
                          {recruiter.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {submissionCounts[job.id] || 0}
                </TableCell>
                <TableCell>
                  <span className={cn(
                    "px-2 inline-flex text-xs leading-5 font-semibold rounded-full", 
                    statusColors[job.status] || "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                  )}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary hover:text-primary/80 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowClick(job.id);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">View</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination (static for now) */}
      <div className="bg-card dark:bg-card px-4 py-3 flex items-center justify-between border-t border-border">
        <div className="flex-1 flex justify-between sm:hidden">
          <Button variant="outline" size="sm" disabled>Previous</Button>
          <Button variant="outline" size="sm" disabled>Next</Button>
        </div>
        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">1</span> to <span className="font-medium text-foreground">{jobs.length}</span> of <span className="font-medium text-foreground">{jobs.length}</span> results
            </p>
          </div>
          <div>
            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
              <Button variant="outline" size="sm" className="rounded-l-md" disabled>
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="bg-primary border-primary text-white">
                1
              </Button>
              <Button variant="outline" size="sm" className="rounded-r-md" disabled>
                <span className="sr-only">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobTable;
