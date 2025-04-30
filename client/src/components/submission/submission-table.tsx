import React from "react";
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
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmissionTableProps {
  submissions: (Submission & {
    job?: { id: number; jobId: string; title: string };
    candidate?: { id: number; firstName: string; lastName: string; location: string };
    recruiter?: { id: number; name: string };
  })[];
  isLoading?: boolean;
}

const SubmissionTable: React.FC<SubmissionTableProps> = ({
  submissions,
  isLoading = false,
}) => {
  const [_, setLocation] = useLocation();

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

  return (
    <div className="overflow-x-auto">
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
                    <div className="font-medium">
                      {submission.candidate.firstName} {submission.candidate.lastName}
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
                    compact={true}
                  />
                </div>
              </TableCell>
              <TableCell className="text-right">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default SubmissionTable;
