import { apiRequest, apiRequestWithJson } from "./queryClient";
import { extractDocumentText } from './documentUtils';

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
  education?: string[]; // Education data
  
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
 * @param candidateId Optional candidate ID to associate the analysis with
 * @returns Match result with score and insights
 */
export async function matchResumeToJob(
  resumeText: string, 
  jobDescription: string,
  candidateId?: number
): Promise<MatchScoreResult> {
  try {
    // Basic validation
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text is too short for meaningful analysis");
    }
    
    if (!jobDescription || jobDescription.trim().length < 50) {
      throw new Error("Job description is too short for meaningful analysis");
    }
    
    // Prepare request payload
    const payload: {
      resumeText: string;
      jobDescription: string;
      candidateId?: number;
    } = {
      resumeText,
      jobDescription
    };
    
    // Add candidateId if provided
    if (candidateId && candidateId > 0) {
      console.log(`Including candidateId ${candidateId} in resume match request`);
      payload.candidateId = candidateId;
    }
    
    // Call the server-side endpoint to match the resume
    const response = await apiRequestWithJson<MatchScoreResult>(
      'POST', 
      '/api/openai/match-resume',
      payload
    );
    
    // Log detailed response for debugging
    console.log("Received matchResumeToJob response:", response);
    console.log("Candidate data in response:", {
      clientNames: response.clientNames || [],
      jobTitles: response.jobTitles || [],
      relevantDates: response.relevantDates || [],
      education: response.education || []
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
      education: [], // Include education field
      
      // Legacy fields
      clientExperience: "",
      confidence: 0
    };
  }
}

/**
 * Process a resume file and extract text for analysis
 */
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  try {
    console.log(`Processing resume file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    
    // Use our document utils to extract text - this will handle different file types
    // and fall back to server extraction when needed
    const extractedText = await extractDocumentText(file);
    
    console.log(`Successfully extracted ${extractedText.length} characters from ${file.name}`);
    console.log("First 200 characters of resume:", extractedText.substring(0, 200));
    
    if (extractedText.length < 100) {
      console.warn("Extracted text is very short, parsing may be incomplete");
    }
    
    // Return the extracted text along with basic analysis structure
    // The actual analysis of the resume content will be done when matching against job description
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