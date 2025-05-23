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
      toast({
        title: "Success",
        description: "Candidate has been resubmitted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      onClose();
    },
    onError: (error: Error) => {
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
        // Potentially add flags for significant discrepancies
        if (comparisonResult.overallRisk === 'high' || comparisonResult.removedEmployers.length > 0) {
          setSuspiciousFlags({
            isSuspicious: true,
            suspiciousReason: "Significant resume discrepancies detected",
            suspiciousSeverity: comparisonResult.overallRisk === 'high' ? "HIGH" : "MEDIUM"
          });
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
    if (!selectedJobId) {
      toast({
        title: "Error",
        description: "Please select a job",
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

    // Ensure job ID is properly converted to a number
    const jobId = Number(selectedJobId);
    const candId = Number(candidateId);
    
    if (isNaN(jobId)) {
      toast({
        title: "Error",
        description: "Invalid job ID",
        variant: "destructive",
      });
      return;
    }
    
    // Use the existing validation results if available, otherwise analyze now
    let matchResult = null;
    if (file && !currentResumeData) {
      matchResult = await analyzeNewResume(file);
      if (!matchResult) {
        // If analysis failed, stop the submission process
        return;
      }
    } else if (file && currentResumeData) {
      // Get job details to perform the match again without re-running the comparison
      const jobDetails = await apiRequest<any>(`/api/jobs/${jobId}`);
      
      // Use the existing file to get the resume text
      const formData = new FormData();
      formData.append("file", file);
      
      const parsedResume = await fetch("/api/parse-document", {
        method: "POST",
        body: formData,
      }).then(res => res.json());
      
      if (parsedResume.success) {
        // Just get the match score without re-validating the resume
        matchResult = await apiRequest<any>("/api/openai/match-resume", {
          method: "POST",
          body: JSON.stringify({
            resumeText: parsedResume.text,
            jobDescription: jobDetails.description,
          }),
        });
      }
    }
    
    // Now submit with the match result if available
    submitMutation.mutate({
      jobId: jobId,
      candidateId: candId,
      resumeFile: file || undefined,
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
          <Button variant="outline" onClick={onClose} disabled={isLoading || isValidating}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isLoading || isValidating}
            variant={validationResult?.overallRisk === 'high' ? "destructive" : "default"}
          >
            {isLoading || isValidating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isValidating ? "Validating Resume..." : "Processing..."}
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