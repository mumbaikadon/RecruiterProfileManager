import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const quickSubmitSchema = z.object({
  jobId: z.string().min(1, "Please select a job"),
  agreedRate: z.string().min(1, "Please enter an agreed rate"),
});

type QuickSubmitFormValues = z.infer<typeof quickSubmitSchema>;

interface QuickSubmitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
}

const QuickSubmitDialog: React.FC<QuickSubmitDialogProps> = ({
  isOpen,
  onClose,
  candidateId,
  candidateName,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<QuickSubmitFormValues>({
    resolver: zodResolver(quickSubmitSchema),
    defaultValues: {
      jobId: "",
      agreedRate: "",
    },
  });

  // Fetch active jobs
  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
    select: (data: any[]) => data.filter(job => job.status?.toLowerCase() === "active"),
  });

  // Quick submit mutation
  const quickSubmitMutation = useMutation({
    mutationFn: async (values: QuickSubmitFormValues) => {
      const jobId = parseInt(values.jobId);
      const agreedRate = parseFloat(values.agreedRate);

      // Check if candidate is already submitted to this job
      const existingSubmissions = await apiRequest(`/api/submissions?candidateId=${candidateId}&jobId=${jobId}`);
      if (existingSubmissions && existingSubmissions.length > 0) {
        throw new Error("This candidate is already submitted to this job");
      }

      // Create quick submission without AI processing or resume upload
      return apiRequest("/api/submissions", {
        method: "POST",
        body: JSON.stringify({
          jobId,
          candidateId,
          agreedRate,
          status: "New",
          matchScore: null, // No AI scoring for quick submit
          notes: "Quick Submit - No AI Processing",
          quickSubmit: true, // Flag to bypass AI processing
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: `${candidateName} has been quickly submitted to the job`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/submissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const onSubmit = (values: QuickSubmitFormValues) => {
    quickSubmitMutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Quick Submit Candidate</DialogTitle>
          <DialogDescription>
            Quickly submit {candidateName} to a job without resume processing or AI validation.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Job Selection */}
            <FormField
              control={form.control}
              name="jobId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Job</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a job to submit to" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {jobs.map((job: any) => (
                        <SelectItem key={job.id} value={job.id.toString()}>
                          {job.title} ({job.jobId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Agreed Rate */}
            <FormField
              control={form.control}
              name="agreedRate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agreed Rate (per hour)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                        $
                      </span>
                      <Input
                        {...field}
                        type="number"
                        step="0.01"
                        placeholder="e.g., 65.00"
                        className="pl-8"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="text-blue-600 mt-0.5">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Quick Submit Features:</p>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-xs">
                    <li>No resume upload required</li>
                    <li>No AI matching or parsing</li>
                    <li>Uses existing candidate data</li>
                    <li>Fast submission process</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={quickSubmitMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={quickSubmitMutation.isPending}
                className="min-w-[100px]"
              >
                {quickSubmitMutation.isPending ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </div>
                ) : (
                  "Quick Submit"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSubmitDialog;