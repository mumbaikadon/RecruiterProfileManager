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
      <div className="text-center py-8 text-gray-500">
        No submissions found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Job</TableHead>
            <TableHead>Candidate</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead>Submitted On</TableHead>
            <TableHead>Rate</TableHead>
            <TableHead>Match Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => (
            <TableRow key={submission.id} className="hover:bg-gray-50">
              <TableCell>
                {submission.job ? (
                  <div className="font-medium">
                    <div>{submission.job.title}</div>
                    <div className="text-xs text-gray-500">{submission.job.jobId}</div>
                  </div>
                ) : (
                  <span className="text-gray-500">Unknown Job</span>
                )}
              </TableCell>
              <TableCell>
                {submission.candidate ? (
                  <div>
                    <div className="font-medium">
                      {submission.candidate.firstName} {submission.candidate.lastName}
                    </div>
                    <div className="text-xs text-gray-500">{submission.candidate.location}</div>
                  </div>
                ) : (
                  <span className="text-gray-500">Unknown Candidate</span>
                )}
              </TableCell>
              <TableCell>
                {submission.recruiter ? (
                  submission.recruiter.name
                ) : (
                  <span className="text-gray-500">Unknown</span>
                )}
              </TableCell>
              <TableCell>{formatDate(submission.submittedAt)}</TableCell>
              <TableCell>
                {submission.agreedRate ? (
                  formatRate(submission.agreedRate)
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </TableCell>
              <TableCell>
                {submission.matchScore ? (
                  <span className="font-medium">{submission.matchScore}%</span>
                ) : (
                  <span className="text-gray-500">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={submission.status} />
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => setLocation(`/submissions/${submission.id}`)}
                >
                  View
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
