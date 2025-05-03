import { apiRequest } from "./queryClient";

/**
 * Simple interface for resume data - analysis features removed
 */
export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
  fileName?: string;
}

/**
 * Simple interface for job match results - analysis features removed
 */
export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technicalGaps?: string[];
  matchingSkills?: string[];
  missingSkills?: string[];
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
    const response = await apiRequest<MatchScoreResult>('/api/openai/match-resume', {
      method: 'POST',
      body: JSON.stringify({
        resumeText,
        jobDescription
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    return response;
  } catch (error) {
    console.error("Error matching resume to job:", error);
    
    // Return a fallback response in case of error
    return {
      score: 0,
      strengths: [],
      weaknesses: [error instanceof Error ? error.message : "Failed to analyze resume"],
      suggestions: ["Try again with a different resume or job description"],
      technicalGaps: [],
      matchingSkills: [],
      missingSkills: [],
      clientExperience: "",
      confidence: 0
    };
  }
}

/**
 * Process a resume file - simplified version with analysis features removed
 */
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  return new Promise((resolve) => {
    const fileName = file.name.toLowerCase();
    const fileSize = Math.round(file.size / 1024);
    const lastModified = new Date(file.lastModified).toLocaleString();
    
    // Basic file information
    const basicFileInfo = `Resume file: ${file.name} (${fileSize} KB)
Type: ${fileName.endsWith('.pdf') ? 'PDF Document' : fileName.endsWith('.docx') ? 'Word Document' : 'Text Document'}
Last Modified: ${lastModified}`;

    // Return minimal data structure with file information
    resolve({
      analysis: {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: basicFileInfo,
        fileName: file.name
      },
      text: basicFileInfo
    });
  });
}
