import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCreateSubmission } from "@/hooks/use-submissions";
import { useCandidateValidation } from "@/hooks/use-candidate-validation";
import { sanitizeHtml } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CandidateForm, { CandidateFormValues } from "@/components/candidate/candidate-form";
import CandidateValidationDialog from "@/components/candidate/candidate-validation-dialog";
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
  onSuccess?: () => void;
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
  onSuccess,
}) => {
  const { mutate: createSubmission, isPending } = useCreateSubmission();
  const { mutate: validateCandidate, isPending: isValidating } = useCandidateValidation();
  const { toast } = useToast();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [existingCandidate, setExistingCandidate] = useState<{
    id: number;
    name: string;
    previousSubmissions?: PreviousSubmissionInfo[];
  } | null>(null);
  
  // State for validation dialog
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [validationData, setValidationData] = useState<{
    candidateId: number;
    candidateName: string;
    resumeFileName?: string;
    existingResumeData: {
      id: number;
      clientNames: string[];
      jobTitles: string[];
      relevantDates: string[];
    };
    newResumeData: {
      clientNames: string[];
      jobTitles: string[];
      relevantDates: string[];
    };
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
      // Check if resume data is too large (greater than 40MB)
      const resumeDataSize = JSON.stringify(values.resumeData || {}).length;
      if (resumeDataSize > 40 * 1024 * 1024) {
        setSubmissionError("Resume file is too large. Please use a smaller file (under 40MB).");
        toast({
          title: "File too large",
          description: "Your resume file exceeds the maximum size limit. Please use a smaller file.",
          variant: "destructive",
        });
        return;
      }
      
      const candidateResponse = await fetch("/api/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          createdBy: recruiterId,
          jobId: jobId, // Pass jobId to check for candidate duplication within the same job
          resumeData: values.resumeData,
        }),
      });
      
      // Check if response is JSON or HTML (error page)
      const contentType = candidateResponse.headers.get("content-type");
      if (contentType && !contentType.includes("application/json")) {
        setSubmissionError("Server error: The resume file may be too large. Please try with a smaller file.");
        toast({
          title: "Upload failed",
          description: "The server returned an error. The resume file may be too large.",
          variant: "destructive",
        });
        return;
      }
      
      // Handle candidate already exists case
      if (candidateResponse.status === 409) {
        let data;
        try {
          data = await candidateResponse.json();
        } catch (error) {
          console.error("Error parsing response:", error);
          setSubmissionError("Failed to parse server response. Please try again.");
          return;
        }
        
        if (data.candidateId) {
          // Get candidate details
          const candidateDetailsResponse = await fetch(`/api/candidates/${data.candidateId}`);
          let candidateName = "Existing Candidate";
          let existingResumeData = null;
          
          if (candidateDetailsResponse.ok) {
            try {
              const candidateDetails = await candidateDetailsResponse.json();
              candidateName = `${candidateDetails.firstName} ${candidateDetails.lastName}`;
              existingResumeData = candidateDetails.resumeData;
            } catch (error) {
              console.error("Error parsing candidate details:", error);
            }
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
          
          // Always open validation dialog for duplicate candidates
          // First prepare the existing and new resume data
          const existingData = {
            id: existingResumeData?.id || 0,
            clientNames: existingResumeData?.clientNames || [],
            jobTitles: existingResumeData?.jobTitles || [],
            relevantDates: existingResumeData?.relevantDates || []
          };
          
          const newData = {
            clientNames: values.resumeData?.clientNames || [],
            jobTitles: values.resumeData?.jobTitles || [],
            relevantDates: values.resumeData?.relevantDates || []
          };
          
          // Log validation data for debugging
          console.log("Opening validation dialog with data:", {
            existingData,
            newData
          });
          
          // Open validation dialog for the duplicate candidate
          setValidationData({
            candidateId: data.candidateId,
            candidateName,
            resumeFileName: values.resumeData?.fileName || "Resume",
            existingResumeData: existingData,
            newResumeData: newData
          });
          setValidationDialogOpen(true);
          return;
        }
      } else if (candidateResponse.status === 202) {
        // Handle validation required case
        console.log("Status 202: Validation required - Processing validation response");
        
        let data;
        try {
          const responseText = await candidateResponse.text();
          console.log("Raw 202 response:", responseText);
          
          try {
            data = JSON.parse(responseText);
            console.log("Parsed validation data:", data);
          } catch (parseError) {
            console.error("JSON parse error:", parseError);
            throw new Error("Failed to parse validation data: " + parseError.message);
          }
        } catch (error) {
          console.error("Error getting 202 response text:", error);
          throw new Error("Failed to retrieve validation data. Please try again.");
        }
        
        if (data.candidateId) {
          console.log("Validation candidate ID found:", data.candidateId);
          
          // Get candidate name
          const candidateDetailsResponse = await fetch(`/api/candidates/${data.candidateId}`);
          let candidateName = "Existing Candidate";
          
          if (candidateDetailsResponse.ok) {
            try {
              const details = await candidateDetailsResponse.json();
              candidateName = `${details.firstName} ${details.lastName}`;
              console.log("Got candidate name:", candidateName);
            } catch (error) {
              console.error("Error getting candidate details:", error);
            }
          } else {
            console.error("Failed to get candidate details:", candidateDetailsResponse.status);
          }
          
          // Check that we have all the necessary data for validation
          if (data.existingResumeData && data.newResumeData) {
            console.log("Opening validation dialog with data:", {
              candidateId: data.candidateId,
              candidateName,
              existingResume: {
                clientNames: data.existingResumeData.clientNames?.length || 0,
                jobTitles: data.existingResumeData.jobTitles?.length || 0
              },
              newResume: {
                clientNames: data.newResumeData.clientNames?.length || 0,
                jobTitles: data.newResumeData.jobTitles?.length || 0
              }
            });
            
            // Open validation dialog with the data
            setValidationData({
              candidateId: data.candidateId,
              candidateName,
              resumeFileName: values.resumeData?.fileName || "Resume",
              existingResumeData: data.existingResumeData,
              newResumeData: data.newResumeData
            });
            
            // Important: Set dialog state to open AFTER setting the data
            setValidationDialogOpen(true);
            return;
          } else {
            console.warn("Validation required but missing resume data fields:", data);
            
            // Handle case where we have candidateId but not complete resume data
            // Try to use the new resume data we have as a fallback
            if (values.resumeData && (values.resumeData.clientNames?.length > 0 || values.resumeData.jobTitles?.length > 0)) {
              console.log("Using fallback resume data from form values");
              
              // Create empty data structures for the missing pieces
              const existingData = data.existingResumeData || {
                id: 0,
                clientNames: [],
                jobTitles: [],
                relevantDates: []
              };
              
              const newData = data.newResumeData || {
                clientNames: values.resumeData.clientNames || [],
                jobTitles: values.resumeData.jobTitles || [],
                relevantDates: values.resumeData.relevantDates || []
              };
              
              // Open validation dialog with best-effort data
              setValidationData({
                candidateId: data.candidateId,
                candidateName,
                resumeFileName: values.resumeData?.fileName || "Resume",
                existingResumeData: existingData,
                newResumeData: newData
              });
              setValidationDialogOpen(true);
              return;
            }
          }
        } else {
          console.error("Validation response missing candidateId:", data);
        }
        
        // If we couldn't handle the validation properly, show a generic error
        throw new Error(data.message || "Candidate exists but validation data is incomplete");
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
        status: "New",
        agreedRate: values.agreedRate,
        matchScore: values.matchResults?.score || null,
        notes: "",
      }, {
        onSuccess: () => {
          toast({
            title: "Submission successful",
            description: "The candidate has been submitted for this job.",
          });
          if (onSuccess) onSuccess();
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

  // The validation result is now handled directly in the validateCandidate wrapper

  return (
    <>
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
            isPending={isPending || isValidating}
          />
        </DialogContent>
      </Dialog>

      {/* Validation Dialog */}
      {validationDialogOpen && validationData && (
        <CandidateValidationDialog
          isOpen={validationDialogOpen}
          onClose={() => {
            setValidationDialogOpen(false);
            // No need to create a submission here - the validateCandidate function takes care of it
          }}
          candidateId={validationData.candidateId}
          candidateName={validationData.candidateName}
          jobId={jobId}
          jobTitle={jobTitle}
          existingResumeData={validationData.existingResumeData}
          newResumeData={validationData.newResumeData}
          validationType="resubmission"
          resumeFileName={validationData.resumeFileName}
          validateCandidate={(data) => {
            return new Promise((resolve, reject) => {
              validateCandidate({...data, validatedBy: recruiterId}, {
                onSuccess: () => {
                  // If validation was successful and candidate is matching, create a submission
                  if (data.validationResult === "matching") {
                    createSubmission({
                      jobId,
                      candidateId: data.candidateId,
                      recruiterId,
                      status: "New",
                      agreedRate: 0, // For now, using a placeholder value
                      matchScore: null,
                      notes: "",
                    }, {
                      onSuccess: () => {
                        toast({
                          title: "Submission successful",
                          description: `${data.candidateId ? "Candidate" : ""} was validated and submitted for ${jobTitle}`,
                        });
                        if (onSuccess) onSuccess();
                        resolve(true);
                      },
                      onError: (error) => {
                        setSubmissionError(error.message);
                        toast({
                          title: "Submission failed",
                          description: error.message,
                          variant: "destructive",
                        });
                        reject(error);
                      }
                    });
                  } else {
                    // Just show a toast for unreal candidates
                    toast({
                      title: "Candidate marked as unreal",
                      description: "The candidate has been flagged as potentially fraudulent in the system.",
                    });
                    resolve(true);
                  }
                },
                onError: (error) => {
                  setSubmissionError(error.message);
                  toast({
                    title: "Validation failed",
                    description: error.message,
                    variant: "destructive",
                  });
                  reject(error);
                }
              });
            });
          }}
          validatedBy={recruiterId}
        />
      )}
    </>
  );
};

export default SubmissionDialog;
