import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCreateSubmission } from "@/hooks/use-submissions";
import { sanitizeHtml } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CandidateForm, { CandidateFormValues } from "@/components/candidate/candidate-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatRate } from "@/lib/date-utils";

interface SubmissionDialogProps {
  jobId: number;
  jobTitle: string;
  jobDescription: string;
  recruiterId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface PreviousSubmissionInfo {
  submissionId: number;
  jobTitle?: string;
  submittedDate?: string;
  agreedRate?: number;
  clientNames?: string[];
  status?: string;
}

const SubmissionDialog: React.FC<SubmissionDialogProps> = ({
  jobId,
  jobTitle,
  jobDescription,
  recruiterId,
  isOpen,
  onClose,
}) => {
  const { mutate: createSubmission, isPending } = useCreateSubmission();
  const { toast } = useToast();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [existingCandidate, setExistingCandidate] = useState<{
    id: number;
    name: string;
    previousSubmissions?: PreviousSubmissionInfo[];
  } | null>(null);

  // Function to get previous submission info for a candidate
  const getPreviousSubmissions = async (candidateId: number) => {
    try {
      const response = await fetch(`/api/submissions?candidateId=${candidateId}`);
      if (!response.ok) {
        console.error("Failed to fetch previous submissions");
        return [];
      }
      
      const submissions = await response.json();
      
      // Get job details for each submission
      const submissionsWithJobs = await Promise.all(submissions.map(async (sub: any) => {
        try {
          const jobResponse = await fetch(`/api/jobs/${sub.jobId}`);
          if (jobResponse.ok) {
            const job = await jobResponse.json();
            return {
              submissionId: sub.id,
              jobTitle: job.title,
              submittedDate: sub.submittedAt,
              agreedRate: sub.agreedRate,
              status: sub.status,
            };
          }
        } catch (err) {
          console.error("Error fetching job details:", err);
        }
        
        return {
          submissionId: sub.id,
          submittedDate: sub.submittedAt,
          agreedRate: sub.agreedRate,
          status: sub.status,
        };
      }));
      
      return submissionsWithJobs;
    } catch (error) {
      console.error("Error getting previous submissions:", error);
      return [];
    }
  };

  const handleSubmit = async (values: CandidateFormValues & { 
    resumeData?: any;
    matchResults?: any;
  }) => {
    try {
      setSubmissionError(null);
      
      // First create candidate with resumeData
      const candidateResponse = await fetch("/api/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          createdBy: recruiterId,
          resumeData: values.resumeData,
        }),
      });
      
      // Handle candidate already exists case
      if (candidateResponse.status === 409) {
        const data = await candidateResponse.json();
        
        if (data.candidateId) {
          // Get candidate details
          const candidateDetailsResponse = await fetch(`/api/candidates/${data.candidateId}`);
          let candidateName = "Existing Candidate";
          
          if (candidateDetailsResponse.ok) {
            const candidateDetails = await candidateDetailsResponse.json();
            candidateName = `${candidateDetails.firstName} ${candidateDetails.lastName}`;
          }
          
          // Get previous submissions for this candidate
          const previousSubmissions = await getPreviousSubmissions(data.candidateId);
          
          // Check if this candidate is already submitted to this job
          const alreadySubmittedToThisJob = previousSubmissions.some(
            sub => sub.submissionId && sub.jobTitle === jobTitle
          );
          
          if (alreadySubmittedToThisJob) {
            setSubmissionError(`${candidateName} has already been submitted for job: ${jobTitle}`);
            toast({
              title: "Duplicate submission",
              description: `This candidate has already been submitted for ${jobTitle}`,
              variant: "destructive",
            });
            return;
          }
          
          // Set existing candidate state to show previous submission info
          setExistingCandidate({
            id: data.candidateId,
            name: candidateName,
            previousSubmissions: previousSubmissions
          });
          
          // Proceed with submission for existing candidate
          createSubmission({
            jobId,
            candidateId: data.candidateId,
            recruiterId,
            status: "new",
            agreedRate: values.agreedRate,
            matchScore: values.matchResults?.score || null,
            notes: "",
          }, {
            onSuccess: () => {
              toast({
                title: "Submission successful",
                description: `${candidateName} has been submitted for ${jobTitle}`,
              });
              onClose();
            },
            onError: (error) => {
              // Handle specific error for duplicate submission
              if (error.message.includes("already been submitted")) {
                setSubmissionError(`${candidateName} has already been submitted for this job.`);
                toast({
                  title: "Duplicate submission",
                  description: "This candidate has already been submitted for this job.",
                  variant: "destructive",
                });
              } else {
                setSubmissionError(error.message);
                toast({
                  title: "Submission failed",
                  description: error.message,
                  variant: "destructive",
                });
              }
            },
          });
          return;
        }
      } else if (!candidateResponse.ok) {
        // Handle other errors
        try {
          const errorData = await candidateResponse.json();
          throw new Error(errorData.message || "Failed to create candidate");
        } catch (parseError) {
          throw new Error("Failed to create candidate: Invalid response format");
        }
      }

      // If we get here, candidate was created successfully
      let candidateData;
      try {
        candidateData = await candidateResponse.json();
      } catch (parseError) {
        console.error("Error parsing candidate response:", parseError);
        throw new Error("Failed to parse candidate data. The response may contain invalid characters.");
      }
      
      // Now create the submission
      createSubmission({
        jobId,
        candidateId: candidateData.id,
        recruiterId,
        status: "new",
        agreedRate: values.agreedRate,
        matchScore: values.matchResults?.score || null,
        notes: "",
      }, {
        onSuccess: () => {
          toast({
            title: "Submission successful",
            description: "The candidate has been submitted for this job.",
          });
          onClose();
        },
        onError: (error) => {
          setSubmissionError(error.message);
          toast({
            title: "Submission failed",
            description: error.message,
            variant: "destructive",
          });
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      setSubmissionError(message);
      toast({
        title: "Submission failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Candidate</DialogTitle>
          <DialogDescription>
            Submit a candidate for {jobTitle}
          </DialogDescription>
        </DialogHeader>

        {submissionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4">
            {submissionError}
          </div>
        )}

        {existingCandidate && existingCandidate.previousSubmissions && existingCandidate.previousSubmissions.length > 0 && (
          <Card className="mb-4 bg-amber-50 border-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Previous Submissions for {existingCandidate.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-3">
                {existingCandidate.previousSubmissions.map((submission, index) => (
                  <div key={index} className="border-b border-amber-200 pb-2 last:border-0">
                    <div className="flex justify-between">
                      <div>
                        <p className="font-medium">{submission.jobTitle || "Unknown Job"}</p>
                        <p className="text-xs text-muted-foreground">
                          Submitted: {submission.submittedDate ? formatDate(submission.submittedDate) : "Unknown date"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{submission.agreedRate ? formatRate(submission.agreedRate) : "Rate N/A"}</p>
                        <Badge variant={submission.status === "accepted" ? "success" : 
                                      submission.status === "rejected" ? "destructive" : "secondary"} 
                               className="text-xs">
                          {submission.status || "Unknown"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-3">
                Consider using similar or higher rates from previous submissions when negotiating.
              </p>
            </CardContent>
          </Card>
        )}

        <CandidateForm
          jobId={jobId}
          jobTitle={jobTitle}
          jobDescription={sanitizeHtml(jobDescription)}
          onSubmit={handleSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionDialog;
