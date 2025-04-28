import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRecruiters } from "@/hooks/use-recruiters";
import { useCreateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  status: z.string().default("active"),
  createdBy: z.number().optional(),
  recruiterIds: z.array(z.number()).min(1, "You must assign at least one recruiter")
});

type FormValues = z.infer<typeof formSchema>;

interface CreateJobDialogProps {
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

const CreateJobDialog: React.FC<CreateJobDialogProps> = ({ buttonVariant = "default" }) => {
  const [open, setOpen] = React.useState(false);
  const { data: recruiters } = useRecruiters();
  const { mutate: createJob, isPending } = useCreateJob();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "active",
      createdBy: 1, // In a real app, this would be the current user's ID
      recruiterIds: []
    }
  });

  const onSubmit = (values: FormValues) => {
    createJob(values, {
      onSuccess: () => {
        toast({
          title: "Job created",
          description: "The job has been created successfully.",
        });
        setOpen(false);
        form.reset();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message || "Failed to create job",
          variant: "destructive",
        });
      }
    });
  };
  
  const handleMultiSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(e.target.selectedOptions).map(option => parseInt(option.value));
    form.setValue("recruiterIds", options);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant}>
          <Plus className="h-5 w-5 mr-2" />
          New Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Create a new job and assign recruiters to it.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Senior React Developer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="sm:col-span-3">
                <div className="block text-sm font-medium text-gray-700">Job ID</div>
                <div className="mt-1">
                  <Input disabled placeholder="Auto-generated" />
                </div>
                <p className="mt-2 text-sm text-gray-500">Job ID will be generated automatically.</p>
              </div>
              
              <div className="sm:col-span-6">
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter detailed job description..." 
                          rows={5} 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        This description will be used for candidate matching.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="sm:col-span-6">
                <FormField
                  control={form.control}
                  name="recruiterIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Recruiters</FormLabel>
                      <FormControl>
                        <select
                          multiple
                          className="form-select block w-full mt-1 rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50"
                          onChange={handleMultiSelect}
                          value={field.value.map(String)}
                        >
                          {recruiters?.map((recruiter) => (
                            <option key={recruiter.id} value={recruiter.id}>
                              {recruiter.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormDescription>
                        You can select multiple recruiters (Ctrl+Click or Cmd+Click).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Job"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJobDialog;
