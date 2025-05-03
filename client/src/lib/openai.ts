import { apiRequest, apiRequestWithJson } from "./queryClient";

/**
 * Enhanced interface for resume data with structured employment history
 */
export interface ResumeAnalysisResult {
  // Structured employment history data
  clientNames: string[]; // Company names/employers
  jobTitles: string[];   // Job positions/titles
  relevantDates: string[]; // Employment periods
  
  // Original fields
  skills: string[];
  education: string[];
  extractedText: string;
  fileName?: string;
}

/**
 * Enhanced interface for job match results including structured employment history
 */
export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technicalGaps?: string[];
  matchingSkills?: string[];
  missingSkills?: string[];
  
  // Structured employment history data
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  
  // Legacy fields
  clientExperience?: string;
  confidence?: number;
}

/**
 * Simplified resume processing - analysis features have been removed
 * Returns an empty structure to maintain API compatibility
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  // Return minimal structure
  return {
    clientNames: [],
    jobTitles: [],
    relevantDates: [],
    skills: [],
    education: [],
    extractedText: resumeText.substring(0, 4000)
  };
}

/**
 * Match a resume to a job description using AI analysis
 * @param resumeText The extracted resume text
 * @param jobDescription The job description to match against
 * @returns Match result with score and insights
 */
export async function matchResumeToJob(
  resumeText: string, 
  jobDescription: string
): Promise<MatchScoreResult> {
  try {
    // Basic validation
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text is too short for meaningful analysis");
    }
    
    if (!jobDescription || jobDescription.trim().length < 50) {
      throw new Error("Job description is too short for meaningful analysis");
    }
    
    // Call the server-side endpoint to match the resume
    const response = await apiRequestWithJson<MatchScoreResult>(
      'POST', 
      '/api/openai/match-resume',
      {
        resumeText,
        jobDescription
      }
    );
    
    // Log detailed response for debugging
    console.log("Received matchResumeToJob response:", response);
    console.log("Employment history data in response:", {
      clientNames: response.clientNames || [],
      jobTitles: response.jobTitles || [],
      relevantDates: response.relevantDates || []
    });
    
    return response;
  } catch (error) {
    console.error("Error matching resume to job:", error);
    
    // Return a fallback response in case of error
    return {
      // Basic match result
      score: 0,
      strengths: [],
      weaknesses: [error instanceof Error ? error.message : "Failed to analyze resume"],
      suggestions: ["Try again with a different resume or job description"],
      technicalGaps: [],
      matchingSkills: [],
      missingSkills: [],
      
      // Include empty structured employment history data
      clientNames: [],
      jobTitles: [],
      relevantDates: [],
      
      // Legacy fields
      clientExperience: "",
      confidence: 0
    };
  }
}

/**
 * Process a resume file and extract text for analysis using the server's document parser
 */
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  try {
    // Create a FormData object for file upload
    const formData = new FormData();
    formData.append("file", file);
    
    console.log(`Uploading resume file: ${file.name} (${Math.round(file.size / 1024)} KB) for parsing`);

    // Use the server's document parsing API to extract text
    const response = await fetch('/api/parse-document', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to process document");
    }

    // Extract text from the server's response
    const parseResult = await response.json();
    
    if (!parseResult.success || !parseResult.text) {
      throw new Error("Document parsing failed on server");
    }
    
    // Log the extraction success
    console.log(`Successfully extracted ${parseResult.text.length} characters from ${file.name}`);
    
    // Use the extracted text from the server
    const extractedText = parseResult.text;
    
    // Return the extracted text along with basic analysis structure
    return {
      analysis: {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: extractedText,
        fileName: file.name
      },
      text: extractedText
    };
  } catch (error) {
    console.error("Error processing resume file:", error);
    
    // Return minimal data structure if there's an error
    return {
      analysis: {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: `Error analyzing resume: ${error instanceof Error ? error.message : 'Unknown error'}`,
        fileName: file.name
      },
      text: `Error analyzing resume: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
