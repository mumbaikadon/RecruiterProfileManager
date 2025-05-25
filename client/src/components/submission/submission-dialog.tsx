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
  initialCandidateData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    dobMonth?: string;
    dobDay?: string;
    ssn4?: string;
    workAuthorization?: string;
    agreedRate?: number;
  };
  applicationResumeFileName?: string;
  applicationId?: number; // ID of the application being processed
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
  initialCandidateData,
  applicationResumeFileName,
  applicationId,
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
    // Add suspicious fields for tracking potential fraud
    isSuspicious?: boolean;
    suspiciousReason?: string;
    suspiciousSeverity?: "LOW" | "MEDIUM" | "HIGH";
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

  // Function to mark an application as processed
  const markApplicationAsProcessed = async (applicationId: number) => {
    try {
      const response = await fetch(`/api/applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'processed',
          notes: 'Candidate successfully submitted to recruitment process'
        }),
      });
      
      if (!response.ok) {
        console.error('Failed to mark application as processed:', response.status);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error marking application as processed:', error);
      return false;
    }
  };

  const handleSubmit = async (values: CandidateFormValues & { 
    resumeData?: any;
    matchResults?: any;
    existingResumeFileName?: string;
  }) => {
    try {
      setSubmissionError(null);
      
      // Check if we have an existing resume from application
      if (values.existingResumeFileName && !values.resumeData) {
        console.log("Using existing resume from application:", values.existingResumeFileName);
        
        // Set a simplified resumeData structure since we're using an existing file
        values.resumeData = {
          fileName: values.existingResumeFileName,
          fromApplication: true
        };
      }
      
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
        
        // Check if this is a duplicate submission (candidate already submitted to this job)
        if (data.submissionId) {
          setSubmissionError("This candidate has already been submitted for this job");
          toast({
            title: "Duplicate submission",
            description: "This candidate has already been submitted for this job",
            variant: "destructive",
          });
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
          
          // Double-check if this candidate is already submitted to this job
          // This is a safety check since the backend should have already returned submissionId if there was a duplicate
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
          
          // Check if this is a duplicate employment history match
          if (data.matchedWithCandidateId && data.matchedWithCandidateName) {
            setSubmissionError(`Employment history matches with existing candidate: ${data.matchedWithCandidateName}`);
            toast({
              title: "Duplicate employment history",
              description: `This resume has employment history that matches existing candidate: ${data.matchedWithCandidateName}`,
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
          
          // Open validation dialog for the duplicate candidate with suspicious flags if available
          setValidationData({
            candidateId: data.candidateId,
            candidateName,
            resumeFileName: values.resumeData?.fileName || "Resume",
            existingResumeData: existingData,
            newResumeData: newData,
            // Add any suspicious flags if they exist
            isSuspicious: data.isSuspicious || false,
            suspiciousReason: data.suspiciousReason,
            suspiciousSeverity: data.suspiciousSeverity
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
          } catch (parseError: any) {
            console.error("JSON parse error:", parseError);
            throw new Error("Failed to parse validation data: " + parseError.toString());
          }
          
          // Check if there was a parse error but we got a parseable response
          if (!data || typeof data !== 'object') {
            console.error("Invalid data structure in 202 response:", data);
            throw new Error("Invalid validation data structure received from server");
          }
          
        } catch (error: any) {
          console.error("Error handling 202 response:", error);
          setSubmissionError("Error processing validation data: " + error.toString());
          toast({
            title: "Validation Error",
            description: "Failed to process validation data. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
        if (!data.candidateId) {
          console.error("Missing candidate ID in validation data:", data);
          setSubmissionError("Missing candidate ID in validation response");
          toast({
            title: "Validation Error",
            description: "The validation response is missing required data. Please try again.",
            variant: "destructive",
          });
          return;
        }
        
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
        
        // Always ensure we have data structures to work with - create defaults if missing
        const existingData = data.existingResumeData || {
          id: 0,
          clientNames: [],
          jobTitles: [],
          relevantDates: []
        };
        
        // Create a safe version of existing data with arrays
        const safeExistingData = {
          id: existingData.id || 0,
          clientNames: Array.isArray(existingData.clientNames) ? existingData.clientNames : [],
          jobTitles: Array.isArray(existingData.jobTitles) ? existingData.jobTitles : [],
          relevantDates: Array.isArray(existingData.relevantDates) ? existingData.relevantDates : []
        };
        
        // Use form resume data if server didn't provide new resume data
        const sourceNewData = data.newResumeData || values.resumeData || {};
        
        // Create a safe version of new data with arrays
        const safeNewData = {
          clientNames: Array.isArray(sourceNewData.clientNames) ? sourceNewData.clientNames : [],
          jobTitles: Array.isArray(sourceNewData.jobTitles) ? sourceNewData.jobTitles : [],
          relevantDates: Array.isArray(sourceNewData.relevantDates) ? sourceNewData.relevantDates : []
        };
        
        console.log("Opening validation dialog with processed data:", {
          candidateId: data.candidateId,
          candidateName,
          existingData: {
            id: safeExistingData.id,
            clientNames: safeExistingData.clientNames.length,
            jobTitles: safeExistingData.jobTitles.length,
            relevantDates: safeExistingData.relevantDates.length
          },
          newData: {
            clientNames: safeNewData.clientNames.length,
            jobTitles: safeNewData.jobTitles.length,
            relevantDates: safeNewData.relevantDates.length
          }
        });
        
        // Open validation dialog with the safe data and suspicious flags if available
        setValidationData({
          candidateId: data.candidateId,
          candidateName,
          resumeFileName: values.resumeData?.fileName || "Resume",
          existingResumeData: safeExistingData,
          newResumeData: safeNewData,
          // Include suspicious flags if they exist in the validation data
          isSuspicious: data.isSuspicious || false,
          suspiciousReason: data.suspiciousReason,
          suspiciousSeverity: data.suspiciousSeverity
        });
        
        // Important: Set dialog state to open AFTER setting the data
        console.log("Opening validation dialog");
        setValidationDialogOpen(true);
        return;
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
        agreedRate: parseFloat(values.agreedRate.toString()),
        matchScore: values.matchResults?.score || null,
        notes: "",
      }, {
        onSuccess: async () => {
          // Mark the application as processed if it came from an application
          if (applicationId) {
            const marked = await markApplicationAsProcessed(applicationId);
            if (marked) {
              toast({
                title: "Application processed",
                description: "The application has been marked as processed and will be removed from the pending list.",
              });
            }
          }
          
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
            initialValues={initialCandidateData}
            applicationResumeFileName={applicationResumeFileName || undefined}
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
          // Pass suspicious flags from validation data
          isSuspicious={validationData.isSuspicious}
          suspiciousReason={validationData.suspiciousReason}
          suspiciousSeverity={validationData.suspiciousSeverity}
          validateCandidate={(data) => {
            return new Promise((resolve, reject) => {
              validateCandidate({...data, validatedBy: recruiterId}, {
                onSuccess: (response) => {
                  console.log("Validation response:", response);
                  
                  // Check if a submission was already created during validation
                  const submissionAlreadyCreated = response.submission && response.submission.id;
                  
                  // If validation was successful and candidate is matching
                  if (data.validationResult === "matching") {
                    if (submissionAlreadyCreated) {
                      // Submission was already created in the backend during validation
                      console.log("Submission was already created during validation with ID:", submissionAlreadyCreated);
                      toast({
                        title: "Submission successful",
                        description: `Candidate has been validated and submitted for ${jobTitle}`,
                      });
                      if (onSuccess) onSuccess();
                      resolve(true);
                      return; // Important: return early to avoid duplicate submission
                    }
                    
                    // Only create submission if one wasn't already created during validation
                    createSubmission({
                      jobId,
                      candidateId: data.candidateId,
                      recruiterId,
                      status: "New",
                      agreedRate: parseFloat(values.agreedRate.toString()), // Use actual agreed rate with decimal precision
                      matchScore: null,
                      notes: "",
                      // Pass suspicious flags if they exist in validation data
                      isSuspicious: !!data.isSuspicious,
                      suspiciousReason: data.suspiciousReason || null,
                      suspiciousSeverity: data.suspiciousSeverity || null,
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
                        // Check if this is a "candidate already submitted" error (409 Conflict)
                        if (error.message && (
                            error.message.includes("already submitted") || 
                            error.message.includes("already in our past submitted list") ||
                            error.message.includes("Conflict")
                          )) {
                          console.log("Detected existing submission - this candidate was already submitted to this job");
                          // Treat this as a success since the submission exists
                          toast({
                            title: "Submission already exists",
                            description: `This candidate has already been submitted for ${jobTitle}`,
                          });
                          if (onSuccess) onSuccess();
                          resolve(true);
                          return;
                        }
                        
                        // Otherwise, show the real error
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
