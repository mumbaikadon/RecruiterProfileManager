import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useCheckCandidate } from "@/hooks/use-candidates";
import { analyzeResume, matchResumeToJob } from "@/lib/openai";
import { sanitizeHtml } from "@/lib/utils";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export const candidateFormSchema = z.object({
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

export type CandidateFormValues = z.infer<typeof candidateFormSchema>;

interface CandidateFormProps {
  jobId: number;
  jobTitle: string;
  jobDescription: string;
  onSubmit: (values: CandidateFormValues & {
    resumeData?: any;
    matchResults?: any;
  }) => void;
  isPending?: boolean;
}

const CandidateForm: React.FC<CandidateFormProps> = ({
  jobId,
  jobTitle,
  jobDescription,
  onSubmit,
  isPending = false
}) => {
  const [pastedData, setPastedData] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [resumeData, setResumeData] = useState<any | null>(null);
  const [matchResults, setMatchResults] = useState<any | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [candidateExists, setCandidateExists] = useState(false);
  const [showOtherAuthorizationInput, setShowOtherAuthorizationInput] = useState(false);
  const [otherAuthorization, setOtherAuthorization] = useState("");
  
  const { toast } = useToast();
  const { mutateAsync: checkCandidate } = useCheckCandidate();
  
  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
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

  useEffect(() => {
    // Attempt to extract data from pasted text
    if (pastedData.length > 0) {
      // First, check for structured data format with field labels
      const firstNameMatch = pastedData.match(/Legal First Name:([^\n]+)/i);
      if (firstNameMatch && firstNameMatch[1].trim()) {
        form.setValue("firstName", firstNameMatch[1].trim());
      }

      const middleNameMatch = pastedData.match(/Legal Middle Name:([^\n]+)/i);
      if (middleNameMatch && middleNameMatch[1].trim()) {
        form.setValue("middleName", middleNameMatch[1].trim());
      }

      const lastNameMatch = pastedData.match(/Legal Last Name:([^\n]+)/i);
      if (lastNameMatch && lastNameMatch[1].trim()) {
        form.setValue("lastName", lastNameMatch[1].trim());
      }

      // Extract DOB in MM/DD format
      const dobMatch = pastedData.match(/Month\/Day of Birth:?\s*(\d{1,2})\/(\d{1,2})/i);
      if (dobMatch) {
        form.setValue("dobMonth", parseInt(dobMatch[1]));
        form.setValue("dobDay", parseInt(dobMatch[2]));
      }

      // Extract SSN last 4
      const ssnMatch = pastedData.match(/Social Security Text:?\s*(\d{4})/i);
      if (ssnMatch) {
        form.setValue("ssn4", ssnMatch[1]);
      }

      // Extract email
      const emailMatch = pastedData.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailMatch) {
        form.setValue("email", emailMatch[1]);
      }

      // Extract phone
      const phoneMatch = pastedData.match(/(\+?1?\s*\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4})/);
      if (phoneMatch) {
        form.setValue("phone", phoneMatch[1]);
      }

      // Extract LinkedIn
      const linkedInMatch = pastedData.match(/(linkedin\.com\/in\/[a-zA-Z0-9-]+)/);
      if (linkedInMatch) {
        form.setValue("linkedIn", `https://${linkedInMatch[1]}`);
      }

      // Extract location
      const locationMatch = pastedData.match(/(?:located in|located at|location:|from)\s+([A-Za-z\s]+,\s+[A-Z]{2})/i);
      if (locationMatch) {
        form.setValue("location", locationMatch[1]);
      }

      // If no structured matches were found, try general pattern matching as fallback
      if (!firstNameMatch && !lastNameMatch) {
        const nameMatch = pastedData.match(/([A-Z][a-z]+)\s+(?:([A-Z][a-z]+)\s+)?([A-Z][a-z]+)/);
        if (nameMatch) {
          form.setValue("firstName", nameMatch[1]);
          if (nameMatch[2] && nameMatch[3]) {
            form.setValue("middleName", nameMatch[2]);
            form.setValue("lastName", nameMatch[3]);
          } else if (nameMatch[2]) {
            form.setValue("lastName", nameMatch[2]);
          }
        }
      }
    }
  }, [pastedData, form]);
  
  const handlePasteDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPastedData(e.target.value);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setResumeFile(file);
    setIsAnalyzing(true);
    
    try {
      // Process the resume
      const result = await analyzeResume(file);
      setResumeText(result.text);
      setResumeData(result.analysis);
      
      // Sanitize job description and resume text before matching
      const sanitizedJobDescription = sanitizeHtml(jobDescription);
      const sanitizedResumeText = sanitizeHtml(result.text);
      
      // Match against job description
      const matchResult = await matchResumeToJob(sanitizedResumeText, sanitizedJobDescription);
      setMatchResults(matchResult);
      
    } catch (error) {
      console.error("Error analyzing resume:", error);
      toast({
        title: "Resume Analysis Failed",
        description: "Failed to analyze the resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleSubmitForm = async (values: CandidateFormValues) => {
    try {
      // Check if candidate already exists
      const result = await checkCandidate({
        dobMonth: values.dobMonth,
        dobDay: values.dobDay,
        ssn4: values.ssn4
      });
      
      if (result.exists) {
        setCandidateExists(true);
        toast({
          title: "Candidate Already Exists",
          description: "This candidate already exists in the system.",
          variant: "destructive",
        });
        return;
      }
      
      // If work authorization is "other" without custom input, show error
      if (values.workAuthorization === "other" && !otherAuthorization) {
        toast({
          title: "Missing Information",
          description: "Please specify the work authorization type.",
          variant: "destructive",
        });
        return;
      }
      
      // Include resume data and match results if available
      onSubmit({
        ...values,
        resumeData: resumeData,
        matchResults: matchResults
      });
    } catch (error) {
      console.error("Error submitting candidate:", error);
      toast({
        title: "Submission Failed",
        description: "Failed to submit candidate. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  // Watch for fields to check candidate identity
  const dobMonth = form.watch("dobMonth");
  const dobDay = form.watch("dobDay");
  const ssn4 = form.watch("ssn4");
  
  // Check candidate existence when identity fields change
  useEffect(() => {
    const checkExistingCandidate = async () => {
      if (dobMonth && dobDay && ssn4?.length === 4) {
        try {
          const result = await checkCandidate({
            dobMonth,
            dobDay,
            ssn4
          });
          
          setCandidateExists(result.exists);
          
          if (result.exists) {
            toast({
              title: "Candidate Already Exists",
              description: "This candidate already exists in the system.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error checking candidate:", error);
        }
      }
    };
    
    checkExistingCandidate();
  }, [dobMonth, dobDay, ssn4, checkCandidate, toast]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <h2 className="text-lg font-medium text-gray-900">
          Submit Candidate for Job: {jobTitle}
        </h2>
        <p className="text-sm text-gray-500">
          Job ID: {jobId}
        </p>
      </div>
      
      {candidateExists && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Candidate Already Exists</AlertTitle>
          <AlertDescription>
            This candidate is already in the system. Please select a different candidate or check if they've already been submitted for this job.
          </AlertDescription>
        </Alert>
      )}
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmitForm)} className="space-y-6">
          {/* Paste Data Section */}
          <div className="sm:col-span-6">
            <FormLabel htmlFor="paste-data">Paste Candidate Information</FormLabel>
            <Textarea
              id="paste-data"
              value={pastedData}
              onChange={handlePasteDataChange}
              rows={4}
              placeholder="Paste candidate information here for automatic field mapping..."
            />
            <p className="mt-2 text-sm text-gray-500">Or fill out the fields manually below.</p>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="middleName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Middle Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Identity Fields */}
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="dobMonth"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Month (1-12)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" max="12" placeholder="MM" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="dobDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth Day (1-31)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="1" max="31" placeholder="DD" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="ssn4"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last 4 of SSN</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={4} placeholder="1234" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="City, State" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Professional Fields */}
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="linkedIn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>LinkedIn Profile</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://linkedin.com/in/..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="workAuthorization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Authorization</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value === "other") {
                          setShowOtherAuthorizationInput(true);
                        } else {
                          setShowOtherAuthorizationInput(false);
                          setOtherAuthorization("");
                        }
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="citizen">US Citizen</SelectItem>
                        <SelectItem value="green-card">Green Card</SelectItem>
                        <SelectItem value="h1b">H1-B Visa</SelectItem>
                        <SelectItem value="ead">EAD</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {showOtherAuthorizationInput && (
                      <div className="mt-2">
                        <Input 
                          placeholder="Specify work authorization" 
                          value={otherAuthorization}
                          onChange={(e) => {
                            setOtherAuthorization(e.target.value);
                            // Update the form value to include custom input
                            field.onChange(`other:${e.target.value}`);
                          }}
                        />
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="sm:col-span-2">
              <FormField
                control={form.control}
                name="agreedRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreed Rate ($/hr)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Resume Upload */}
          <div className="sm:col-span-3">
            <FormLabel htmlFor="resume">Resume Upload</FormLabel>
            <Input
              id="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeUpload}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-blue-600"
            />
            <p className="mt-2 text-sm text-gray-500">PDF or Word document only.</p>
            
            {isAnalyzing && (
              <div className="mt-2 flex items-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                Analyzing resume...
              </div>
            )}
          </div>

          {/* Resume Analysis Results */}
          {matchResults && (
            <Card>
              <CardHeader>
                <CardTitle>Resume Analysis</CardTitle>
                <CardDescription>Based on the uploaded resume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-primary text-lg font-semibold">{matchResults.score}%</span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Match Score</p>
                      <p className="text-sm text-gray-500">Based on job description alignment</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Strengths:</h5>
                  <ul className="pl-5 text-sm text-gray-600 list-disc">
                    {matchResults.strengths.map((strength: string, index: number) => (
                      <li key={index} className="mb-1">{strength}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Potential Gaps:</h5>
                  <ul className="pl-5 text-sm text-gray-600 list-disc">
                    {matchResults.weaknesses.map((weakness: string, index: number) => (
                      <li key={index} className="mb-1">{weakness}</li>
                    ))}
                  </ul>
                </div>
                
                {resumeData && (
                  <div>
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Extracted Resume Data:</h5>
                    <div className="grid grid-cols-1 gap-y-2 gap-x-4 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <p className="text-xs text-gray-500">Client History:</p>
                        <p className="text-sm text-gray-700">{resumeData.clientNames.join(", ") || "None detected"}</p>
                      </div>
                      <div className="sm:col-span-1">
                        <p className="text-xs text-gray-500">Recent Job Title:</p>
                        <p className="text-sm text-gray-700">{resumeData.jobTitles[0] || "None detected"}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end space-x-3">
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending || isAnalyzing || candidateExists}
            >
              {isPending ? "Submitting..." : "Submit Candidate"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CandidateForm;
