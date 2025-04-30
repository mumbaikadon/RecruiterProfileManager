import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Label } from "@/components/ui/label";
import { useUpdateSubmissionStatus } from "@/hooks/use-submissions";
import { useToast } from "@/hooks/use-toast";
import StatusBadge from "./status-badge";

const SUBMISSION_STATUSES = [
  { value: "new", label: "New" },
  { value: "submitted_to_vendor", label: "Submitted To Vendor" },
  { value: "rejected_by_vendor", label: "Rejected By Vendor" },
  { value: "submitted_to_client", label: "Submitted To Client" },
  { value: "interview_scheduled", label: "Interview Scheduled" },
  { value: "interview_completed", label: "Interview Completed" },
  { value: "offer_extended", label: "Offer Extended" },
  { value: "offer_accepted", label: "Offer Accepted" },
  { value: "offer_declined", label: "Offer Declined" },
  { value: "rejected", label: "Rejected" },
];

interface StatusSelectProps {
  submissionId: number;
  currentStatus: string;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
  onStatusChange?: () => void;
}

const StatusSelect: React.FC<StatusSelectProps> = ({
  submissionId,
  currentStatus,
  disabled = false,
  showLabel = false,
  className = "",
  onStatusChange,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const updateMutation = useUpdateSubmissionStatus();
  const { toast } = useToast();

  const handleStatusChange = (value: string) => {
    if (value === currentStatus) return;
    
    setSelectedStatus(value);
    setIsFeedbackOpen(true);
  };

  const handleSubmitFeedback = async () => {
    try {
      await updateMutation.mutateAsync({
        id: submissionId,
        status: selectedStatus,
        feedback: feedback.trim() || undefined,
      });
      
      setIsFeedbackOpen(false);
      setFeedback("");
      
      toast({
        title: "Status updated",
        description: `Submission status changed to ${SUBMISSION_STATUSES.find(s => s.value === selectedStatus)?.label}`,
      });
      
      if (onStatusChange) {
        onStatusChange();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update submission status",
        variant: "destructive",
      });
    }
  };

  const cancelStatusChange = () => {
    setSelectedStatus(currentStatus);
    setIsFeedbackOpen(false);
    setFeedback("");
  };

  return (
    <div className={className}>
      {showLabel && <Label htmlFor="status-select" className="mb-2 block">Status</Label>}
      
      <Select
        value={currentStatus}
        onValueChange={handleStatusChange}
        disabled={disabled || updateMutation.isPending}
      >
        <SelectTrigger id="status-select" className="w-full">
          <SelectValue>
            <StatusBadge status={currentStatus} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUBMISSION_STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              <StatusBadge status={status.value} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>
              Changing status to{" "}
              <span className="font-medium">
                {SUBMISSION_STATUSES.find((s) => s.value === selectedStatus)?.label}
              </span>
              . Add optional feedback about this status change.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="feedback" className="mb-2 block">
              Feedback (Optional)
            </Label>
            <Textarea
              id="feedback"
              placeholder="Enter any notes or feedback about this status change..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={cancelStatusChange}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitFeedback}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Updating..." : "Update Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StatusSelect;