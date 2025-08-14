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

  // Submit candidate mutation
  const submitMutation = useMutation({
    mutationFn: async (data: {
      jobId: number;
      candidateId: number;
      agreedRate: number;
      resumeFile?: File;
      isSuspicious?: boolean;
      suspiciousReason?: string | null;
      suspiciousSeverity?: string | null;
    }) => {
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
        
        const jobDetails = await apiRequest<any>(`/api/jobs/${data.jobId}`);
        
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
            jobId: data.jobId,
            candidateId: data.candidateId,
            agreedRate: data.agreedRate,
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

  const isLoading = isJobsLoading || isSubmissionsLoading || submitMutation.isPending;

  const handleClose = () => {
    // Reset form state when dialog closes
    setSelectedJobId(null);
    setFile(null);
    setAgreedRate("");
    setRequiresNewResume(false);
    setSuspiciousFlags(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
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
  );
};

export default ResubmitDialog;