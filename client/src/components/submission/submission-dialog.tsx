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
import ResumeChangesDialog from "@/components/candidate/resume-changes-dialog";
import RateChangeDialog from "@/components/submission/rate-change-dialog";
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
    // Add suspicious fields for tracking potential fraud
    isSuspicious?: boolean;
    suspiciousReason?: string;
    suspiciousSeverity?: "LOW" | "MEDIUM" | "HIGH";
  } | null>(null);

  // State for rate change dialog
  const [rateChangeDialogOpen, setRateChangeDialogOpen] = useState(false);
  const [rateChangeData, setRateChangeData] = useState<{
    candidateName: string;
    currentRate: number;
    previousSubmissions: PreviousSubmissionInfo[];
    pendingSubmissionData: any;
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
      
      // Log recruiter assignment for debugging
      console.log(`=== RECRUITER ASSIGNMENT DEBUG ===`);
      console.log(`Job ID: ${jobId}, Job Title: ${jobTitle}`);
      console.log(`Using recruiter ID: ${recruiterId}`);
      console.log(`=====================================`);
      
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

          // Always ask for rate confirmation when resubmitting existing candidates
          const currentRate = parseFloat(String(values.agreedRate || '0'));
          
          // Show rate confirmation dialog for any existing candidate resubmission
          setRateChangeData({
            candidateName,
            currentRate,
            previousSubmissions,
            pendingSubmissionData: {
              candidateId: data.candidateId,
              values,
              existingResumeData,
              validationRequired: true
            }
          });
          setRateChangeDialogOpen(true);
          return;
          
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
      
      // Now create the submission with validation support
      console.log(`=== CREATING SUBMISSION ===`);
      console.log(`jobId: ${jobId}, candidateId: ${candidateData.id}, recruiterId: ${recruiterId}`);
      console.log(`recruiterId type: ${typeof recruiterId}`);
      
      const submissionPayload = {
        jobId,
        candidateId: candidateData.id,
        recruiterId: Number(recruiterId),
        status: "New",
        agreedRate: values.agreedRate,
        matchScore: values.matchResults?.score || null,
        notes: "",
        // Include resume data for validation if available
        resumeData: values.resumeData
      };
      
      const submissionResponse = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionPayload),
      });
      
      // Handle validation required response (202)
      if (submissionResponse.status === 202) {
        console.log("🚨 202 STATUS RECEIVED - Submission validation required!");
        console.log("Response status:", submissionResponse.status);
        console.log("Response headers:", submissionResponse.headers);
        
        let validationData;
        try {
          validationData = await submissionResponse.json();
          console.log("Received validation data:", validationData);
        } catch (parseError) {
          console.error("Error parsing validation response:", parseError);
          throw new Error("Failed to parse validation response");
        }
        
        // Get candidate name for validation dialog
        const candidateDetailsResponse = await fetch(`/api/candidates/${validationData.candidateId}`);
        let candidateName = "Existing Candidate";
        
        if (candidateDetailsResponse.ok) {
          try {
            const candidateDetails = await candidateDetailsResponse.json();
            candidateName = `${candidateDetails.firstName} ${candidateDetails.lastName}`;
          } catch (error) {
            console.error("Error parsing candidate details:", error);
          }
        }
        
        // Set validation data for dialog
        const dialogData = {
          candidateId: validationData.candidateId,
          candidateName,
          resumeFileName: values.resumeData?.fileName || "Resume",
          existingResumeData: validationData.existingResumeData,
          newResumeData: validationData.newResumeData,
          changes: validationData.comparison?.changes || [],
          isSuspicious: validationData.isSuspicious || false,
          suspiciousReason: validationData.suspiciousReason,
          suspiciousSeverity: validationData.suspiciousSeverity
        };
        
        console.log("🎯 Setting validation dialog data:", dialogData);
        setValidationData(dialogData);
        console.log("🎯 Opening validation dialog...");
        setValidationDialogOpen(true);
        console.log("🎯 Validation dialog state set to true");
        return;
      }
      
      if (!submissionResponse.ok) {
        let errorMessage = "Failed to create submission";
        try {
          const errorData = await submissionResponse.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error("Error parsing submission error:", parseError);
        }
        throw new Error(errorMessage);
      }
      
      // Submission successful
      toast({
        title: "Submission successful",
        description: "The candidate has been submitted for this job.",
      });
      if (onSuccess) onSuccess();
      onClose();
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

  // Handler for rate change confirmation
  const handleRateChangeContinue = () => {
    setRateChangeDialogOpen(false);
    if (rateChangeData?.pendingSubmissionData) {
      const { candidateId, values, existingResumeData, validationRequired } = rateChangeData.pendingSubmissionData;
      
      if (validationRequired) {
        // Continue with validation dialog after rate confirmation
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
        
        setValidationData({
          candidateId,
          candidateName: rateChangeData.candidateName,
          resumeFileName: values.resumeData?.fileName || "Resume",
          existingResumeData: existingData,
          newResumeData: newData,
        });
        setValidationDialogOpen(true);
      }
    }
    setRateChangeData(null);
  };

  const handleRateChangeCancel = () => {
    setRateChangeDialogOpen(false);
    setRateChangeData(null);
  };

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

      {/* Resume Changes Validation Dialog */}
      {validationDialogOpen && validationData && (
        <ResumeChangesDialog
          isOpen={validationDialogOpen}
          onClose={() => {
            setValidationDialogOpen(false);
            setValidationData(null);
          }}
          candidateId={validationData.candidateId}
          candidateName={validationData.candidateName}
          jobId={jobId}
          jobTitle={jobTitle}
          comparison={{
            hasChanges: true,
            significantChanges: true,
            changes: validationData.changes || [],
            addedCompanies: [],
            removedCompanies: [],
            addedJobTitles: [],
            removedJobTitles: [],
            addedDates: [],
            removedDates: []
          }}
          resumeFileName={validationData.resumeFileName}
          onProceed={(flagAsSuspicious, reason, severity) => {
            console.log("🎯 User confirmed to proceed with submission");
            // Close the validation dialog
            setValidationDialogOpen(false);
            setValidationData(null);
            
            // Now proceed with creating the submission
            toast({
              title: "Submission successful",
              description: "The candidate has been submitted despite resume changes.",
            });
            if (onSuccess) onSuccess();
            onClose();
          }}
          onCancel={() => {
            console.log("🎯 User cancelled submission due to resume changes");
            setValidationDialogOpen(false);
            setValidationData(null);
            toast({
              title: "Submission cancelled",
              description: "Submission was cancelled due to resume changes.",
            });
          }}
        />
      )}

      {/* Rate Change Dialog */}
      {rateChangeDialogOpen && rateChangeData && (
        <RateChangeDialog
          isOpen={rateChangeDialogOpen}
          onClose={handleRateChangeCancel}
          onContinue={handleRateChangeContinue}
          candidateName={rateChangeData.candidateName}
          currentRate={rateChangeData.currentRate}
          previousSubmissions={rateChangeData.previousSubmissions}
        />
      )}
    </>
  );
};

export default SubmissionDialog;
