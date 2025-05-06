import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldCheck } from "lucide-react";

interface CandidateUnrealDialogProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
  currentUnrealStatus: boolean;
  currentUnrealReason?: string | null;
}

const CandidateUnrealDialog: React.FC<CandidateUnrealDialogProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
  currentUnrealStatus,
  currentUnrealReason,
}) => {
  const [reason, setReason] = useState(currentUnrealReason || "");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { mutate: validateCandidate, isPending } = useMutation({
    mutationFn: async (data: {
      candidateId: number;
      validationType: string;
      validationResult: "unreal" | "matching";
      reason?: string;
    }) => {
      return apiRequest("/api/candidates/validate", {
        method: "POST",
        data: {
          ...data,
          validatedBy: 3, // Hardcoded for now - would normally come from auth context
        },
      });
    },
    onSuccess: () => {
      toast({
        title: currentUnrealStatus 
          ? "Candidate Validation Updated" 
          : "Candidate Marked as UNREAL",
        description: currentUnrealStatus
          ? `${candidateName} has been validated as real.`
          : `${candidateName} has been marked as UNREAL.`,
      });
      
      // Invalidate candidates query to refetch the updated data
      queryClient.invalidateQueries({ queryKey: ["/api/candidates"] });
      
      onClose();
      setReason("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update candidate validation status",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    validateCandidate({
      candidateId,
      validationType: "manual",
      validationResult: currentUnrealStatus ? "matching" : "unreal",
      reason: currentUnrealStatus ? undefined : reason,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {currentUnrealStatus ? (
              <>
                <ShieldCheck className="h-5 w-5 text-green-500" /> Validate Candidate
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" /> Mark Candidate as UNREAL
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {currentUnrealStatus
              ? `Confirm that ${candidateName} should no longer be marked as UNREAL.`
              : `Are you sure you want to mark ${candidateName} as UNREAL?`}
          </DialogDescription>
        </DialogHeader>

        {!currentUnrealStatus && (
          <div className="py-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">
                Reason (recommended)
              </label>
            </div>
            <Textarea
              placeholder="Why is this candidate being marked as UNREAL? (e.g., fake, duplicate employment history, etc.)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isPending || (!currentUnrealStatus && !reason.trim())}
            variant={currentUnrealStatus ? "default" : "destructive"}
          >
            {isPending 
              ? "Processing..." 
              : currentUnrealStatus 
                ? "Confirm Validation" 
                : "Mark as UNREAL"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CandidateUnrealDialog;