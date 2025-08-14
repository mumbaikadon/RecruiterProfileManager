import React, { useState } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight, Eye, MapPin, DollarSign, Calendar, Users, Shield, Edit, Download, Package } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Job } from "@shared/schema";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface JobTableProps {
  jobs: Job[];
  assignedRecruiters?: Record<number, { id: number; name: string }[]>;
  submissionCounts?: Record<number, number>;
  isLoading?: boolean;
  onEdit?: (job: Job) => void;
}

const JobTable: React.FC<JobTableProps> = ({ 
  jobs, 
  assignedRecruiters = {}, 
  submissionCounts = {},
  isLoading = false,
  onEdit
}) => {
  const [_, setLocation] = useLocation();
  const [downloadingJob, setDownloadingJob] = useState<number | null>(null);

  const handleRowClick = (jobId: number) => {
    setLocation(`/jobs/${jobId}`);
  };

  const handleBulkDownload = async (jobId: number, jobTitle: string) => {
    setDownloadingJob(jobId);
    try {
      const response = await fetch(`/api/jobs/${jobId}/download-all`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(errorData.message || `Download failed: ${response.status}`);
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or create one
      const disposition = response.headers.get('Content-Disposition');
      let filename = `Job_${jobId}_Candidates.zip`;
      if (disposition && disposition.includes('filename=')) {
        const matches = disposition.match(/filename="?([^"]+)"?/);
        if (matches && matches[1]) {
          filename = matches[1];
        }
      }
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Failed to download candidates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDownloadingJob(null);
    }
  };

  // Job details tooltip content
  const JobTooltip: React.FC<{ job: Job }> = ({ job }) => (
    <div className="space-y-3 p-1 max-w-sm">
      <div>
        <h4 className="font-semibold text-sm mb-1">{job.title}</h4>
        <p className="text-xs text-muted-foreground">ID: {job.jobId}</p>
      </div>
      
      {(job.city || job.state) && (
        <div className="flex items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-muted-foreground" />
          <span>{[job.city, job.state].filter(Boolean).join(", ")}</span>
        </div>
      )}
      
      {job.rate && (
        <div className="flex items-center gap-2 text-xs">
          <DollarSign className="h-3 w-3 text-muted-foreground" />
          <span>{job.rate}</span>
        </div>
      )}
      
      {job.interviewType && (
        <div className="flex items-center gap-2 text-xs">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span>{job.interviewType} interview</span>
        </div>
      )}
      
      {job.visaRestrictions && (
        <div className="flex items-center gap-2 text-xs">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span>{job.visaRestrictions}</span>
        </div>
      )}
      
      {job.requiredSkills && job.requiredSkills.length > 0 && (
        <div className="text-xs">
          <p className="font-medium mb-1">Skills:</p>
          <div className="flex flex-wrap gap-1">
            {job.requiredSkills.slice(0, 5).map((skill, index) => (
              <span key={index} className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs">
                {skill}
              </span>
            ))}
            {job.requiredSkills.length > 5 && (
              <span className="text-muted-foreground">+{job.requiredSkills.length - 5} more</span>
            )}
          </div>
        </div>
      )}
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3 w-3" />
        <span>Created {formatDate(job.createdAt)}</span>
      </div>
    </div>
  );

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
    <TooltipProvider>
      <div>
        <div className="table-container overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[120px]">Job ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden lg:table-cell">Client</TableHead>
                <TableHead className="hidden lg:table-cell">IMPL/PV</TableHead>
                <TableHead className="hidden lg:table-cell">Visa Restrictions</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="hidden lg:table-cell">Assigned To</TableHead>
                <TableHead className="hidden md:table-cell">Submissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <Tooltip key={job.id} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <TableRow 
                      className="cursor-pointer border-border transition-colors duration-200 hover:bg-accent/5"
                      onClick={() => handleRowClick(job.id)}
                    >
                      <TableCell className="font-medium">{job.jobId}</TableCell>
                      <TableCell className="font-medium md:font-normal">{job.title}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {job.client || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {job.implOrPv || <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {job.visaRestrictions ? (
                          <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200">
                            {job.visaRestrictions}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                        <div className="flex items-center justify-end gap-2">
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
                          {job.status.toLowerCase() === 'active' && (submissionCounts[job.id] || 0) > 0 && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-green-600 hover:text-green-700 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBulkDownload(job.id, job.title);
                              }}
                              disabled={downloadingJob === job.id}
                            >
                              {downloadingJob === job.id ? (
                                <Package className="h-4 w-4 mr-1 animate-pulse" />
                              ) : (
                                <Download className="h-4 w-4 mr-1" />
                              )}
                              <span className="hidden sm:inline">
                                {downloadingJob === job.id ? 'Downloading...' : 'Download All'}
                              </span>
                            </Button>
                          )}
                          {onEdit && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-orange-600 hover:text-orange-700 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEdit(job);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              <span className="hidden sm:inline">Edit</span>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="z-50">
                    <JobTooltip job={job} />
                  </TooltipContent>
                </Tooltip>
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
    </TooltipProvider>
  );
};

export default JobTable;
