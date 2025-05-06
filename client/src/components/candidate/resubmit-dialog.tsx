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
      resumeFile?: File;
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
            resumeFileName: data.resumeFile.name,
            matchScore: matchResult.score,
            matchStrengths: matchResult.strengths,
            matchWeaknesses: matchResult.weaknesses,
            matchSuggestions: matchResult.suggestions,
          }),
        });
      } else {
        // Create submission without resume analysis
        return apiRequest<any>("/api/submissions", {
          method: "POST",
          body: JSON.stringify({
            jobId: data.jobId,
            candidateId: data.candidateId,
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
      } else {
        setRequiresNewResume(true); // New submission always requires resume
      }
    }
  }, [selectedJobId, submissions]);

  const handleSubmit = () => {
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

    submitMutation.mutate({
      jobId: selectedJobId,
      candidateId,
      resumeFile: file || undefined,
    });
  };

  const isLoading = isJobsLoading || isSubmissionsLoading || submitMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
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