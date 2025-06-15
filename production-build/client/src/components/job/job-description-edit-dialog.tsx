import React, { useState } from 'react';
import { useUpdateJobDescription } from '@/hooks/use-update-job-description';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PencilRuler, Save } from 'lucide-react';

interface JobDescriptionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: number;
  jobTitle: string;
  currentDescription: string;
}

const JobDescriptionEditDialog: React.FC<JobDescriptionEditDialogProps> = ({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  currentDescription,
}) => {
  const [description, setDescription] = useState(currentDescription);
  const { toast } = useToast();
  const { mutate: updateDescription, isPending } = useUpdateJobDescription();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    updateDescription(
      { id: jobId, description },
      {
        onSuccess: () => {
          toast({
            title: 'Description updated',
            description: 'The job description has been successfully updated.',
          });
          onClose();
        },
        onError: (error) => {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to update job description',
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PencilRuler className="h-5 w-5 text-primary" />
              Edit Job Description
            </DialogTitle>
            <DialogDescription>
              Update the description for <span className="font-medium">{jobTitle}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4 space-y-4">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter job description..."
              className="min-h-[300px] font-mono text-sm"
              rows={15}
            />
          </div>

          <DialogFooter className="mt-6">
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending} className="gap-1">
              {isPending ? 'Saving...' : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default JobDescriptionEditDialog;