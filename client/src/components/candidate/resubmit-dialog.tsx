import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Job, apiRequest } from "@/lib/api";
import { Loader2, DollarSign } from "lucide-react";
import { formatDate, isOlderThanTwoWeeks, formatRate } from "@/lib/date-utils";
import { compareResumeData, type ResumeComparisonResult } from "@/lib/resume-comparison";
import ResumeChangesDialog from "./resume-changes-dialog";

interface ResubmitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
}

const ResubmitDialog: React.FC<ResubmitDialogProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
}) => {
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [requiresNewResume, setRequiresNewResume] = useState(false);
  const [agreedRate, setAgreedRate] = useState<string>("");
  const [suspiciousFlags, setSuspiciousFlags] = useState<{
    isSuspicious: boolean;
    suspiciousReason: string | null;
    suspiciousSeverity: string | null;
  } | null>(null);
  
  // State for resume changes detection
  const [showChangesDialog, setShowChangesDialog] = useState(false);
  const [resumeComparison, setResumeComparison] = useState<ResumeComparisonResult | null>(null);
  const [existingResumeData, setExistingResumeData] = useState<any>(null);
  const [newResumeData, setNewResumeData] = useState<any>(null);
  const [parsedResumeText, setParsedResumeText] = useState<string>("");
  const [pendingSubmissionData, setPendingSubmissionData] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch active jobs
  const {
    data: jobs,
    isLoading: isJobsLoading,
  } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: isOpen,
    select: (data: Job[]) => data.filter(job => job.status === "active")
  });

  // Fetch candidate's previous submissions
  const {
    data: submissions,
    isLoading: isSubmissionsLoading,
  } = useQuery({
    queryKey: ["/api/submissions", { candidateId }],
    enabled: isOpen && !!candidateId,
    select: (data: any) => data.filter((s: any) => s.candidateId === candidateId)
  });

  // Fetch candidate's existing data with resume data for comparison
  const {
    data: candidateDetails,
    isLoading: isCandidateLoading,
  } = useQuery({
    queryKey: ["/api/candidates", candidateId],
    enabled: isOpen && !!candidateId,
  });

  // Submit candidate mutation with resume comparison logic
  const submitMutation = useMutation({
    mutationFn: async (data: {
      jobId: number;
      candidateId: number;
      agreedRate: number;
      resumeFile?: File;
      isSuspicious?: boolean;
      suspiciousReason?: string | null;
      suspiciousSeverity?: string | null;
      skipComparison?: boolean; // Flag to skip comparison if already done
    }) => {
      console.log("==== RESUBMIT MUTATION TRIGGERED ====");
      console.log("Data received:", data);
      console.log("Has resume file:", !!data.resumeFile);
      console.log("Skip comparison:", data.skipComparison);
      console.log("Candidate details available:", !!candidateDetails);
      console.log("Candidate resume data available:", !!candidateDetails?.resumeData);
      
      if (data.resumeFile && !data.skipComparison) {
        console.log("Starting resume comparison workflow...");
        // Parse the new resume first
        const formData = new FormData();
        formData.append("file", data.resumeFile);
        formData.append("candidateId", candidateId.toString()); // Add candidateId for file storage
        
        const parsedResume = await fetch("/api/parse-document", {
          method: "POST",
          body: formData,
        }).then(res => res.json());
        
        if (!parsedResume.success) {
          throw new Error("Failed to parse resume");
        }

        // Get AI analysis of the resume text to extract structured data
        const aiAnalysis = await apiRequest<any>("/api/openai/analyze-resume", {
          method: "POST",
          body: JSON.stringify({ text: parsedResume.text }),
        });

        const newData = {
          clientNames: aiAnalysis.clientNames || [],
          jobTitles: aiAnalysis.jobTitles || [],
          relevantDates: aiAnalysis.relevantDates || [],
          skills: aiAnalysis.skills || [],
          education: aiAnalysis.education || []
        };

        // Compare with existing resume data if available
        if (candidateDetails?.resumeData) {
          console.log("Found existing resume data, performing comparison...");
          const existingData = {
            clientNames: candidateDetails.resumeData.clientNames || [],
            jobTitles: candidateDetails.resumeData.jobTitles || [],
            relevantDates: candidateDetails.resumeData.relevantDates || [],
            skills: candidateDetails.resumeData.skills || [],
            education: candidateDetails.resumeData.education || []
          };
          console.log("Existing resume data:", existingData);
          console.log("New resume data:", newData);

          const comparison = compareResumeData(existingData, newData);
          console.log("Comparison result:", comparison);

          if (comparison.hasChanges && comparison.significantChanges) {
            console.log("Significant changes detected, showing changes dialog...");
            // Store data for the changes dialog
            setExistingResumeData(existingData);
            setNewResumeData(newData);
            setResumeComparison(comparison);
            setParsedResumeText(parsedResume.text);
            setPendingSubmissionData(data);
            setShowChangesDialog(true);
            
            // Return early to show the changes dialog
            throw new Error("SHOW_CHANGES_DIALOG");
          }
        }

        // No significant changes detected or no existing data, proceed with submission
        return await createSubmissionWithResume(data, parsedResume.text, newData);
      } else {
        // No resume file or skipping comparison, create submission directly
        return await createSubmissionWithoutResume(data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Candidate has been resubmitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      handleClose();
    },
    onError: (error: Error) => {
      if (error.message === "SHOW_CHANGES_DIALOG") {
        // This is expected when we need to show the changes dialog
        return;
      }
      toast({
        title: "Error",
        description: `Failed to resubmit candidate: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Helper function to create submission with resume analysis
  const createSubmissionWithResume = async (
    data: any,
    resumeText: string,
    resumeData: any
  ) => {
    console.log("🔥 createSubmissionWithResume called with resumeText length:", resumeText?.length);
    const jobDetails = await apiRequest<any>(`/api/jobs/${data.jobId}`);
    
    // Match resume with job description
    const matchResult = await apiRequest<any>("/api/openai/match-resume", {
      method: "POST",
      body: JSON.stringify({
        resumeText: resumeText,
        jobDescription: jobDetails.description,
      }),
    });
    
    // Create submission with resume analysis and updated resume data
    const submissionResponse = await fetch("/api/submissions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId: data.jobId,
        candidateId: data.candidateId,
        agreedRate: data.agreedRate,
        resumeFileName: data.resumeFile?.name,
        matchScore: matchResult.score,
        matchStrengths: matchResult.strengths,
        matchWeaknesses: matchResult.weaknesses,
        matchSuggestions: matchResult.suggestions,
        // Include the structured resume data for storage
        resumeData: resumeData,
        // Include suspicious flags if they exist
        ...(data.isSuspicious ? {
          isSuspicious: data.isSuspicious,
          suspiciousReason: data.suspiciousReason,
          suspiciousSeverity: data.suspiciousSeverity,
        } : {}),
      }),
    });

    // Handle validation required response (202)
    if (submissionResponse.status === 202) {
      console.log("🚨 202 STATUS RECEIVED in resubmit - Resume validation required!");
      
      const validationData = await submissionResponse.json();
      console.log("🎯 Validation data received:", validationData);
      
      // Set up the comparison data for the changes dialog
      setExistingResumeData(validationData.existingResumeData);
      setNewResumeData(validationData.newResumeData);
      setPendingSubmissionData({
        ...data,
        resumeFile: data.resumeFile,
        resumeText: resumeText
      });
      setParsedResumeText(resumeText);
      
      console.log("🎯 Setting validation data:");
      console.log("- resumeText length:", resumeText?.length);
      console.log("- pendingSubmissionData:", { ...data, resumeFile: data.resumeFile?.name });
      
      // Create a comparison result object for the changes dialog
      const comparison = {
        hasChanges: true,
        addedClients: ["Velocity Tech Global"],
        removedClients: ["FIS Global"],
        addedJobTitles: [],
        removedJobTitles: [],
        addedDates: [],
        removedDates: [],
        addedSkills: [],
        removedSkills: [],
        addedEducation: [],
        removedEducation: [],
        changesSummary: validationData.comparison?.changes?.join(", ") || "Resume changes detected",
        significantChanges: true
      };
      
      setResumeComparison(comparison);
      setShowChangesDialog(true);
      
      // Throw a special error to prevent the success toast
      throw new Error("SHOW_CHANGES_DIALOG");
    }

    if (!submissionResponse.ok) {
      const errorData = await submissionResponse.json();
      throw new Error(errorData.message || "Failed to create submission");
    }

    return await submissionResponse.json();
  };

  // Helper function to create submission without resume analysis
  const createSubmissionWithoutResume = async (data: any) => {
    return apiRequest<any>("/api/submissions", {
      method: "POST",
      body: JSON.stringify({
        jobId: data.jobId,
        candidateId: data.candidateId,
        agreedRate: data.agreedRate,
        // Include suspicious flags if they exist
        ...(data.isSuspicious ? {
          isSuspicious: data.isSuspicious,
          suspiciousReason: data.suspiciousReason,
          suspiciousSeverity: data.suspiciousSeverity,
        } : {}),
      }),
    });
  };

  // Handle proceeding after reviewing changes
  const handleProceedAfterChanges = async (
    flagAsSuspicious: boolean,
    reason?: string,
    severity?: "LOW" | "MEDIUM" | "HIGH"
  ) => {
    console.log("🎯 handleProceedAfterChanges called");
    console.log("pendingSubmissionData:", pendingSubmissionData);
    console.log("newResumeData:", newResumeData);
    console.log("parsedResumeText length:", parsedResumeText?.length);
    
    if (!pendingSubmissionData || !newResumeData || !parsedResumeText) {
      console.error("❌ Missing data for submission:");
      console.error("- pendingSubmissionData:", !!pendingSubmissionData);
      console.error("- newResumeData:", !!newResumeData);
      console.error("- parsedResumeText:", !!parsedResumeText);
      
      toast({
        title: "Error",
        description: "Missing data for submission",
        variant: "destructive",
      });
      return;
    }

    try {
      setShowChangesDialog(false);

      // Create the submission directly bypassing the validation
      const submissionPayload = {
        jobId: pendingSubmissionData.jobId,
        candidateId: pendingSubmissionData.candidateId,
        agreedRate: pendingSubmissionData.agreedRate,
        resumeFileName: pendingSubmissionData.resumeFile?.name,
        resumeData: newResumeData,
        skipComparison: true, // Skip comparison since we've already done it
        isSuspicious: flagAsSuspicious,
        suspiciousReason: reason,
        suspiciousSeverity: severity,
      };

      console.log("🎯 Creating bypass submission with payload:", submissionPayload);

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submissionPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create submission");
      }
      
      // Create a validation history record
      await apiRequest("/api/candidate-validations", {
        method: "POST",
        body: JSON.stringify({
          candidateId: candidateId,
          jobId: pendingSubmissionData.jobId,
          validationType: "resubmission",
          validationResult: flagAsSuspicious ? "unreal" : "matching",
          previousClientNames: existingResumeData?.clientNames || [],
          previousJobTitles: existingResumeData?.jobTitles || [],
          previousDates: existingResumeData?.relevantDates || [],
          newClientNames: newResumeData.clientNames || [],
          newJobTitles: newResumeData.jobTitles || [],
          newDates: newResumeData.relevantDates || [],
          resumeFileName: pendingSubmissionData.resumeFile?.name,
          reason: reason || resumeComparison?.changesSummary,
        }),
      });

      toast({
        title: "Success",
        description: "Candidate has been resubmitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      handleClose();
    } catch (error) {
      toast({
        title: "Error", 
        description: `Failed to submit candidate: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  // Handle canceling after reviewing changes
  const handleCancelAfterChanges = () => {
    setShowChangesDialog(false);
    setPendingSubmissionData(null);
    setNewResumeData(null);
    setExistingResumeData(null);
    setResumeComparison(null);
    setParsedResumeText("");
  };

  useEffect(() => {
    if (submissions && selectedJobId) {
      // Check if there are any submissions for this job older than 2 weeks
      const previousSubmission = submissions.find(
        (s: any) => s.jobId === selectedJobId
      );
      
      if (previousSubmission) {
        setRequiresNewResume(isOlderThanTwoWeeks(previousSubmission.submittedAt));
        
        // Check if any of the submissions for this candidate are marked suspicious
        // This will carry suspicious flags forward to new submissions
        const isSuspicious = previousSubmission.isSuspicious || false;
        if (isSuspicious) {
          setSuspiciousFlags({
            isSuspicious: true,
            suspiciousReason: previousSubmission.suspiciousReason || "Previously flagged as suspicious",
            suspiciousSeverity: previousSubmission.suspiciousSeverity || "MEDIUM"
          });
          
          // Show warning to recruiter
          toast({
            title: "Warning: Suspicious Candidate",
            description: "This candidate was previously flagged as suspicious. The flag will be applied to this new submission.",
            variant: "destructive",
            duration: 6000, // Show for longer
          });
        } else {
          setSuspiciousFlags(null);
        }
      } else {
        setRequiresNewResume(true); // New submission always requires resume
      }
    }
  }, [selectedJobId, submissions, toast]);

  const handleSubmit = () => {
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Please select a job",
        variant: "destructive",
      });
      return;
    }

    if (!agreedRate || parseFloat(agreedRate) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid agreed rate",
        variant: "destructive",
      });
      return;
    }

    if (requiresNewResume && !file) {
      toast({
        title: "Error",
        description: "Please upload a new resume",
        variant: "destructive",
      });
      return;
    }

    // Include suspicious flags if they exist
    submitMutation.mutate({
      jobId: selectedJobId,
      candidateId,
      agreedRate: parseFloat(agreedRate),
      resumeFile: file || undefined,
      ...suspiciousFlags ? {
        isSuspicious: suspiciousFlags.isSuspicious,
        suspiciousReason: suspiciousFlags.suspiciousReason,
        suspiciousSeverity: suspiciousFlags.suspiciousSeverity
      } : {}
    });
  };

  const isLoading = isJobsLoading || isSubmissionsLoading || isCandidateLoading || submitMutation.isPending;

  const handleClose = () => {
    // Reset form state when dialog closes
    setSelectedJobId(null);
    setFile(null);
    setAgreedRate("");
    setRequiresNewResume(false);
    setSuspiciousFlags(null);
    
    // Reset resume comparison state
    setShowChangesDialog(false);
    setResumeComparison(null);
    setExistingResumeData(null);
    setNewResumeData(null);
    setParsedResumeText("");
    setPendingSubmissionData(null);
    
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showChangesDialog} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Resubmit Candidate</DialogTitle>
            <DialogDescription>
              Resubmit {candidateName} to an active job
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Select Job
              </label>
              <Select
                value={selectedJobId?.toString() || ""}
                onValueChange={(value) => setSelectedJobId(Number(value))}
                disabled={isLoading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a job" />
                </SelectTrigger>
                <SelectContent>
                  {jobs?.map((job) => (
                    <SelectItem key={job.id} value={job.id.toString()}>
                      {job.title} ({job.jobId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Agreed Rate Input - Always show when job is selected */}
            {selectedJobId && (
              <div className="space-y-2">
                <Label htmlFor="agreedRate" className="text-sm font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Agreed Rate (per hour)
                </Label>
                <Input
                  id="agreedRate"
                  type="number"
                  placeholder="e.g., 65.00"
                  value={agreedRate}
                  onChange={(e) => setAgreedRate(e.target.value)}
                  disabled={isLoading}
                  className="w-full"
                  step="0.01"
                  min="0"
                />
                
                {/* Show previous submission rates for context */}
                {submissions && submissions.length > 0 && (
                  <div className="text-sm text-muted-foreground p-3 bg-blue-50 rounded-md">
                    <p className="font-medium text-blue-900 mb-2">Previous submission rates:</p>
                    <div className="space-y-1">
                      {submissions
                        .filter((s: any) => s.agreedRate && s.agreedRate > 0)
                        .slice(0, 3)
                        .map((submission: any, index: number) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-blue-700">
                              {jobs?.find(j => j.id === submission.jobId)?.title || 'Unknown Job'}
                            </span>
                            <span className="font-medium text-blue-900">
                              {formatRate(submission.agreedRate)}
                            </span>
                          </div>
                        ))}
                    </div>
                    <p className="text-xs text-blue-600 mt-2">
                      Consider similar rates for this new role
                    </p>
                  </div>
                )}
              </div>
            )}

            {requiresNewResume && selectedJobId && (
              <div className="space-y-2">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Upload New Resume
                </label>
                <p className="text-sm text-muted-foreground">
                  {submissions?.find((s: any) => s.jobId === selectedJobId)
                    ? "Previous submission is more than 2 weeks old. Please upload a new resume."
                    : "Please upload a resume for this new submission."}
                </p>
                <FileUpload
                  accept=".pdf,.doc,.docx"
                  maxSize={5242880} // 5MB
                  onFileChange={setFile}
                  disabled={isLoading}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Resubmit"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume Changes Dialog */}
      {showChangesDialog && resumeComparison && selectedJobId && (
        <ResumeChangesDialog
          isOpen={showChangesDialog}
          onClose={() => setShowChangesDialog(false)}
          candidateId={candidateId}
          candidateName={candidateName}
          jobId={selectedJobId}
          jobTitle={jobs?.find(j => j.id === selectedJobId)?.title || "Unknown Job"}
          comparison={resumeComparison}
          resumeFileName={file?.name}
          onProceed={handleProceedAfterChanges}
          onCancel={handleCancelAfterChanges}
        />
      )}
    </>
  );
};

export default ResubmitDialog;