import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCreateSubmission } from "@/hooks/use-submissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CandidateForm, { CandidateFormValues } from "@/components/candidate/candidate-form";
import { Button } from "@/components/ui/button";

interface SubmissionDialogProps {
  jobId: number;
  jobTitle: string;
  jobDescription: string;
  recruiterId: number;
  isOpen: boolean;
  onClose: () => void;
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

  const handleSubmit = async (values: CandidateFormValues & { 
    resumeData?: any;
    matchResults?: any;
  }) => {
    try {
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
      
      if (!candidateResponse.ok) {
        // If candidate already exists, the API returns a 409 with candidateId
        if (candidateResponse.status === 409) {
          const data = await candidateResponse.json();
          
          if (data.candidateId) {
            // Use the existing candidate ID for submission
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
                  description: "The candidate has been submitted for this job.",
                });
                onClose();
              },
              onError: (error) => {
                // Check if the error is because candidate was already submitted
                if (error.message.includes("already been submitted")) {
                  setSubmissionError("This candidate has already been submitted for this job.");
                  toast({
                    title: "Submission failed",
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
        }
        
        const errorData = await candidateResponse.json();
        throw new Error(errorData.message || "Failed to create candidate");
      }

      // If we get here, candidate was created successfully
      const candidateData = await candidateResponse.json();
      
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

        <CandidateForm
          jobId={jobId}
          jobTitle={jobTitle}
          jobDescription={jobDescription}
          onSubmit={handleSubmit}
          isPending={isPending}
        />
      </DialogContent>
    </Dialog>
  );
};

export default SubmissionDialog;
