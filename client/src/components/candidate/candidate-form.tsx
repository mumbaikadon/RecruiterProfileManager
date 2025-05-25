import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useCheckCandidate } from "@/hooks/use-candidates";
import { analyzeResume, matchResumeToJob, ResumeAnalysisResult } from "@/lib/openai";

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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, AlertTriangle, CheckCircle } from "lucide-react";

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
  initialValues?: Partial<CandidateFormValues>;
  applicationResumeFileName?: string;
}

const CandidateForm: React.FC<CandidateFormProps> = ({
  jobId,
  jobTitle,
  jobDescription,
  onSubmit,
  isPending = false,
  initialValues,
  applicationResumeFileName
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
  const [existingResumeFileName, setExistingResumeFileName] = useState<string | undefined>(applicationResumeFileName);
  const [isLoadingExistingResume, setIsLoadingExistingResume] = useState<boolean>(false);
  const [validationWarning, setValidationWarning] = useState<{
    title: string;
    message: string;
    detail: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    matchedCandidates?: { id: number; name: string; similarityScore: number }[];
  } | null>(null);

  const { toast } = useToast();
  const { mutateAsync: checkCandidate } = useCheckCandidate();

  // Effect to load existing resume file when provided from application
  useEffect(() => {
    if (existingResumeFileName && !resumeFile && !isLoadingExistingResume) {
      const loadExistingResume = async () => {
        try {
          setIsLoadingExistingResume(true);
          
          // First, fetch the resume file
          console.log("Fetching existing resume file:", existingResumeFileName);
          const response = await fetch(`/uploads/${existingResumeFileName}`);
          
          if (!response.ok) {
            console.error("Failed to fetch resume file:", response.statusText);
            toast({
              title: "Resume Loading Error",
              description: "Could not load the existing resume file. You may need to upload a new one.",
              variant: "destructive",
            });
            setIsLoadingExistingResume(false);
            return;
          }
          
          // Convert the response to a blob and create a file object
          const blob = await response.blob();
          const file = new File([blob], existingResumeFileName, { type: blob.type });
          
          // Process the file using the same function as direct uploads
          // This ensures consistent processing for all resumes
          setIsLoadingExistingResume(false);
          
          // Manually call the resume upload handler
          // Create a synthetic event object with the file
          const syntheticEvent = {
            target: {
              files: [file]
            }
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          
          // Process using the same function as direct uploads
          await handleResumeUpload(syntheticEvent);
          
        } catch (error) {
          console.error("Error loading existing resume:", error);
          toast({
            title: "Resume Loading Error",
            description: "There was an error loading the existing resume. You may need to upload a new one.",
            variant: "destructive",
          });
          setIsLoadingExistingResume(false);
        }
      };
      
      loadExistingResume();
    }
  }, [existingResumeFileName, resumeFile, isLoadingExistingResume, toast]);

  // Process initial values to ensure types match the schema
  const processedInitialValues = {
    firstName: initialValues?.firstName || "",
    middleName: initialValues?.middleName || "",
    lastName: initialValues?.lastName || "",
    // Convert dobMonth and dobDay to numbers if they're strings
    dobMonth: typeof initialValues?.dobMonth === 'string' 
      ? parseInt(initialValues.dobMonth) || 0 
      : initialValues?.dobMonth || 0,
    dobDay: typeof initialValues?.dobDay === 'string' 
      ? parseInt(initialValues.dobDay) || 0 
      : initialValues?.dobDay || 0,
    ssn4: initialValues?.ssn4 || "",
    location: initialValues?.location || "",
    email: initialValues?.email || "",
    phone: initialValues?.phone || "",
    linkedIn: initialValues?.linkedIn || "",
    workAuthorization: initialValues?.workAuthorization || "",
    // Convert agreedRate to number if it's a string
    agreedRate: typeof initialValues?.agreedRate === 'string' 
      ? parseFloat(initialValues.agreedRate) || 0 
      : initialValues?.agreedRate || 0,
  };

  const form = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: processedInitialValues
  });

  useEffect(() => {
    // Attempt to extract data from pasted text
    if (pastedData.length > 0) {
      console.log("Attempting to parse pasted data:", pastedData.length, "characters");
      
      // Try to detect JSON format first
      let isJsonData = false;
      let jsonData = null;
      
      try {
        // Check if this is JSON data (either complete JSON or JSON-like format)
        if ((pastedData.trim().startsWith('{') && pastedData.trim().endsWith('}')) ||
            pastedData.includes('":"') || pastedData.includes('": "')) {
          
          // Clean up the data if it's not properly formatted
          let cleanedData = pastedData;
          
          // Replace single quotes with double quotes if needed
          if (cleanedData.includes("'") && !cleanedData.includes('"')) {
            cleanedData = cleanedData.replace(/'/g, '"');
          }
          
          // Try to parse as JSON
          jsonData = JSON.parse(cleanedData);
          isJsonData = true;
          console.log("Detected JSON format:", jsonData);
        }
      } catch (e) {
        console.log("Not valid JSON, trying other formats:", e);
        // Try to normalize some common formatting issues in JSON
        try {
          // Handle trailing commas that cause JSON parse errors
          if (pastedData.includes(',') && pastedData.includes('{') && pastedData.includes('}')) {
            const normalizedData = pastedData
              .replace(/,\s*}/g, '}')  // Remove trailing commas before closing braces
              .replace(/,\s*\n\s*}/g, '\n}') // Remove trailing commas before newline then closing brace
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":'); // Ensure property names are quoted
            
            jsonData = JSON.parse(normalizedData);
            isJsonData = true;
            console.log("Parsed normalized JSON format:", jsonData);
          }
        } catch(e2) {
          console.log("Failed to normalize and parse JSON:", e2);
        }
      }
      
      if (isJsonData && jsonData) {
        // Process JSON format
        console.log("Processing JSON format data");
        
        // Map common field names to our form fields
        const nameFields = ['Name', 'name', 'full name', 'fullName', 'full_name', 'legal name', 'legalName'];
        const firstNameFields = ['firstName', 'first name', 'first_name', 'fname'];
        const middleNameFields = ['middleName', 'middle name', 'middle_name', 'mname'];
        const lastNameFields = ['lastName', 'last name', 'last_name', 'lname'];
        const locationFields = ['Location', 'location', 'address', 'current location', 'currentLocation'];
        const emailFields = ['Email', 'email', 'email address', 'emailAddress', 'email_address'];
        const phoneFields = ['Phone', 'phone', 'phone number', 'phoneNumber', 'phone_number', 'mobile'];
        const linkedInFields = ['LinkedIn', 'linkedin', 'linkedin url', 'linkedinUrl', 'linkedin_url'];
        const authFields = ['Visa Type', 'visa type', 'visaType', 'visa', 'workAuthorization', 'work authorization', 'authorization'];
        const dobFields = ['DOB', 'dob', 'date of birth', 'dateOfBirth', 'birth date', 'birthDate'];
        const ssnFields = ['SSN', 'ssn', 'last four ssn', 'lastFourSSN', 'Last Four SSN', 'ssn4', 'SSN4'];
        
        // Helper to find value by field names
        const findValueByFields = (fields: string[]) => {
          for (const field of fields) {
            if (jsonData && jsonData[field] !== undefined) {
              return jsonData[field];
            }
          }
          return null;
        };
        
        // Process name
        let fullName = findValueByFields(nameFields);
        const firstName = findValueByFields(firstNameFields);
        const middleName = findValueByFields(middleNameFields);
        const lastName = findValueByFields(lastNameFields);
        
        if (fullName) {
          console.log("Found full name:", fullName);
          const nameParts = fullName.trim().split(/\s+/);
          if (nameParts.length >= 2) {
            form.setValue("firstName", nameParts[0]);
            form.setValue("lastName", nameParts[nameParts.length - 1]);
            
            if (nameParts.length > 2) {
              form.setValue("middleName", nameParts.slice(1, nameParts.length - 1).join(" "));
            }
          }
        } else {
          if (firstName) form.setValue("firstName", firstName);
          if (middleName) form.setValue("middleName", middleName);
          if (lastName) form.setValue("lastName", lastName);
        }
        
        // Process location
        const location = findValueByFields(locationFields);
        if (location) {
          console.log("Found location:", location);
          form.setValue("location", location);
        }
        
        // Process email
        const email = findValueByFields(emailFields);
        if (email) {
          console.log("Found email:", email);
          form.setValue("email", email);
        }
        
        // Process phone
        const phone = findValueByFields(phoneFields);
        if (phone) {
          console.log("Found phone:", phone);
          let cleanPhone = phone.toString().replace(/\D/g, '');
          form.setValue("phone", cleanPhone);
        }
        
        // Process LinkedIn
        const linkedin = findValueByFields(linkedInFields);
        if (linkedin) {
          console.log("Found LinkedIn:", linkedin);
          form.setValue("linkedIn", linkedin);
        }
        
        // Process Work Authorization
        const authorization = findValueByFields(authFields);
        if (authorization) {
          console.log("Found authorization:", authorization);
          const authLower = authorization.toString().toLowerCase();
          
          if (authLower.includes('usc') || authLower.includes('citizen') || authLower.includes('us citizen')) {
            form.setValue("workAuthorization", "citizen");
          } else if (authLower.match(/green\s*card/i) || authLower.match(/permanent\s*resident/i)) {
            form.setValue("workAuthorization", "green-card");
          } else if (authLower.match(/h-?1-?b/i) || authLower.match(/h1-?b/i)) {
            form.setValue("workAuthorization", "h1b");
          } else if (authLower.match(/ead/i) && !authLower.match(/h-?4/i)) {
            form.setValue("workAuthorization", "ead");
          } else if (authLower.match(/h-?4\s*ead/i) || (authLower.match(/h-?4/i) && authLower.match(/ead/i))) {
            form.setValue("workAuthorization", "other");
            setShowOtherAuthorizationInput(true);
            setOtherAuthorization("H4 EAD");
          } else if (authLower.match(/h-?4/i)) {
            form.setValue("workAuthorization", "other");
            setShowOtherAuthorizationInput(true);
            setOtherAuthorization("H4");
          } else {
            form.setValue("workAuthorization", "other");
            setShowOtherAuthorizationInput(true);
            setOtherAuthorization(authorization);
          }
        }
        
        // Check for work authorization in any field if not found in specific work auth fields
        if (!form.getValues("workAuthorization")) {
          for (const key in jsonData) {
            const value = jsonData[key];
            if (typeof value === 'string') {
              const valueStr = value.toString().toLowerCase();
              
              // Check common authorization words in any field
              if (valueStr.includes('usc') || valueStr.includes('citizen') || valueStr.includes('us citizen')) {
                console.log(`Found US Citizen work authorization in field ${key}: ${value}`);
                form.setValue("workAuthorization", "citizen");
                break;
              } else if (valueStr.match(/green\s*card/i) || valueStr.match(/permanent\s*resident/i)) {
                console.log(`Found Green Card work authorization in field ${key}: ${value}`);
                form.setValue("workAuthorization", "green-card");
                break;
              } else if (valueStr.match(/h-?1-?b/i) || valueStr.match(/h1-?b/i)) {
                console.log(`Found H1B work authorization in field ${key}: ${value}`);
                form.setValue("workAuthorization", "h1b");
                break;
              } else if (valueStr.match(/h-?4\s*ead/i) || (valueStr.match(/h-?4/i) && valueStr.match(/ead/i))) {
                console.log(`Found H4 EAD work authorization in field ${key}: ${value}`);
                form.setValue("workAuthorization", "other");
                setShowOtherAuthorizationInput(true);
                setOtherAuthorization("H4 EAD");
                break;
              } else if (valueStr.match(/\bead\b/i) && !valueStr.match(/h-?4/i)) {
                console.log(`Found EAD work authorization in field ${key}: ${value}`);
                form.setValue("workAuthorization", "ead");
                break;
              }
            }
          }
        }
        
        // Process DOB
        const dob = findValueByFields(dobFields);
        if (dob) {
          console.log("Found DOB:", dob);
          const dobStr = dob.toString();
          
          // First try to parse as a direct number in MM/DD format (could be without separator)
          if (/^\d{4}$/.test(dobStr)) {
            // Format could be MMDD without separators
            const month = parseInt(dobStr.substring(0, 2));
            const day = parseInt(dobStr.substring(2, 4));
            
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              console.log(`Setting DOB from 4-digit format: Month=${month}, Day=${day}`);
              form.setValue("dobMonth", month);
              form.setValue("dobDay", day);
            }
          } else {
            // Handle various date formats with separators
            // Look for date formats with year (MM/DD/YYYY or DD/MM/YYYY)
            const dateWithYearMatch = dobStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
            // Then look for date formats without year (MM/DD or DD/MM)
            const dateWithoutYearMatch = dobStr.match(/(\d{1,2})[\/\-\.](\d{1,2})/);
            // Also try to handle formats where DOB is just numbers directly (like "DOB: 06/07/1996")
            const directMatch = /(\d{1,2})[\/\-\.](\d{1,2})/.exec(dobStr);
            
            // Process the matches in order of specificity
            if (dateWithYearMatch) {
              let month = parseInt(dateWithYearMatch[1]);
              let day = parseInt(dateWithYearMatch[2]);
              
              // Intelligently determine if we have DD/MM/YYYY or MM/DD/YYYY format
              if (month > 12 && day <= 12) {
                // Clearly DD/MM/YYYY format
                console.log("Detected DD/MM/YYYY format, swapping values");
                [month, day] = [day, month];
              } else if (month <= 12 && day <= 31) {
                // Format could be either MM/DD/YYYY or DD/MM/YYYY
                // Look for contextual clues
                if (dobStr.includes("DD/MM") || dobStr.includes("day/month")) {
                  console.log("Detected DD/MM/YYYY format based on context");
                  [month, day] = [day, month];
                }
                // Default to MM/DD/YYYY as it's most common in the US
              }
              
              console.log(`Setting DOB from date with year: Month=${month}, Day=${day}`);
              form.setValue("dobMonth", month);
              form.setValue("dobDay", day);
            } else if (dateWithoutYearMatch) {
              let month = parseInt(dateWithoutYearMatch[1]);
              let day = parseInt(dateWithoutYearMatch[2]);
              
              // Intelligently determine if we have DD/MM or MM/DD format
              if (month > 12 && day <= 12) {
                // Clearly DD/MM format
                console.log("Detected DD/MM format, swapping values");
                [month, day] = [day, month];
              } else if (month <= 12 && day <= 31) {
                // Format could be either MM/DD or DD/MM
                // Look for contextual clues
                if (dobStr.includes("DD/MM") || dobStr.includes("day/month")) {
                  console.log("Detected DD/MM format based on context");
                  [month, day] = [day, month];
                }
                // Default to MM/DD as it's most common in the US
              }
              
              console.log(`Setting DOB from date without year: Month=${month}, Day=${day}`);
              form.setValue("dobMonth", month);
              form.setValue("dobDay", day);
            } else if (directMatch) {
              let month = parseInt(directMatch[1]);
              let day = parseInt(directMatch[2]);
              
              // Intelligently determine format for direct matches as well
              if (month > 12 && day <= 12) {
                console.log("Detected DD/MM format in direct match, swapping values");
                [month, day] = [day, month];
              }
              
              console.log(`Setting DOB from direct match: Month=${month}, Day=${day}`);
              form.setValue("dobMonth", month);
              form.setValue("dobDay", day);
            }
          }
        } 
        
        // Handle DOB values formatted as MM/DD/YYYY where the fields are together with no key
        // Example: DOB: 06/07/1996 (where we need to extract the month and day)
        if (!form.getValues("dobMonth") || !form.getValues("dobDay")) {
          // Look for date patterns in any object values
          for (const key in jsonData) {
            const value = jsonData[key];
            if (typeof value === 'string' || typeof value === 'number') {
              const valueStr = value.toString();
              // Check for date patterns in the value
              const dateMatch = valueStr.match(/(\d{1,2})[\/\-\.](\d{1,2})(?:[\/\-\.](\d{2,4}))?/);
              if (dateMatch) {
                let month = parseInt(dateMatch[1]);
                let day = parseInt(dateMatch[2]);
                
                // If the value looks like a date and no DOB has been set yet, use it
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                  console.log(`Found potential date in field ${key}: ${valueStr}`);
                  console.log(`Setting DOB from field value: Month=${month}, Day=${day}`);
                  form.setValue("dobMonth", month);
                  form.setValue("dobDay", day);
                  break;
                }
              }
            }
          }
        }
        
        // Process SSN
        const ssn = findValueByFields(ssnFields);
        if (ssn) {
          console.log("Found SSN:", ssn);
          const ssnDigits = ssn.toString().replace(/\D/g, '');
          if (ssnDigits.length >= 4) {
            form.setValue("ssn4", ssnDigits.slice(-4));
          } else if (ssnDigits.length > 0) {
            form.setValue("ssn4", ssnDigits);
          }
        }
      }
      // Check if this looks like tabular data with markdown-style table
      const isTabularData = !isJsonData && pastedData.includes('|') && 
              (pastedData.includes('Field') || 
               pastedData.includes('Details') || 
               pastedData.match(/\|\s*[-]+\s*\|/));
                           
      if (isTabularData) {
        console.log("Detected tabular data format - parsing markdown table");
        
        // Extract field-value pairs from the markdown table
        const tableRows = pastedData.split('\n').filter(line => line.includes('|'));
        
        // Create a map to store the extracted field-value pairs
        const fieldMap: Record<string, string> = {};
        
        // Process each row to extract field and value
        tableRows.forEach(row => {
          const columns = row.split('|');
          if (columns.length >= 3) {
            const field = columns[1].replace(/\*\*/g, '').trim();
            const value = columns[2].trim();
            
            if (field && value && !field.includes('---')) {
              fieldMap[field.toLowerCase()] = value;
            }
          }
        });
        
        console.log("Extracted field map:", fieldMap);
        
        // Process full name
        const fullNameKey = Object.keys(fieldMap).find(key => 
          key.includes('full legal name') || 
          key.includes('full name') || 
          key.includes('legal name')
        );
        
        if (fullNameKey && fieldMap[fullNameKey]) {
          const nameParts = fieldMap[fullNameKey].split(/\s+/);
          if (nameParts.length >= 2) {
            form.setValue("firstName", nameParts[0]);
            form.setValue("lastName", nameParts[nameParts.length - 1]);
            
            if (nameParts.length > 2) {
              form.setValue("middleName", nameParts.slice(1, nameParts.length - 1).join(" "));
            }
          }
        }
        
        // Process phone
        const phoneKey = Object.keys(fieldMap).find(key => 
          key.includes('phone') || 
          key.includes('contact number')
        );
        
        if (phoneKey && fieldMap[phoneKey]) {
          const phone = fieldMap[phoneKey].replace(/\D/g, '');
          if (phone.length >= 10) {
            form.setValue("phone", fieldMap[phoneKey]);
          }
        }
        
        // Process email
        const emailKey = Object.keys(fieldMap).find(key => 
          key.includes('email')
        );
        
        if (emailKey && fieldMap[emailKey]) {
          // Handle potential markdown link format [email](mailto:email)
          const emailText = fieldMap[emailKey];
          const emailMatch = emailText.match(/\[([^\]]+)\]/);
          const emailValue = emailMatch ? emailMatch[1] : emailText;
          form.setValue("email", emailValue);
        }
        
        // Process location
        const locationKey = Object.keys(fieldMap).find(key => 
          key.includes('location') || 
          key.includes('address') ||
          key.includes('city')
        );
        
        if (locationKey && fieldMap[locationKey]) {
          // Location is often in "City, State" format (e.g., "Austin, TX")
          const locationValue = fieldMap[locationKey];
          console.log("Found location:", locationValue);
          
          // Try to intelligently parse the location
          const cityStateMatch = locationValue.match(/([^,]+),\s*([A-Z]{2})/);
          
          if (cityStateMatch) {
            // We have a format like "Austin, TX"
            console.log(`Parsed location: City=${cityStateMatch[1]}, State=${cityStateMatch[2]}`);
          }
          
          form.setValue("location", locationValue);
        }
        
        // Process work authorization
        const authKey = Object.keys(fieldMap).find(key => 
          key.includes('work authorization') || 
          key.includes('visa') ||
          key.includes('work permit')
        );
        
        if (authKey && fieldMap[authKey]) {
          const authText = fieldMap[authKey];
          const authLower = authText.toLowerCase();
          
          console.log("Found work authorization:", authText);
          
          if (authLower.includes('citizen')) {
            form.setValue("workAuthorization", "citizen");
          } else if (authLower.match(/green\s*card/i) || authLower.match(/permanent\s*resident/i)) {
            form.setValue("workAuthorization", "green-card");
          } else if (authLower.match(/h-?1-?b/i) || authLower.match(/h1-?b/i)) {
            form.setValue("workAuthorization", "h1b");
          } else if (authLower.match(/ead/i) && !authLower.match(/h-?4/i)) {
            form.setValue("workAuthorization", "ead");
          } else if (authLower.match(/h-?4\s*ead/i) || (authLower.match(/h-?4/i) && authLower.match(/ead/i))) {
            // Handle H4 EAD specifically, which is a common combination
            form.setValue("workAuthorization", "other");
            setShowOtherAuthorizationInput(true);
            setOtherAuthorization("H4 EAD");
          } else if (authLower.match(/h-?4/i)) {
            form.setValue("workAuthorization", "other");
            setShowOtherAuthorizationInput(true);
            setOtherAuthorization("H4");
          } else {
            form.setValue("workAuthorization", "other");
            setShowOtherAuthorizationInput(true);
            setOtherAuthorization(authText);
          }
        }
        
        // Process DOB
        const dobKey = Object.keys(fieldMap).find(key => 
          key.includes('date of birth') || 
          key.includes('dob') ||
          key.includes('birth date')
        );
        
        if (dobKey && fieldMap[dobKey]) {
          const dobText = fieldMap[dobKey];
          console.log("Found DOB text:", dobText);
          
          // Handle MM/DD format (most common in the tabular data)
          const mmddMatch = dobText.match(/(\d{1,2})[\/\-](\d{1,2})/);
          
          if (mmddMatch) {
            let month = parseInt(mmddMatch[1]);
            let day = parseInt(mmddMatch[2]);
            
            // Check if the format is actually DD/MM instead of MM/DD
            if (month > 12 && day <= 12) {
              // Swap if the first number is clearly a day (>12)
              [month, day] = [day, month];
            }
            
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
              console.log(`Setting DOB: Month=${month}, Day=${day}`);
              form.setValue("dobMonth", month);
              form.setValue("dobDay", day);
            }
          }
        }
        
        // Process LinkedIn
        const linkedinKey = Object.keys(fieldMap).find(key => 
          key.includes('linkedin')
        );
        
        if (linkedinKey && fieldMap[linkedinKey]) {
          const linkedinText = fieldMap[linkedinKey];
          // Handle markdown link format [link](url)
          const linkedinMatch = linkedinText.match(/\[([^\]]+)\]\(([^)]+)\)/);
          let linkedinUrl = linkedinText;
          
          if (linkedinMatch) {
            linkedinUrl = linkedinMatch[2];
          } else if (!linkedinText.startsWith('http')) {
            // If it's just the profile without http, add the prefix
            linkedinUrl = linkedinText.includes('linkedin.com') 
              ? `https://www.${linkedinText}` 
              : `https://www.linkedin.com/in/${linkedinText}`;
          }
          
          form.setValue("linkedIn", linkedinUrl);
        }
        
        // Process SSN
        const ssnKey = Object.keys(fieldMap).find(key => 
          key.includes('ssn') ||
          key.includes('social security')
        );
        
        if (ssnKey && fieldMap[ssnKey]) {
          const ssnText = fieldMap[ssnKey];
          const ssnDigits = ssnText.replace(/\D/g, '');
          
          if (ssnDigits.length >= 4) {
            form.setValue("ssn4", ssnDigits.slice(-4));
          }
        }
      } else {
        // Non-tabular format - use regex patterns
        
        // Extract name information
        const firstNameMatch = pastedData.match(/[-]?Legal First Name:?\s*([^\n\r]*)/i) || 
                              pastedData.match(/[-]?First Name:?\s*([^\n\r]*)/i);
        const middleNameMatch = pastedData.match(/[-]?Legal Middle Name:?\s*([^\n\r]*)/i) || 
                               pastedData.match(/[-]?Middle Name:?\s*([^\n\r]*)/i);
        const lastNameMatch = pastedData.match(/[-]?Legal Last Name:?\s*([^\n\r]*)/i) || 
                             pastedData.match(/[-]?Last Name:?\s*([^\n\r]*)/i);
        
        // Full name patterns
        const fullNameMatch = pastedData.match(/(?:full legal name|your full legal name|as per passport|legal name):?\s*([^\n\r]*)/i);
        const fullNameAsPerPassportMatch = pastedData.match(/your full legal name\s*\(as per passport\):?\s*([^\n\r]*)/i);
        
        // Apply name matches in priority order
        if (firstNameMatch && firstNameMatch[1].trim()) {
          form.setValue("firstName", firstNameMatch[1].trim());
        }
        
        if (middleNameMatch && middleNameMatch[1].trim()) {
          form.setValue("middleName", middleNameMatch[1].trim());
        }
        
        if (lastNameMatch && lastNameMatch[1].trim()) {
          form.setValue("lastName", lastNameMatch[1].trim());
        }

        // Handle full name patterns
        if (fullNameAsPerPassportMatch && fullNameAsPerPassportMatch[1].trim()) {
          console.log("Found full name format with 'As per passport':", fullNameAsPerPassportMatch[1]);

          const nameParts = fullNameAsPerPassportMatch[1].trim().split(/\s+/);
          if (nameParts.length >= 2) {
            form.setValue("firstName", nameParts[0]);
            form.setValue("lastName", nameParts[nameParts.length - 1]);
            
            if (nameParts.length > 2) {
              form.setValue("middleName", nameParts.slice(1, nameParts.length - 1).join(" "));
            }
          }
        }
        // If we have a full name match but not individual components, try to parse it
        else if (fullNameMatch) {
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
      }

      // Extract DOB - multiple formats
      // Format: "DOB: 11th December 1993" or similar variations
      const dobFormatA = pastedData.match(/DOB:?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-zA-Z]+)\s+(\d{4})/i);
      // Format: MM/DD/YYYY or MM/DD with variations including "DOB : 06/25" 
      // First version matches "DOB: 06/07/1996" pattern specifically
      const dobFormatB = pastedData.match(/DOB\s*:?\s*(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?/i);
      // Direct pattern for just MM/DD/YYYY format in text
      const dobFormatD = pastedData.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
      // Special format for "Date of Birth (MM/DD): 03/11" from the attached content format
      const dobFormatE = pastedData.match(/Date\s+of\s+Birth\s*\(MM\/DD\).*?:\s*(\d{1,2})\/(\d{1,2})/i);

      // Month name format - e.g., "January 15"
      const dobFormatC = pastedData.match(/Birth Month[^:]*:?\s*([a-zA-Z]+)/i);
      const dobDayFormatC = pastedData.match(/Birth Day[^:]*:?\s*(\d{1,2})/i);

      // Debug logging for DOB formats
      console.log("DEBUG - DOB patterns:", { dobFormatA, dobFormatB, dobFormatD, dobFormatE });

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
      } else if (dobFormatD) {
        // Direct MM/DD/YYYY format
        const month = parseInt(dobFormatD[1]);
        const day = parseInt(dobFormatD[2]);
        if (month > 0 && day > 0) {
          form.setValue("dobMonth", month);
          form.setValue("dobDay", day);
        }
      } else if (dobFormatE) {
        // Special format for "Date of Birth (MM/DD): 03/11"
        const month = parseInt(dobFormatE[1]);
        const day = parseInt(dobFormatE[2]);
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
        // Format: "Visa Type: H1B" or similar (needed for your specific format)
        pastedData.match(/visa\s*type[^:]*:?\s*([^\n\r,;]+)/i),
        // GC EAD, H1B, etc. specific formats
        pastedData.match(/(?:USC|US Citizen|GC\s*EAD|Green\s*Card|H[1-4]-?[B]?|EAD|VISA|Citizen|STEM\s*OPT)/i),
        // Key phrases
        pastedData.match(/(?:authorized\s*to\s*work|visa\s*status|work\s*permit)[^:]*:?\s*([^\n\r,;]+)/i)
      ];

      console.log("DEBUG - Work authorization patterns:", workAuthPatterns);

      const validAuthMatch = workAuthPatterns.find(match => match !== null);
      if (validAuthMatch) {
        const authText = validAuthMatch[1] || validAuthMatch[0];
        const authLower = authText.toLowerCase().trim();

        // Map common authorization texts to our dropdown values
        if (authLower.includes('usc') || authLower.includes('citizen') || authLower.includes('us citizen')) {
          form.setValue("workAuthorization", "citizen");
        } else if (authLower.match(/green\s*card/i) || authLower.match(/permanent\s*resident/i)) {
          form.setValue("workAuthorization", "green-card");
        } else if (authLower.match(/h-?1-?b/i) || authLower.match(/h1-?b/i)) {
          form.setValue("workAuthorization", "h1b");
        } else if (authLower.match(/ead/) || authLower.match(/gc\s*ead/i)) {
          form.setValue("workAuthorization", "ead");
        } else if (authLower.match(/h-?4\s*ead/i) || (authLower.match(/h-?4/i) && authLower.match(/ead/i))) {
          // Handle H4 EAD specifically, which is a common combination
          form.setValue("workAuthorization", "other");
          setShowOtherAuthorizationInput(true);
          setOtherAuthorization("H4 EAD");
        } else if (authLower.match(/h-?4/i)) {
          form.setValue("workAuthorization", "other");
          setShowOtherAuthorizationInput(true);
          setOtherAuthorization("H4");
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
        // No candidateId for a new submission
        const matchResult = await matchResumeToJob(
          result.text, 
          jobDescription,
          undefined
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
        
        // Early validation - check for suspicious employment history patterns
        try {
          if (matchResult.clientNames && matchResult.clientNames.length > 0) {
            console.log("Performing early resume validation...");
            
            const validationResponse = await fetch("/api/validate-resume", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                clientNames: matchResult.clientNames,
                relevantDates: matchResult.relevantDates || [],
                candidateId: initialCandidateData?.id // Pass the candidate ID to exclude them from comparison
              })
            });
            
            if (validationResponse.ok) {
              const validationResult = await validationResponse.json();
              
              console.log("Early resume validation result:", validationResult);
              
              if (!validationResult.isValid) {
                // Suspicious pattern detected
                if (validationResult.suspiciousPatterns?.length > 0) {
                  const firstPattern = validationResult.suspiciousPatterns[0];
                  
                  // Show warning to the user
                  toast({
                    title: "⚠️ Suspicious Resume Pattern Detected",
                    description: firstPattern.message,
                    variant: "destructive",
                    duration: 10000, // Show for longer
                  });
                  
                  // Set validation warning state to display prominently
                  setValidationWarning({
                    title: firstPattern.type === "IDENTICAL_CHRONOLOGY" ? 
                      "DUPLICATE EMPLOYMENT HISTORY DETECTED" : 
                      "SUSPICIOUS RESUME PATTERN DETECTED",
                    message: firstPattern.message,
                    detail: firstPattern.detail,
                    severity: firstPattern.severity,
                    matchedCandidates: firstPattern.matchedCandidates
                  });
                  
                  // No longer setting form error since we have the prominent warning banner
                  // The form error creates the redundant warning message below the form fields
                }
              }
            }
          }
        } catch (validationError) {
          console.error("Error during early resume validation:", validationError);
        }
        
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

      // If candidate exists, set the state but continue with submission
      if (result.exists) {
        console.log("Candidate exists, but continuing with submission for validation");
        setCandidateExists(true);
        
        // Notify user that candidate exists but continuing
        toast({
          title: "Candidate Found",
          description: "This candidate exists in the system. Processing for validation.",
        });
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
      
      // Show confirmation dialog for suspicious resumes
      if (validationWarning && validationWarning.severity === "HIGH") {
        // Ask for confirmation before submitting suspicious resume
        const userConfirmed = window.confirm(
          `⚠️ WARNING: ${validationWarning.title}\n\n` +
          `${validationWarning.message}\n\n` +
          `${validationWarning.detail}\n\n` +
          `Are you sure you want to continue with this submission?`
        );
        
        if (!userConfirmed) {
          toast({
            title: "Submission Cancelled",
            description: "You canceled the submission due to validation warnings.",
          });
          return;
        } else {
          // User confirmed to continue despite warning
          toast({
            title: "Proceeding with Submission",
            description: "Submitting candidate despite validation warnings.",
            variant: "destructive",
          });
        }
      }

      // Include resume data and match results if available
      console.log("Submitting candidate data with resume:", 
        resumeData ? `Resume data present (${resumeData.clientNames?.length || 0} companies)` : "No resume data");
      
      // Add suspicious flags to the submission if there's a validation warning
      const suspiciousData = validationWarning ? {
        isSuspicious: true,
        suspiciousReason: validationWarning.message,
        suspiciousSeverity: validationWarning.severity
      } : {};
      
      // Log if we're submitting with suspicious flags
      if (validationWarning) {
        console.log("Submitting with suspicious flags:", suspiciousData);
      }
      
      // Include the existing resume filename if available
      onSubmit({
        ...values,
        resumeData: resumeData,
        matchResults: matchResults,
        existingResumeFileName: existingResumeFileName,
        ...suspiciousData
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
      
      {validationWarning && (
        <Alert 
          variant="destructive"
          className={`border-2 p-0 overflow-hidden ${validationWarning.severity === "HIGH" ? "border-red-500" : "border-amber-500"}`}
        >
          {/* Header section with icon and title */}
          <div className={`p-3 ${validationWarning.severity === "HIGH" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
            <div className="flex items-center gap-2">
              <div className={`p-1 rounded-full ${validationWarning.severity === "HIGH" ? "bg-red-200" : "bg-amber-200"}`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold">{validationWarning.title}</h3>
            </div>
          </div>
          
          {/* Content section with formatted message */}
          <div className={`p-4 ${validationWarning.severity === "HIGH" ? "bg-red-50" : "bg-amber-50"}`}>
            <div className="space-y-4">
              {/* Main warning message */}
              <div className="rounded-md p-3 border border-gray-200 bg-white">
                <h4 className="font-semibold mb-1">Detection Summary:</h4>
                <p className="text-base">
                  {validationWarning.severity === "HIGH" ? (
                    <>This resume shows identical job chronology with {validationWarning.matchedCandidates?.length || 0} other candidate(s)</>
                  ) : (
                    <>This resume has high similarity ({'>'}80%) with {validationWarning.matchedCandidates?.length || 0} other candidate(s)</>
                  )}
                </p>
              </div>
              
              {/* Matching candidates */}
              {validationWarning.matchedCandidates && validationWarning.matchedCandidates.length > 0 && (
                <div className="rounded-md p-3 border border-gray-200 bg-white">
                  <h4 className="font-semibold mb-2">Matching Candidates:</h4>
                  <ul className="space-y-2 pl-1">
                    {validationWarning.matchedCandidates.map(candidate => (
                      <li key={candidate.id} className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${validationWarning.severity === "HIGH" ? "bg-red-500" : "bg-amber-500"}`}></div>
                        <span className="font-medium">{candidate.name}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100">
                          {candidate.similarityScore.toFixed(1)}% match
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {/* Recommendation section */}
              <div className="rounded-md p-3 border border-gray-200 bg-white">
                <h4 className="font-semibold mb-1">Recommendation:</h4>
                <p className="text-sm">{validationWarning.detail}</p>
              </div>
              
              {/* Warning footer with action description */}
              <div className={`text-sm italic ${validationWarning.severity === "HIGH" ? "text-red-600" : "text-amber-600"}`}>
                You may still proceed with this submission, but the warning will be recorded.
              </div>
            </div>
          </div>
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
            
            {/* Display notification when using an existing resume from application */}
            {existingResumeFileName && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md flex items-center">
                <CheckCircle2 className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-800">Using existing resume from application</p>
                  <p className="text-xs text-blue-600">Resume file: {existingResumeFileName}</p>
                </div>
              </div>
            )}
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
            
            {existingResumeFileName ? (
              <div className="mt-2 mb-4 p-3 border rounded-md border-green-200 bg-green-50">
                <div className="flex items-center">
                  <div className="flex-shrink-0 text-green-600 mr-2">
                    {isLoadingExistingResume ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-green-600"></div>
                    ) : (
                      <CheckCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      {isLoadingExistingResume 
                        ? "Analyzing resume from application..." 
                        : "Resume already uploaded from application"}
                    </p>
                    <p className="text-xs text-green-700">{existingResumeFileName}</p>
                    {isLoadingExistingResume && (
                      <div className="mt-1">
                        <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: '70%' }}></div>
                        </div>
                        <p className="text-xs text-green-700 mt-1">Please wait while we analyze skills and experience...</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      disabled={isLoadingExistingResume}
                      className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                      onClick={() => setExistingResumeFileName(undefined)}
                    >
                      Use different file
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-white hover:file:bg-blue-600"
                />
                <p className="mt-2 text-sm text-gray-500">PDF or Word document only.</p>
              </>
            )}

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
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="text-sm font-medium text-gray-700">Potential Gaps:</h5>
                    
                    {/* Domain expertise score indicator */}
                    {matchResults.domainKnowledgeScore !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-600">Domain Expertise:</span>
                        <div className="flex items-center">
                          <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${
                                matchResults.domainKnowledgeScore >= 70 ? "bg-green-500" :
                                matchResults.domainKnowledgeScore >= 40 ? "bg-amber-500" :
                                "bg-red-500"
                              }`}
                              style={{ width: `${matchResults.domainKnowledgeScore}%` }}
                            ></div>
                          </div>
                          <span className="ml-2 text-xs font-medium">
                            {matchResults.domainKnowledgeScore}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {matchResults.gapDetails && matchResults.gapDetails.length > 0 ? (
                    <Tabs defaultValue="summary" className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="summary">Summary</TabsTrigger>
                        <TabsTrigger value="domain">Domain Expertise</TabsTrigger>
                        <TabsTrigger value="detailed">Detailed Analysis</TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="summary" className="space-y-2 mt-2">
                        <ul className="pl-5 text-sm text-gray-600 list-disc">
                          {matchResults.weaknesses.map((weakness: string, index: number) => (
                            <li key={index} className="mb-1">{weakness}</li>
                          ))}
                        </ul>
                      </TabsContent>
                      
                      {/* Domain expertise tab with enhanced scoring */}
                      <TabsContent value="domain" className="space-y-2 mt-2">
                        {/* Domain Knowledge Score indicator */}
                        {typeof matchResults.domainKnowledgeScore === 'number' && (
                          <div className="mb-4">
                            <h6 className="text-sm font-medium mb-2">Domain Knowledge Score</h6>
                            <div className="flex items-center">
                              <div className="w-full bg-gray-200 rounded-full h-2.5 mr-2">
                                <div className={`h-2.5 rounded-full ${
                                  matchResults.domainKnowledgeScore >= 70 ? 'bg-green-600' : 
                                  matchResults.domainKnowledgeScore >= 40 ? 'bg-amber-500' : 'bg-red-600'
                                }`} 
                                style={{ width: `${Math.max(5, matchResults.domainKnowledgeScore)}%` }}>
                                </div>
                              </div>
                              <span className={`text-sm font-medium ${
                                matchResults.domainKnowledgeScore >= 70 ? 'text-green-600' : 
                                matchResults.domainKnowledgeScore >= 40 ? 'text-amber-600' : 'text-red-600'
                              }`}>
                                {matchResults.domainKnowledgeScore}%
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              This score indicates how well the candidate's experience aligns with 
                              industry-specific requirements for this role.
                            </p>
                          </div>
                        )}
                        
                        {/* Domain Expertise Gaps section */}
                        {matchResults.domainExpertiseGaps && matchResults.domainExpertiseGaps.length > 0 ? (
                          <>
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md mb-3">
                              <h6 className="text-sm font-medium text-amber-800 mb-2">Domain-Specific Expertise Gaps</h6>
                              <ul className="pl-5 text-sm text-amber-700 list-disc">
                                {matchResults.domainExpertiseGaps.map((gap: string, index: number) => (
                                  <li key={index} className="mb-1.5">{gap}</li>
                                ))}
                              </ul>
                            </div>
                            
                            <div className="text-xs text-gray-600 p-2 bg-gray-50 rounded-md">
                              <p className="mb-1"><strong>Why this matters:</strong> Domain expertise gaps directly impact the candidate's ability to perform effectively in this specific role. These gaps represent industry-specific knowledge or experience areas that are critical for success.</p>
                              <p><strong>Recommendation:</strong> Focus on addressing these domain-specific gaps during interview discussions to better evaluate the candidate's potential in this specialized role.</p>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No domain-specific gaps detected</p>
                        )}
                      </TabsContent>
                      
                      <TabsContent value="detailed" className="space-y-4 mt-2">
                        {matchResults.gapDetails.map((gapDetail: any, categoryIndex: number) => (
                          <div key={categoryIndex} className="border rounded-md p-3 mb-2">
                            <div className="flex items-center gap-2 mb-2">
                              {gapDetail.importance === "Critical" ? (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              ) : gapDetail.importance === "Important" ? (
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-blue-500" />
                              )}
                              <h6 className="text-sm font-semibold text-gray-800">
                                {gapDetail.category}
                                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                  gapDetail.importance === "Critical" ? "bg-red-100 text-red-800" :
                                  gapDetail.importance === "Important" ? "bg-amber-100 text-amber-800" :
                                  "bg-blue-100 text-blue-800"
                                }`}>
                                  {gapDetail.importance}
                                </span>
                              </h6>
                            </div>
                            
                            <div className="ml-6">
                              {/* Gap list */}
                              <div className="mb-2">
                                <p className="text-xs text-gray-600 mb-1">Specific gaps:</p>
                                <ul className="pl-5 text-sm text-gray-600 list-disc">
                                  {gapDetail.gaps.map((gap: string, gapIndex: number) => (
                                    <li key={gapIndex} className="text-xs">{gap}</li>
                                  ))}
                                </ul>
                              </div>
                              
                              {/* Impact */}
                              <div className="mb-2">
                                <p className="text-xs text-gray-600 mb-1">Impact:</p>
                                <p className="text-xs text-gray-800">{gapDetail.impact}</p>
                              </div>
                              
                              {/* Suggestions */}
                              {gapDetail.suggestions && gapDetail.suggestions.length > 0 && (
                                <div>
                                  <p className="text-xs text-gray-600 mb-1">Suggestions:</p>
                                  <ul className="pl-5 text-sm text-gray-600 list-disc">
                                    {gapDetail.suggestions.map((suggestion: string, suggIndex: number) => (
                                      <li key={suggIndex} className="text-xs">{suggestion}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </TabsContent>
                    </Tabs>
                  ) : (
                    <ul className="pl-5 text-sm text-gray-600 list-disc">
                      {matchResults.weaknesses.map((weakness: string, index: number) => (
                        <li key={index} className="mb-1">{weakness}</li>
                      ))}
                    </ul>
                  )}
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

          <div className="flex items-center justify-end space-x-3">
            {isLoadingExistingResume && (
              <div className="flex items-center mr-3 text-amber-600 text-sm">
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-amber-600"></div>
                Resume analysis in progress...
              </div>
            )}
            <Button type="button" variant="outline">
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isPending || isAnalyzing || isLoadingExistingResume}
            >
              {isPending ? "Submitting..." : 
               isLoadingExistingResume ? "Analyzing Resume..." : 
               "Submit Candidate"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default CandidateForm;
