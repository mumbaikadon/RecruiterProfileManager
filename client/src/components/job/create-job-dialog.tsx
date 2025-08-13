import React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRecruiters } from "@/hooks/use-recruiters";
import { useCreateJob } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { useParseJobRequirements } from "@/hooks/use-job-parser";
import { sanitizeHtml, cn } from "@/lib/utils";

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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Check, ChevronsUpDown, X } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  jobId: z.string().min(3, "Job ID must be at least 3 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  client: z.string().optional(),
  implOrPv: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  rate: z.string().optional(),
  interviewType: z.enum(["phone", "video", "onsite", "hybrid"]).optional(),
  visaRestrictions: z.string().optional(),
  requiredSkills: z.array(z.string()).optional().default([]),
  status: z.enum(["active", "reviewing", "closed"]).default("active"),
  createdBy: z.number().optional(),
  recruiterIds: z.array(z.number()).optional().default([])
});

type FormValues = z.infer<typeof formSchema>;

interface CreateJobDialogProps {
  buttonVariant?: "default" | "outline" | "secondary" | "ghost" | "link" | "destructive";
}

const CreateJobDialog: React.FC<CreateJobDialogProps> = ({ buttonVariant = "default" }) => {
  const [open, setOpen] = React.useState(false);
  const [requirementText, setRequirementText] = React.useState("");
  const { data: recruiters } = useRecruiters();
  const { mutate: createJob, isPending } = useCreateJob();
  const { mutate: parseRequirements, isPending: isParsing } = useParseJobRequirements();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      jobId: "",
      description: "",
      client: "",
      implOrPv: undefined,
      city: "",
      state: "",
      rate: "",
      interviewType: undefined,
      visaRestrictions: "",
      requiredSkills: [],
      status: "active",
      createdBy: 1, // In a real app, this would be the current user's ID
      recruiterIds: []
    }
  });

  const onSubmit = (values: FormValues) => {
    // Sanitize description field to remove HTML tags
    const sanitizedValues = {
      ...values,
      description: sanitizeHtml(values.description)
    };
    
    createJob(sanitizedValues, {
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

  const addSkill = (skill: string) => {
    if (skill.trim() && !form.getValues("requiredSkills").includes(skill.trim())) {
      const currentSkills = form.getValues("requiredSkills");
      form.setValue("requiredSkills", [...currentSkills, skill.trim()]);
    }
  };

  const removeSkill = (skillToRemove: string) => {
    const currentSkills = form.getValues("requiredSkills");
    form.setValue("requiredSkills", currentSkills.filter(skill => skill !== skillToRemove));
  };

  const handleRequirementTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setRequirementText(text);
    
    // Auto-parse when text is pasted (detected by significant length increase)
    if (text.trim().length > 50 && text.trim().length > requirementText.length + 20) {
      parseRequirements(text, {
        onSuccess: (parsedData) => {
          // Populate form fields with parsed data
          if (parsedData.title) form.setValue("title", parsedData.title);
          if (parsedData.client) form.setValue("client", parsedData.client);
          if (parsedData.city) form.setValue("city", parsedData.city);
          if (parsedData.state) form.setValue("state", parsedData.state);
          if (parsedData.rate) form.setValue("rate", parsedData.rate);
          if (parsedData.interviewType) form.setValue("interviewType", parsedData.interviewType);
          if (parsedData.visaRestrictions) form.setValue("visaRestrictions", parsedData.visaRestrictions);
          if (parsedData.requiredSkills) form.setValue("requiredSkills", parsedData.requiredSkills);
          if (parsedData.description) form.setValue("description", parsedData.description);

          toast({
            title: "Auto-parsed",
            description: "Job details filled automatically from pasted requirements",
          });
        },
        onError: (error) => {
          console.warn("Auto-parsing failed:", error.message);
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={buttonVariant}>
          <Plus className="h-5 w-5 mr-2" />
          New Job
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[900px] max-h-[95vh] w-[95vw] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Create a new job and assign recruiters to it.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Requirements Parser Section */}
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Requirements Parser
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Paste your job requirements below and automatically extract key information to fill the form fields
              </p>
              <div className="space-y-3">
                <Textarea
                  value={requirementText}
                  onChange={handleRequirementTextChange}
                  placeholder="Paste your job requirements here using labels like:
Position: Senior Developer
Client: ABC Company  
Location: New York, NY
Rate: $75/hr
Skills: React, Node.js, TypeScript"
                  rows={6}
                  className="w-full"
                />
                {requirementText && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setRequirementText("")}
                      variant="ghost"
                      size="sm"
                    >
                      Clear
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Job Details
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="sm:col-span-1 lg:col-span-3">
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
              
              <div className="sm:col-span-1 lg:col-span-3">
                <FormField
                  control={form.control}
                  name="jobId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job ID</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. JOB-2025-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-1 lg:col-span-3">
                <FormField
                  control={form.control}
                  name="client"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Acme Corp" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-3">
                <FormField
                  control={form.control}
                  name="implOrPv"
                  render={({ field }) => {
                    const [open, setOpen] = React.useState(false);
                    const options = ["Kforce", "Randstand", "Collebra", "State Client"];
                    
                    return (
                      <FormItem className="flex flex-col">
                        <FormLabel>IMPL or PV</FormLabel>
                        <Popover open={open} onOpenChange={setOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={open}
                                className="w-full justify-between h-10 px-3 py-2 text-left font-normal"
                              >
                                <span className={field.value ? "text-foreground" : "text-muted-foreground"}>
                                  {field.value || "Select or type..."}
                                </span>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                            <Command>
                              <CommandInput 
                                placeholder="Search or type custom value..." 
                                value={field.value || ""}
                                onValueChange={(value) => field.onChange(value)}
                                className="h-11"
                              />
                              <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                  <span>Press Enter to use custom value</span>
                                  {field.value && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setOpen(false);
                                      }}
                                      className="text-xs"
                                    >
                                      Use "{field.value}"
                                    </Button>
                                  )}
                                </div>
                              </CommandEmpty>
                              <CommandGroup>
                                <CommandList className="max-h-[200px]">
                                  {options.map((option) => (
                                    <CommandItem
                                      key={option}
                                      value={option}
                                      onSelect={(currentValue) => {
                                        field.onChange(currentValue);
                                        setOpen(false);
                                      }}
                                      className="flex items-center gap-2 px-3 py-2"
                                    >
                                      <Check
                                        className={cn(
                                          "h-4 w-4",
                                          field.value === option ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      <span>{option}</span>
                                    </CommandItem>
                                  ))}
                                </CommandList>
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormDescription className="text-xs text-muted-foreground">
                          Select from options or type a custom value
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              <div className="sm:col-span-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. San Francisco" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="sm:col-span-3">
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Remote">Remote</SelectItem>
                          <SelectItem value="AL">Alabama</SelectItem>
                          <SelectItem value="AK">Alaska</SelectItem>
                          <SelectItem value="AZ">Arizona</SelectItem>
                          <SelectItem value="AR">Arkansas</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="CO">Colorado</SelectItem>
                          <SelectItem value="CT">Connecticut</SelectItem>
                          <SelectItem value="DE">Delaware</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="GA">Georgia</SelectItem>
                          <SelectItem value="HI">Hawaii</SelectItem>
                          <SelectItem value="ID">Idaho</SelectItem>
                          <SelectItem value="IL">Illinois</SelectItem>
                          <SelectItem value="IN">Indiana</SelectItem>
                          <SelectItem value="IA">Iowa</SelectItem>
                          <SelectItem value="KS">Kansas</SelectItem>
                          <SelectItem value="KY">Kentucky</SelectItem>
                          <SelectItem value="LA">Louisiana</SelectItem>
                          <SelectItem value="ME">Maine</SelectItem>
                          <SelectItem value="MD">Maryland</SelectItem>
                          <SelectItem value="MA">Massachusetts</SelectItem>
                          <SelectItem value="MI">Michigan</SelectItem>
                          <SelectItem value="MN">Minnesota</SelectItem>
                          <SelectItem value="MS">Mississippi</SelectItem>
                          <SelectItem value="MO">Missouri</SelectItem>
                          <SelectItem value="MT">Montana</SelectItem>
                          <SelectItem value="NE">Nebraska</SelectItem>
                          <SelectItem value="NV">Nevada</SelectItem>
                          <SelectItem value="NH">New Hampshire</SelectItem>
                          <SelectItem value="NJ">New Jersey</SelectItem>
                          <SelectItem value="NM">New Mexico</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                          <SelectItem value="NC">North Carolina</SelectItem>
                          <SelectItem value="ND">North Dakota</SelectItem>
                          <SelectItem value="OH">Ohio</SelectItem>
                          <SelectItem value="OK">Oklahoma</SelectItem>
                          <SelectItem value="OR">Oregon</SelectItem>
                          <SelectItem value="PA">Pennsylvania</SelectItem>
                          <SelectItem value="RI">Rhode Island</SelectItem>
                          <SelectItem value="SC">South Carolina</SelectItem>
                          <SelectItem value="SD">South Dakota</SelectItem>
                          <SelectItem value="TN">Tennessee</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="UT">Utah</SelectItem>
                          <SelectItem value="VT">Vermont</SelectItem>
                          <SelectItem value="VA">Virginia</SelectItem>
                          <SelectItem value="WA">Washington</SelectItem>
                          <SelectItem value="WV">West Virginia</SelectItem>
                          <SelectItem value="WI">Wisconsin</SelectItem>
                          <SelectItem value="WY">Wyoming</SelectItem>
                          <SelectItem value="DC">District of Columbia</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-1 lg:col-span-3">
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rate</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. $55/hr C2C, $75-85/hour" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-3">
                <FormField
                  control={form.control}
                  name="interviewType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Interview Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select interview type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="phone">Phone</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="onsite">Onsite</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="sm:col-span-6">
                <FormField
                  control={form.control}
                  name="visaRestrictions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visa Restrictions</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. No Sponsorship Available, USC/GC only" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="sm:col-span-6">
                <FormField
                  control={form.control}
                  name="requiredSkills"
                  render={({ field }) => {
                    const [skillInput, setSkillInput] = React.useState("");
                    
                    const handleKeyPress = (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (skillInput.trim()) {
                          addSkill(skillInput);
                          setSkillInput("");
                        }
                      }
                    };

                    const handleAddClick = () => {
                      if (skillInput.trim()) {
                        addSkill(skillInput);
                        setSkillInput("");
                      }
                    };

                    return (
                      <FormItem>
                        <FormLabel>Required Skills</FormLabel>
                        <FormControl>
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Input
                                value={skillInput}
                                onChange={(e) => setSkillInput(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="Type a skill and press Enter"
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                onClick={handleAddClick}
                                size="sm"
                                variant="outline"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {field.value.map((skill, index) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                  {skill}
                                  <button
                                    type="button"
                                    onClick={() => removeSkill(skill)}
                                    className="ml-1 hover:bg-destructive hover:text-destructive-foreground rounded-full p-0.5"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Add skills one by one. Press Enter or click + to add.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
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
            </form>
          </Form>
        </div>
        
        <DialogFooter className="flex-shrink-0 mt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {isPending ? "Creating..." : "Create Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateJobDialog;
