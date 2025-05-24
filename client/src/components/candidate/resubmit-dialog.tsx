import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Job, apiRequest } from "@/lib/api";
import { Loader2 } from "lucide-react";
import { formatDate, isOlderThanTwoWeeks } from "@/lib/date-utils";
import { compareResumeVersions } from "@/lib/resume-comparison";
import ResumeValidationResults from "./resume-validation-results";

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
  const [hourlyRate, setHourlyRate] = useState<string>("");
  const [requiresNewResume, setRequiresNewResume] = useState(false);
  const [suspiciousFlags, setSuspiciousFlags] = useState<{
    isSuspicious: boolean;
    suspiciousReason: string | null;
    suspiciousSeverity: string | null;
  } | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [previousResumeData, setPreviousResumeData] = useState<any>(null);
  const [currentResumeData, setCurrentResumeData] = useState<any>(null);
  const [processingStage, setProcessingStage] = useState<string | null>(null);
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
  
  // Fetch the candidate's latest resume data
  const {
    data: candidateResumeData,
    isLoading: isResumeDataLoading,
  } = useQuery({
    queryKey: ["/api/candidates", candidateId, "resume"],
    enabled: isOpen && !!candidateId,
    queryFn: async () => {
      const candidateData = await apiRequest<any>(`/api/candidates/${candidateId}`);
      return candidateData.resumeData;
    }
  });

  // Submit candidate mutation
  const submitMutation = useMutation({
    mutationFn: async (data: {
      jobId: number;
      candidateId: number;
      resumeFile?: File;
      hourlyRate?: string;
      isSuspicious?: boolean;
      suspiciousReason?: string | null;
      suspiciousSeverity?: string | null;
    }) => {
      // Ensure IDs are numbers before proceeding
      const jobId = Number(data.jobId);
      const candidateId = Number(data.candidateId);
      
      if (data.resumeFile) {
        // Upload and parse the resume if provided
        const formData = new FormData();
        formData.append("file", data.resumeFile);
        
        const parsedResume = await fetch("/api/parse-document", {
          method: "POST",
          body: formData,
        }).then(res => res.json());
        
        if (!parsedResume.success) {
          throw new Error("Failed to parse resume");
        }
        
        const jobDetails = await apiRequest<any>(`/api/jobs/${jobId}`);
        
        // Match resume with job description
        const matchResult = await apiRequest<any>("/api/openai/match-resume", {
          method: "POST",
          body: JSON.stringify({
            resumeText: parsedResume.text,
            jobDescription: jobDetails.description,
          }),
        });
        
        // Create submission with resume analysis
        return apiRequest<any>("/api/submissions", {
          method: "POST",
          body: JSON.stringify({
            jobId: jobId,
            candidateId: candidateId,
            recruiterId: 1, // Current user ID (assuming user 1 is the default user)
            status: "New", // Required status field
            resumeFileName: data.resumeFile.name,
            matchScore: matchResult.score,
            matchStrengths: matchResult.strengths,
            matchWeaknesses: matchResult.weaknesses,
            matchSuggestions: matchResult.suggestions,
            // Include suspicious flags if they exist
            ...(data.isSuspicious ? {
              isSuspicious: data.isSuspicious,
              suspiciousReason: data.suspiciousReason,
              suspiciousSeverity: data.suspiciousSeverity,
            } : {}),
          }),
        });
      } else {
        // Create submission without resume analysis
        return apiRequest<any>("/api/submissions", {
          method: "POST",
          body: JSON.stringify({
            jobId: jobId,
            candidateId: candidateId,
            recruiterId: 1, // Current user ID (assuming user 1 is the default user)
            status: "New", // Required status field
            // Include suspicious flags if they exist
            ...(data.isSuspicious ? {
              isSuspicious: data.isSuspicious,
              suspiciousReason: data.suspiciousReason,
              suspiciousSeverity: data.suspiciousSeverity,
            } : {}),
          }),
        });
      }
    },
    onSuccess: () => {
      setProcessingStage(null);
      toast({
        title: "Success",
        description: "Candidate has been resubmitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      onClose();
    },
    onError: (error: Error) => {
      setProcessingStage(null);
      console.error("Submission error details:", error);
      toast({
        title: "Error",
        description: `Failed to resubmit candidate: ${error.message}`,
        variant: "destructive",
      });
    },
  });

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
  
  // Store previous resume data when it's loaded
  useEffect(() => {
    if (candidateResumeData) {
      setPreviousResumeData({
        clientNames: candidateResumeData.clientNames || [],
        jobTitles: candidateResumeData.jobTitles || [],
        relevantDates: candidateResumeData.relevantDates || []
      });
    }
  }, [candidateResumeData]);

  // Function to analyze new resume and compare with previous data
  const analyzeNewResume = async (resumeFile: File) => {
    if (!previousResumeData) return null;
    
    setIsValidating(true);
    try {
      // Upload and parse the resume 
      const formData = new FormData();
      formData.append("file", resumeFile);
      
      const parsedResume = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      }).then(res => res.json());
      
      if (!parsedResume.success) {
        throw new Error("Failed to parse resume");
      }
      
      // Get job details for resume analysis
      const jobId = Number(selectedJobId);
      const jobDetails = await apiRequest<any>(`/api/jobs/${jobId}`);
      
      // Match resume with job description
      const matchResult = await apiRequest<any>("/api/openai/match-resume", {
        method: "POST",
        body: JSON.stringify({
          resumeText: parsedResume.text,
          jobDescription: jobDetails.description,
        }),
      });
      
      // Store the current resume data
      const newResumeData = {
        clientNames: matchResult.clientNames || [],
        jobTitles: matchResult.jobTitles || [],
        relevantDates: matchResult.relevantDates || []
      };
      
      setCurrentResumeData(newResumeData);
      
      // Compare previous and current resume data
      const comparisonResult = compareResumeVersions(
        previousResumeData,
        newResumeData
      );
      
      setValidationResult(comparisonResult);
      
      // If there are significant changes, highlight them to the recruiter
      if (comparisonResult.hasChanges && comparisonResult.overallRisk !== 'none') {
        // Major discrepancies should be flagged as suspicious - this uses our existing suspicious flag system
        if (comparisonResult.overallRisk === 'high' || comparisonResult.removedEmployers.length > 0 || comparisonResult.changedDates.length > 1) {
          const isMajorDiscrepancy = comparisonResult.overallRisk === 'high' || 
                                    (comparisonResult.removedEmployers.length > 0 && 
                                     comparisonResult.newEmployers.length > 0) ||
                                    comparisonResult.changedDates.length > 2;
          
          setSuspiciousFlags({
            isSuspicious: true,
            suspiciousReason: isMajorDiscrepancy 
              ? "Major employment history discrepancies detected - possible fraudulent submission" 
              : comparisonResult.changedDates.length > 1
                ? `Modified employment dates detected on ${comparisonResult.changedDates.length} positions`
                : "Significant resume discrepancies detected",
            suspiciousSeverity: isMajorDiscrepancy ? "HIGH" : "MEDIUM"
          });
          
          // Show urgent warning for major discrepancies
          if (isMajorDiscrepancy) {
            toast({
              title: "WARNING: Major Resume Discrepancies",
              description: "This resume contains completely different employment history which may indicate a fraudulent submission or incorrect candidate.",
              variant: "destructive",
              duration: 10000 // Show for longer
            });
          }
        }
      }
      
      return matchResult;
      
    } catch (error) {
      console.error("Error analyzing resume:", error);
      toast({
        title: "Resume Analysis Error",
        description: "There was a problem analyzing the resume. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = async () => {
    // Set processing stage immediately for user feedback
    setProcessingStage("Initiating submission...");
    
    if (!selectedJobId) {
      setProcessingStage(null);
      toast({
        title: "Error",
        description: "Please select a job",
        variant: "destructive",
      });
      return;
    }

    if (requiresNewResume && !file) {
      setProcessingStage(null);
      toast({
        title: "Error",
        description: "Please upload a new resume",
        variant: "destructive",
      });
      return;
    }

    // Ensure job ID is properly converted to a number
    const jobId = Number(selectedJobId);
    const candId = Number(candidateId);
    
    if (isNaN(jobId)) {
      setProcessingStage(null);
      toast({
        title: "Error",
        description: "Invalid job ID",
        variant: "destructive",
      });
      return;
    }
    
    // Use the existing validation results if available, otherwise analyze now
    let matchResult = null;
    
    // Check if this is a major discrepancy case (different employers) - don't update candidate data
    const isMajorDiscrepancy = validationResult && 
                             validationResult.overallRisk === 'high' || 
                             (validationResult && validationResult.removedEmployers.length > 0 && 
                              validationResult.newEmployers.length > 0);
                              
    if (isMajorDiscrepancy) {
      // For major discrepancies, warn the user again before proceeding
      toast({
        title: "Warning: Submitting Discrepant Resume",
        description: "This resume has major discrepancies and will be flagged as suspicious. It will NOT update candidate data.",
        variant: "destructive",
        duration: 5000
      });
    }
    
    // Skip ALL resume analysis - we already did it during validation
    // This completely eliminates the double processing issue
    setProcessingStage("Preparing submission...");
    
    // Just use the existing validation results
    if (validationResult) {
      console.log("Using validation results directly for submission");
      matchResult = {
        score: validationResult.matchScore || 0,
        strengths: validationResult.strengths || [],
        weaknesses: validationResult.weaknesses || [],
        suggestions: validationResult.suggestions || []
      };
    } else {
      // Just for safety - this shouldn't happen in normal flow since validation is required
      setProcessingStage(null);
      toast({
        title: "Error",
        description: "Please validate the resume before submission",
        variant: "destructive",
      });
      return;
    }
    
    // Now submit with the match result if available
    setProcessingStage("Creating submission...");
    submitMutation.mutate({
      jobId: jobId,
      candidateId: candId,
      resumeFile: file || undefined,
      hourlyRate: hourlyRate || "0",
      ...(matchResult ? {
        matchScore: matchResult.score,
        matchStrengths: matchResult.strengths,
        matchWeaknesses: matchResult.weaknesses,
        matchSuggestions: matchResult.suggestions
      } : {}),
      ...(suspiciousFlags ? {
        isSuspicious: suspiciousFlags.isSuspicious,
        suspiciousReason: suspiciousFlags.suspiciousReason,
        suspiciousSeverity: suspiciousFlags.suspiciousSeverity
      } : {})
    });
  };

  const isLoading = isJobsLoading || isSubmissionsLoading || isResumeDataLoading || submitMutation.isPending;

  // Handle file selection and trigger resume validation
  const handleFileChange = async (newFile: File | null) => {
    setFile(newFile);
    // Reset validation when file changes
    setValidationResult(null);
    
    // If we have previous resume data and a new file, validate automatically
    if (newFile && previousResumeData && !isValidating) {
      await analyzeNewResume(newFile);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
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
          
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Hourly Rate ($)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-500">$</span>
              <Input
                type="number"
                placeholder="0.00"
                className="pl-8"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
          </div>

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
                onFileChange={handleFileChange}
                disabled={isLoading || isValidating}
              />
            </div>
          )}
          
          {/* Resume validation results section */}
          {(isValidating || validationResult) && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">Resume Validation</h3>
              <ResumeValidationResults 
                validationResult={validationResult}
                isLoading={isValidating}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading || isValidating || processingStage !== null}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || isValidating || processingStage !== null}
            variant={validationResult?.overallRisk === 'high' ? "destructive" : "default"}
          >
            {isLoading || isValidating || processingStage ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isValidating ? "Validating Resume..." : 
                 processingStage ? processingStage : 
                 "Processing..."}
              </>
            ) : (
              validationResult?.overallRisk === 'high' 
                ? "Resubmit With Warning" 
                : "Resubmit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ResubmitDialog;