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
  compact?: boolean;
}

const StatusSelect: React.FC<StatusSelectProps> = ({ 
  submissionId, 
  currentStatus, 
  compact = false 
}) => {
  const [status, setStatus] = useState(currentStatus);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [feedback, setFeedback] = useState("");
  
  const { toast } = useToast();
  const { mutate: updateStatus, isPending } = useUpdateSubmissionStatus();
  
  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setIsDialogOpen(true);
  };
  
  const handleSubmit = () => {
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
          setFeedback(""); // Reset feedback for next use
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
          <StatusBadge status={status} />
        </SelectTrigger>
      );
    }
    
    return (
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a status">
          <StatusBadge status={status} />
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
            <label className="text-sm font-medium mb-2 block">
              Feedback (optional)
            </label>
            <Textarea
              placeholder="Add comments about this status change..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
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