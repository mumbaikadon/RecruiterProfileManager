import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useCheckCandidate } from "@/hooks/use-candidates";
import { analyzeResume, matchResumeToJob, ResumeAnalysisResult } from "@/lib/openai";
// sanitizeHtml is no longer needed since we removed resume analysis
// import { sanitizeHtml } from "@/lib/utils";

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
      console.log("Attempting to parse pasted data:", pastedData.length, "characters");
      console.log("DEBUG - Pasted data:", pastedData);

      // Check for multiple text formats and patterns

      // Format 1: Pattern with -Label: Value format (like the first example)
      const firstNamePattern1 = pastedData.match(/[-]?Legal First Name:?\s*([^\n\r]*)/i) || 
                                pastedData.match(/[-]?First Name:?\s*([^\n\r]*)/i);
      const middleNamePattern1 = pastedData.match(/[-]?Legal Middle Name:?\s*([^\n\r]*)/i) || 
                                 pastedData.match(/[-]?Middle Name:?\s*([^\n\r]*)/i);
      const lastNamePattern1 = pastedData.match(/[-]?Legal Last Name:?\s*([^\n\r]*)/i) || 
                              pastedData.match(/[-]?Last Name:?\s*([^\n\r]*)/i);

      // Format 2: Full legal name format (as per passport)
      const fullNameMatch = pastedData.match(/(?:full legal name|your full legal name|as per passport|legal name):?\s*([^\n\r]*)/i);

      // Format 3: Direct extraction of "Your full legal name (As per passport): Name"
      const fullNameAsPerPassportMatch = pastedData.match(/your full legal name\s*\(as per passport\):?\s*([^\n\r]*)/i);

      console.log("DEBUG - Extracted patterns:", {
        firstNamePattern1,
        middleNamePattern1,
        lastNamePattern1,
        fullNameMatch,
        fullNameAsPerPassportMatch
      });

      // Apply matches in priority order
      if (firstNamePattern1 && firstNamePattern1[1].trim()) {
        form.setValue("firstName", firstNamePattern1[1].trim());
      }

      if (middleNamePattern1 && middleNamePattern1[1].trim()) {
        form.setValue("middleName", middleNamePattern1[1].trim());
      }

      if (lastNamePattern1 && lastNamePattern1[1].trim()) {
        form.setValue("lastName", lastNamePattern1[1].trim());
      }

      // Handle the specific format from the example: "Your full legal name (As per passport): Swornim Malla"
      if (fullNameAsPerPassportMatch && fullNameAsPerPassportMatch[1].trim()) {
        console.log("DEBUG - Found full name format with 'As per passport':", fullNameAsPerPassportMatch[1]);

        const nameParts = fullNameAsPerPassportMatch[1].trim().split(/\s+/);
        if (nameParts.length >= 2) {
          // First part is first name
          form.setValue("firstName", nameParts[0]);

          // Last part is last name
          form.setValue("lastName", nameParts[nameParts.length - 1]);

          // Middle parts (if any) are middle name
          if (nameParts.length > 2) {
            form.setValue("middleName", nameParts.slice(1, nameParts.length - 1).join(" "));
          }
        }
      }
      // If we have a full name match but not individual components, try to parse it
      else if (fullNameMatch && (!firstNamePattern1 || !lastNamePattern1)) {
        const nameParts = fullNameMatch[1].trim().split(/\s+/);
        if (nameParts.length >= 2) {
          // First part is first name
          form.setValue("firstName", nameParts[0]);

          // Last part is last name
          form.setValue("lastName", nameParts[nameParts.length - 1]);

          // Middle parts (if any) are middle name
          if (nameParts.length > 2) {
            form.setValue("middleName", nameParts.slice(1, nameParts.length - 1).join(" "));
          }
        }
      }

      // Extract DOB - multiple formats
      // Format: "DOB: 11th December 1993" or similar variations
      const dobFormatA = pastedData.match(/DOB:?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s+(\d{4})/i);
      // Format: MM/DD/YYYY or MM/DD with variations including "DOB : 06/25"
      const dobFormatB = pastedData.match(/DOB\s*:?\s*(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?/i);

      // Month name format - e.g., "January 15"
      const dobFormatC = pastedData.match(/Birth Month[^:]*:?\s*([a-zA-Z]+)/i);
      const dobDayFormatC = pastedData.match(/Birth Day[^:]*:?\s*(\d{1,2})/i);

      // Debug logging for DOB formats
      console.log("DEBUG - DOB patterns:", { dobFormatA, dobFormatB });

      const monthNameToNumber = (month: string): number => {
        const months: {[key: string]: number} = {
          'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
          'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
          'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'jun': 6, 'jul': 7, 'aug': 8, 
          'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
        };
        return months[month.toLowerCase()] || 0;
      };

      if (dobFormatA) {
        // 11th December 1993 format
        const day = parseInt(dobFormatA[1]);
        const month = monthNameToNumber(dobFormatA[2]);
        if (month > 0 && day > 0) {
          form.setValue("dobMonth", month);
          form.setValue("dobDay", day);
        }
      } else if (dobFormatB) {
        // MM/DD format
        const month = parseInt(dobFormatB[1]);
        const day = parseInt(dobFormatB[2]);
        if (month > 0 && day > 0) {
          form.setValue("dobMonth", month);
          form.setValue("dobDay", day);
        }
      } else if (dobFormatC && dobDayFormatC) {
        // Separate month and day fields
        const month = monthNameToNumber(dobFormatC[1]);
        const day = parseInt(dobDayFormatC[1]);
        if (month > 0 && day > 0) {
          form.setValue("dobMonth", month);
          form.setValue("dobDay", day);
        }
      }

      // Extract SSN last 4 digits - multiple formats
      const ssnPattern1 = pastedData.match(/SSN:?\s*(?:.*?)(\d{4})(?:\D|$)/i); // Last 4 of 123-45-6789
      const ssnPattern2 = pastedData.match(/Last 4 of SSN:?\s*(\d{4})/i); // Explicit "Last 4 of SSN"
      const ssnPattern3 = pastedData.match(/Last 4 SSN:?\s*(\d{4})/i); // Explicit "Last 4 SSN"

      if (ssnPattern1) {
        form.setValue("ssn4", ssnPattern1[1]);
      } else if (ssnPattern2) {
        form.setValue("ssn4", ssnPattern2[1]);
      } else if (ssnPattern3) {
        form.setValue("ssn4", ssnPattern3[1]);
      }

      // Extract email - find any email pattern
      const emailPattern = pastedData.match(/(?:email|e-mail)[^:]*:?\s*([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i) ||
                           pastedData.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
      if (emailPattern) {
        form.setValue("email", emailPattern[1]);
      }

      // Extract phone with international format recognition
      const phonePatterns = [
        // Format: "Phone number: +14697082162" or similar
        pastedData.match(/(?:phone|mobile|cell)[^:]*:?\s*((?:\+\d{1,2}\s?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/i),
        // Any 10-digit number with various separators
        pastedData.match(/(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/),
        // International format
        pastedData.match(/(\+\d{1,2}\s?\d{10})/),
      ];

      const validPhoneMatch = phonePatterns.find(match => match !== null);
      if (validPhoneMatch) {
        form.setValue("phone", validPhoneMatch[1]);
      }

      // Extract LinkedIn - handle multiple formats
      const linkedInPatterns = [
        // Format: linkedin.com/in/username
        pastedData.match(/linkedin\.com\/in\/([a-zA-Z0-9-]+)/i),
        // Format: LinkedIn: https://www.linkedin.com/...
        pastedData.match(/linkedin:?\s*(https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+)/i),
        // Full URL in text
        pastedData.match(/(https?:\/\/(?:www\.)?linkedin\.com\/[^\s]+)/i)
      ];

      const validLinkedInMatch = linkedInPatterns.find(match => match !== null);
      if (validLinkedInMatch) {
        if (validLinkedInMatch[1].startsWith('http')) {
          form.setValue("linkedIn", validLinkedInMatch[1]);
        } else if (validLinkedInMatch[0].includes('linkedin.com/')) {
          form.setValue("linkedIn", `https://${validLinkedInMatch[0].trim()}`);
        } else {
          form.setValue("linkedIn", `https://linkedin.com/in/${validLinkedInMatch[1]}`);
        }
      }

      // Extract location - handle multiple formats
      const locationPatterns = [
        // Format: "Location: City, State" or "Location - City, State"
        pastedData.match(/(?:location|current location|address)[^:]*:?\s*([^,\n\r]+,\s*[A-Z]{2}(?:\s+\d{5})?)/i),
        // Format: "City, State ZIP"
        pastedData.match(/([A-Za-z\s.-]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i),
        // Format: "City, State"
        pastedData.match(/([A-Za-z\s.-]+,\s*[A-Z]{2})(?:\s|$)/i),
        // Format with TX, FL, etc.
        pastedData.match(/([A-Za-z\s.-]+,\s*(?:TX|FL|CA|NY|IL|PA|OH|GA|NC|MI|NJ|VA|WA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|ID|WV|HI|NH|ME|MT|RI|DE|SD|ND|AK|DC|VT|WY))/i)
      ];

      const validLocationMatch = locationPatterns.find(match => match !== null);
      if (validLocationMatch) {
        form.setValue("location", validLocationMatch[1].trim());
      }

      // Extract work authorization - multiple formats
      const workAuthPatterns = [
        // Format: "Work Authorization: GC EAD" or similar
        pastedData.match(/work\s*authorization[^:]*:?\s*([^\n\r,;]+)/i),
        // GC EAD, H1B, etc. specific formats
        pastedData.match(/(?:GC\s*EAD|Green\s*Card|H1-?B|EAD|VISA|Citizen|STEM\s*OPT)/i),
        // Key phrases
        pastedData.match(/(?:authorized\s*to\s*work|visa\s*status|work\s*permit)[^:]*:?\s*([^\n\r,;]+)/i)
      ];

      console.log("DEBUG - Work authorization patterns:", workAuthPatterns);

      const validAuthMatch = workAuthPatterns.find(match => match !== null);
      if (validAuthMatch) {
        const authText = validAuthMatch[1] || validAuthMatch[0];
        const authLower = authText.toLowerCase().trim();

        // Map common authorization texts to our dropdown values
        if (authLower.includes('citizen')) {
          form.setValue("workAuthorization", "citizen");
        } else if (authLower.match(/green\s*card/i) || authLower.match(/permanent\s*resident/i)) {
          form.setValue("workAuthorization", "green-card");
        } else if (authLower.match(/h-?1-?b/i) || authLower.match(/h1-?b/i)) {
          form.setValue("workAuthorization", "h1b");
        } else if (authLower.match(/ead/) || authLower.match(/gc\s*ead/i)) {
          form.setValue("workAuthorization", "ead");
        } else if (authLower.match(/stem\s*opt/i) || authLower.match(/opt/i)) {
          // Handle STEM OPT and OPT as a special case
          form.setValue("workAuthorization", "other");
          setShowOtherAuthorizationInput(true);
          setOtherAuthorization(authText.trim());
        } else {
          form.setValue("workAuthorization", "other");
          setShowOtherAuthorizationInput(true);
          setOtherAuthorization(authText.trim());
        }
      }

      // Fallback approach for name parsing if none of the above patterns matched
      if (!form.getValues("firstName") && !form.getValues("lastName")) {
        // Look for common name patterns
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
  }, [pastedData, form, setShowOtherAuthorizationInput, setOtherAuthorization]);

  const handlePasteDataChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPastedData(e.target.value);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setIsAnalyzing(true);

    try {
      // Check if file type is actually supported
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.pdf') && !fileName.endsWith('.doc') && !fileName.endsWith('.docx') && !fileName.endsWith('.txt')) {
        throw new Error("File format not supported. Please use PDF, Word documents, or plain text files only.");
      }

      // Process file with resume handling
      const result = await analyzeResume(file);
      setResumeText(result.text);
      setResumeData(result.analysis);

      try {
        // Use OpenAI to match resume against job description
        console.log("Starting resume matching with OpenAI...");
        
        // For new candidates, we don't have an ID yet
        const candidateId = undefined;
        
        // Include candidateId when matched, to store employment history in the database
        const matchResult = await matchResumeToJob(
          result.text, 
          jobDescription,
          candidateId ? parseInt(candidateId.toString()) : undefined
        );
        
        console.log("Resume match results:", matchResult);
        
        // Set the real analysis results
        setMatchResults(matchResult);
        
        // Update resumeData with employment history from the match results
        setResumeData((prevData: ResumeAnalysisResult) => ({
          ...prevData,
          clientNames: matchResult.clientNames || prevData.clientNames,
          jobTitles: matchResult.jobTitles || prevData.jobTitles,
          relevantDates: matchResult.relevantDates || prevData.relevantDates
        }));
        
        // Log the updated data for debugging
        console.log("Updated resume data with employment history:", {
          clientNames: matchResult.clientNames || [],
          jobTitles: matchResult.jobTitles || [],
          relevantDates: matchResult.relevantDates || []
        });
        
        toast({
          title: "Resume Analysis Complete",
          description: `Match score: ${matchResult.score}%`,
        });
      } catch (error) {
        console.error("Error matching resume:", error);
        toast({
          title: "Resume Analysis Issue",
          description: error instanceof Error ? error.message : "Could not analyze resume against job description",
          variant: "destructive",
        });
        
        // Provide fallback match results in case of error
        setMatchResults({
          score: 0,
          strengths: [],
          weaknesses: ["Failed to analyze against job description"],
          suggestions: ["Please try again or proceed with manual evaluation"],
          technicalGaps: [],
          matchingSkills: [],
          missingSkills: [],
          clientExperience: "",
          confidence: 0
        });
      }

      toast({
        title: "Resume Uploaded",
        description: "Resume file has been uploaded successfully.",
      });
    } catch (error: any) {
      console.error("Error processing resume:", error);
      toast({
        title: "Resume Upload Notice",
        description: error.message || "The resume file couldn't be processed. You can still submit using the form fields.",
      });

      // Create minimal resume data even when there's an error
      setResumeData({
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: file.name,
        fileName: file.name
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
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center
                      ${matchResults.score >= 70 ? 'bg-green-100' : 
                        matchResults.score >= 40 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                      <span className={`text-lg font-semibold
                        ${matchResults.score >= 70 ? 'text-green-600' : 
                          matchResults.score >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {matchResults.score}%
                      </span>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-900">Match Score</p>
                      <p className="text-sm text-gray-500">Based on job description alignment</p>
                      {matchResults.score < 30 && (
                        <p className="text-xs text-red-500 mt-1">
                          Low match score indicates skills or experience may not align well with the position
                        </p>
                      )}
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
                    <h5 className="text-sm font-medium text-gray-700 mb-3">Extracted Employment History:</h5>
                    
                    {/* Try to get employment history from either resumeData or matchResults */}
                    {(() => {
                      // First try resumeData
                      let clientNames = resumeData.clientNames;
                      let jobTitles = resumeData.jobTitles;
                      let relevantDates = resumeData.relevantDates;
                      
                      // If not available in resumeData, try matchResults
                      if ((!clientNames || clientNames.length === 0) && matchResults?.clientNames) {
                        console.log("Using employment history from matchResults instead of resumeData");
                        clientNames = matchResults.clientNames;
                        jobTitles = matchResults.jobTitles;
                        relevantDates = matchResults.relevantDates;
                      }
                      
                      if (clientNames && clientNames.length > 0) {
                        return (
                          <div className="space-y-3">
                            <div className="mb-2">
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                {clientNames.length} positions found
                              </span>
                            </div>
                            
                            {/* Employment history list */}
                            {clientNames.map((client: string, index: number) => (
                              <div key={index} className="border-l-2 border-blue-200 pl-3 py-1">
                                <div className="flex justify-between items-start">
                                  <p className="text-sm font-medium text-gray-800">
                                    {jobTitles && jobTitles[index] ? jobTitles[index] : "Unknown Position"}
                                  </p>
                                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {relevantDates && relevantDates[index] ? relevantDates[index] : "No date"}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">{client}</p>
                              </div>
                            ))}
                          </div>
                        );
                      } else {
                        return (
                          <div>
                            <div className="text-sm text-gray-500 italic mb-2">No employment history detected</div>
                            <div className="text-xs text-gray-400">
                              Debug info: <br/>
                              resumeData.clientNames={JSON.stringify(resumeData.clientNames)}<br/>
                              matchResults.clientNames={JSON.stringify(matchResults?.clientNames)}
                            </div>
                          </div>
                        );
                      }
                    })()}
                    
                    {/* Skills overview */}
                    {resumeData.skills && resumeData.skills.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-500 mb-1">Skills:</p>
                        <div className="flex flex-wrap gap-1">
                          {resumeData.skills.map((skill: string, index: number) => (
                            <span key={index} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
