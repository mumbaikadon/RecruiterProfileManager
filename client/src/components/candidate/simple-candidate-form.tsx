import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, User, MapPin, Phone, Mail, DollarSign, FileText } from "lucide-react";

export const simpleCandidateSchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(2, "Last name is required"),
  dobMonth: z.coerce.number().min(1).max(12, "Must be a valid month (1-12)"),
  dobDay: z.coerce.number().min(1).max(31, "Must be a valid day (1-31)"),
  ssn4: z.string().length(4, "Must be exactly 4 digits").regex(/^\d{4}$/, "Must be 4 digits"),
  location: z.string().min(2, "Location is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  linkedIn: z.string().url("Must be a valid URL").or(z.string().length(0)).optional(),
  workAuthorization: z.string().min(1, "Work authorization is required"),
  agreedRate: z.coerce.number().min(1, "Agreed rate is required"),
});

export type SimpleCandidateFormValues = z.infer<typeof simpleCandidateSchema>;

interface SimpleCandidateFormProps {
  jobId: number;
  jobTitle: string;
  onSubmit: (values: SimpleCandidateFormValues & { resumeFile?: File }) => void;
  isPending?: boolean;
}

const workAuthorizationOptions = [
  { value: "US Citizen", label: "US Citizen" },
  { value: "Green Card", label: "Green Card" },
  { value: "H1B", label: "H1B" },
  { value: "EAD", label: "EAD" },
  { value: "F1 OPT", label: "F1 OPT" },
  { value: "F1 CPT", label: "F1 CPT" },
  { value: "TN Visa", label: "TN Visa" },
  { value: "L1", label: "L1" },
  { value: "O1", label: "O1" },
  { value: "Other", label: "Other" },
];

const SimpleCandidateForm: React.FC<SimpleCandidateFormProps> = ({
  jobId,
  jobTitle,
  onSubmit,
  isPending = false
}) => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [showOtherAuthorizationInput, setShowOtherAuthorizationInput] = useState(false);
  const [otherAuthorization, setOtherAuthorization] = useState("");
  
  const { toast } = useToast();

  const form = useForm<SimpleCandidateFormValues>({
    resolver: zodResolver(simpleCandidateSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      dobMonth: 0,
      dobDay: 0,
      ssn4: "",
      location: "",
      email: "",
      phone: "",
      linkedIn: "",
      workAuthorization: "",
      agreedRate: 0,
    }
  });

  const handleSubmit = (values: SimpleCandidateFormValues) => {
    // Use other authorization if "Other" was selected
    const finalValues = {
      ...values,
      workAuthorization: showOtherAuthorizationInput ? otherAuthorization : values.workAuthorization,
    };

    // Validate other authorization if selected
    if (showOtherAuthorizationInput && !otherAuthorization.trim()) {
      toast({
        title: "Work Authorization Required",
        description: "Please specify your work authorization status.",
        variant: "destructive",
      });
      return;
    }

    onSubmit({ ...finalValues, resumeFile: resumeFile || undefined });
  };

  const handleWorkAuthorizationChange = (value: string) => {
    form.setValue("workAuthorization", value);
    setShowOtherAuthorizationInput(value === "Other");
    if (value !== "Other") {
      setOtherAuthorization("");
    }
  };

  const handleFileSelect = (file: File | null) => {
    if (file) {
      setResumeFile(file);
      toast({
        title: "Resume uploaded",
        description: `${file.name} has been selected`,
      });
    } else {
      setResumeFile(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Submit Candidate for {jobTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Resume Upload Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <h3 className="font-medium">Resume Upload</h3>
                </div>
                <FileUpload
                  onFileChange={handleFileSelect}
                  accept=".pdf,.doc,.docx"
                  maxSize={10 * 1024 * 1024} // 10MB
                />
                {resumeFile && (
                  <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                    <Upload className="h-3 w-3" />
                    {resumeFile.name}
                  </Badge>
                )}
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="middleName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Middle Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Michael" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Date of Birth & SSN */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="dobMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birth Month *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="MM" 
                          min="1" 
                          max="12" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dobDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Birth Day *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="DD" 
                          min="1" 
                          max="31" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ssn4"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last 4 SSN *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1234" 
                          maxLength={4}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location *
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="City, State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone *
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email *
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="john.doe@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="linkedIn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LinkedIn Profile</FormLabel>
                      <FormControl>
                        <Input placeholder="https://linkedin.com/in/johndoe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Work Authorization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="workAuthorization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Authorization *</FormLabel>
                      <Select onValueChange={handleWorkAuthorizationChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select work authorization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {workAuthorizationOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {showOtherAuthorizationInput && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Specify Other Authorization *</label>
                    <Input
                      placeholder="Enter work authorization status"
                      value={otherAuthorization}
                      onChange={(e) => setOtherAuthorization(e.target.value)}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="agreedRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Agreed Rate ($/hr) *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="65" 
                          min="1"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isPending} className="min-w-32">
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Candidate"
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleCandidateForm;