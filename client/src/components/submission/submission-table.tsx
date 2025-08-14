import React, { useState } from "react";
import { useLocation } from "wouter";
import { formatDate, formatRate } from "@/lib/date-utils";
import { Submission } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/submission/status-badge";
import StatusSelect from "@/components/submission/status-select";
import SuspiciousBadge from "@/components/submission/suspicious-badge";
import ResubmitDialog from "@/components/candidate/resubmit-dialog";
import { Eye, RefreshCw, Download } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmissionTableProps {
  submissions: (Submission & {
    job?: { id: number; jobId: string; title: string; status: string };
    candidate?: { 
      id: number; 
      firstName: string; 
      middleName?: string;
      lastName: string; 
      location: string;
      isSuspicious?: boolean;
      suspiciousReason?: string | null;
      suspiciousSeverity?: string | null;
      isUnreal?: boolean;
      unrealReason?: string | null;
    };
    recruiter?: { id: number; name: string; username?: string };
  })[];
  isLoading?: boolean;
}

const SubmissionTable: React.FC<SubmissionTableProps> = ({
  submissions,
  isLoading = false,
}) => {
  const [_, setLocation] = useLocation();
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<{ id: number, name: string } | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No submissions found.
      </div>
    );
  }

  // Handle closing the resubmit dialog
  const handleCloseResubmitDialog = () => {
    setResubmitDialogOpen(false);
    setSelectedCandidate(null);
  };

  // Handle resume download
  const handleDownloadResume = async (candidateId: number, candidateName: string) => {
    try {
      const response = await fetch(`/api/candidates/resume/${candidateId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          alert('Resume file not found. The candidate may not have uploaded a resume.');
          return;
        }
        throw new Error(`Failed to download resume: ${response.status}`);
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${candidateName.replace(/\s+/g, '_')}_resume`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download resume. Please try again.');
    }
  };

  return (
    <>
      <div className="table-container overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Job</TableHead>
              <TableHead className="hidden md:table-cell">Candidate</TableHead>
              <TableHead className="hidden md:table-cell">Submitted By</TableHead>
              <TableHead className="hidden sm:table-cell">Submitted On</TableHead>
              <TableHead className="hidden lg:table-cell">Rate</TableHead>
              <TableHead className="hidden lg:table-cell">Match Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.map((submission) => (
              <TableRow 
                key={submission.id} 
                className="cursor-pointer border-border transition-colors duration-200 hover:bg-accent/5"
                onClick={() => setLocation(`/submissions/${submission.id}`)}
              >
                <TableCell>
                  {submission.job ? (
                    <div className="font-medium">
                      <div>{submission.job.title}</div>
                      <div className="text-xs text-muted-foreground">{submission.job.jobId}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unknown Job</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {submission.candidate ? (
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {submission.candidate.firstName} {submission.candidate.lastName}
                        {/* Show suspicious badge for flagged submissions */}
                        {submission.isSuspicious && (
                          <SuspiciousBadge 
                            isSuspicious={!!submission.isSuspicious}
                            suspiciousReason={submission.suspiciousReason}
                            suspiciousSeverity={submission.suspiciousSeverity}
                            size="sm"
                          />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{submission.candidate.location}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Unknown Candidate</span>
                  )}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {submission.recruiter ? (
                    submission.recruiter.name
                  ) : (
                    <span className="text-muted-foreground">Unknown</span>
                  )}
                </TableCell>
                <TableCell className="hidden sm:table-cell">{formatDate(submission.submittedAt)}</TableCell>
                <TableCell className="hidden lg:table-cell">
                  {formatRate(submission.agreedRate)}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {submission.matchScore ? (
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div 
                          className={cn("h-2 rounded-full", {
                            "bg-green-500": submission.matchScore >= 80,
                            "bg-yellow-500": submission.matchScore >= 60 && submission.matchScore < 80,
                            "bg-red-500": submission.matchScore < 60,
                          })}
                          style={{ width: `${submission.matchScore}%` }}
                        ></div>
                      </div>
                      <span className="font-medium">{submission.matchScore}%</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">65%</span>
                  )}
                </TableCell>
                <TableCell>
                  <div onClick={(e) => e.stopPropagation()}>
                    <StatusSelect 
                      submissionId={submission.id} 
                      currentStatus={submission.status}
                      currentFeedback={submission.feedback}
                      compact={true}
                    />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary/80 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/submissions/${submission.id}`);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">View</span>
                    </Button>

                    {submission.candidate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "transition-colors",
                          submission.job?.status === "Active" 
                            ? "text-green-600 hover:text-green-700" 
                            : "text-gray-400 cursor-not-allowed"
                        )}
                        disabled={submission.job?.status !== "Active"}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (submission.candidate && submission.job?.status === "Active") {
                            handleDownloadResume(
                              submission.candidate.id, 
                              `${submission.candidate.firstName} ${submission.candidate.lastName}`
                            );
                          }
                        }}
                        title={
                          submission.job?.status !== "Active" 
                            ? "Download is only available for Active jobs" 
                            : "Download resume"
                        }
                      >
                        <Download className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Download</span>
                      </Button>
                    )}
                    
                    {submission.candidate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary hover:text-primary/80 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (submission.candidate) {
                            setSelectedCandidate({
                              id: submission.candidate.id,
                              name: `${submission.candidate.firstName} ${submission.candidate.lastName}`
                            });
                            setResubmitDialogOpen(true);
                          }
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Resubmit</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Resubmit Dialog */}
      {selectedCandidate && (
        <ResubmitDialog
          isOpen={resubmitDialogOpen}
          onClose={handleCloseResubmitDialog}
          candidateId={selectedCandidate.id}
          candidateName={selectedCandidate.name}
        />
      )}
    </>
  );
};

export default SubmissionTable;