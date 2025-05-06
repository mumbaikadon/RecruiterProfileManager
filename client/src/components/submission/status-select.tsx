import React, { useState } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useUpdateSubmissionStatus } from "@/hooks/use-submissions";
import StatusBadge from "./status-badge";

interface StatusSelectProps {
  submissionId: number;
  currentStatus: string;
  currentFeedback?: string | null;
  compact?: boolean;
}

const StatusSelect: React.FC<StatusSelectProps> = ({ 
  submissionId, 
  currentStatus, 
  currentFeedback = null,
  compact = false 
}) => {
  const [status, setStatus] = useState(currentStatus);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [feedback, setFeedback] = useState("");
  const [currentStatusFeedback, setCurrentStatusFeedback] = useState(currentFeedback);
  
  const { toast } = useToast();
  const { mutate: updateStatus, isPending } = useUpdateSubmissionStatus();
  
  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setIsDialogOpen(true);
  };
  
  const handleSubmit = () => {
    // Additional error prevention
    if (!selectedStatus || isPending) {
      return;
    }

    updateStatus(
      { 
        id: submissionId, 
        status: selectedStatus,
        feedback: feedback.trim() || undefined
      },
      {
        onSuccess: () => {
          toast({
            title: "Status updated",
            description: `Submission status has been updated to ${selectedStatus.replace(/_/g, ' ')}.`,
          });
          setStatus(selectedStatus);
          setIsDialogOpen(false);
          
          // Update current feedback state if feedback was provided
          if (selectedStatus === 'rejected' && feedback.trim()) {
            setCurrentStatusFeedback(feedback.trim());
          } else if (selectedStatus !== 'rejected') {
            setCurrentStatusFeedback(null);
          }
          
          setFeedback(""); // Reset feedback input for next use
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message || "Failed to update status",
            variant: "destructive",
          });
        },
      }
    );
  };
  
  const handleCancel = () => {
    setIsDialogOpen(false);
    setFeedback(""); // Reset feedback
  };
  
  const renderSelectTrigger = () => {
    if (compact) {
      return (
        <SelectTrigger className="border-none shadow-none p-0 h-auto w-auto focus:ring-0">
          <StatusBadge status={status} feedback={currentStatusFeedback} />
        </SelectTrigger>
      );
    }
    
    return (
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a status">
          <StatusBadge status={status} feedback={currentStatusFeedback} />
        </SelectValue>
      </SelectTrigger>
    );
  };
  
  return (
    <>
      <Select value={status} onValueChange={handleStatusChange}>
        {renderSelectTrigger()}
        <SelectContent>
          <SelectItem value="new">
            <StatusBadge status="new" />
          </SelectItem>
          <SelectItem value="submitted_to_vendor">
            <StatusBadge status="submitted_to_vendor" />
          </SelectItem>
          <SelectItem value="rejected_by_vendor">
            <StatusBadge status="rejected_by_vendor" />
          </SelectItem>
          <SelectItem value="submitted_to_client">
            <StatusBadge status="submitted_to_client" />
          </SelectItem>
          <SelectItem value="interview_scheduled">
            <StatusBadge status="interview_scheduled" />
          </SelectItem>
          <SelectItem value="interview_completed">
            <StatusBadge status="interview_completed" />
          </SelectItem>
          <SelectItem value="offer_extended">
            <StatusBadge status="offer_extended" />
          </SelectItem>
          <SelectItem value="offer_accepted">
            <StatusBadge status="offer_accepted" />
          </SelectItem>
          <SelectItem value="offer_declined">
            <StatusBadge status="offer_declined" />
          </SelectItem>
          <SelectItem value="rejected">
            <StatusBadge status="rejected" />
          </SelectItem>
        </SelectContent>
      </Select>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>
              Changing status to <StatusBadge status={selectedStatus} />
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">
                Feedback {selectedStatus === 'rejected' ? '(recommended)' : '(optional)'}
              </label>
              <span className="text-xs text-muted-foreground">
                Press Enter to submit, Shift+Enter for new line
              </span>
            </div>
            {selectedStatus === 'rejected' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                When rejecting a submission, adding feedback like "fake" or "duplicate" helps track reasons.
              </p>
            )}
            <Textarea
              placeholder={selectedStatus === 'rejected' 
                ? "Why is this submission being rejected? (e.g., fake, duplicate, etc.)"
                : "Add comments about this status change..."}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                // Only handle Enter key if it's not shift+enter and the form isn't already submitting
                if (e.key === 'Enter' && !e.shiftKey && !isPending) {
                  e.preventDefault(); // Prevent new line
                  if (selectedStatus) {
                    handleSubmit();
                  }
                }
              }}
              rows={4}
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StatusSelect;