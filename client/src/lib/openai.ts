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
 * @param candidateId Optional candidate ID to update resume data
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
    
    // Call the server-side endpoint to match the resume
    const response = await apiRequestWithJson<MatchScoreResult>(
      'POST', 
      '/api/openai/match-resume',
      {
        resumeText,
        jobDescription,
        candidateId: candidateId || undefined // Only include if provided
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
 * Process a resume file and extract text for analysis
 */
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  try {
    // Create a FormData object
    const formData = new FormData();
    formData.append("file", file);
    
    // Extract basic file information
    const fileName = file.name.toLowerCase();
    const fileSize = Math.round(file.size / 1024);
    const lastModified = new Date(file.lastModified).toLocaleString();
    
    // Basic file information as fallback
    const basicFileInfo = `Resume file: ${file.name} (${fileSize} KB)
Type: ${fileName.endsWith('.pdf') ? 'PDF Document' : fileName.endsWith('.docx') ? 'Word Document' : 'Text Document'}
Last Modified: ${lastModified}`;

    // Read the file to extract text
    let extractedText = '';
    
    // Use FileReader to read the file content for text extraction
    // Note: This is a basic extraction and won't work well for PDFs or complex DOCXs
    // The server handles proper extraction
    if (fileName.endsWith('.txt')) {
      // For text files, read directly
      extractedText = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string || '');
        reader.readAsText(file);
      });
    } else {
      // For PDFs and Word docs, we'll use the file info as the text and
      // the server will handle proper extraction
      extractedText = basicFileInfo;
    }
    
    // The server would normally extract and analyze the resume
    // We'll return basic data here and rely on the matchResumeToJob function
    // to do the actual analysis against a job description
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
