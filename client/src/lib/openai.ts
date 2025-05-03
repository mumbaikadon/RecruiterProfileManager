import { apiRequest, apiRequestWithJson } from "./queryClient";

/**
 * Enhanced interface for resume data with structured employment history
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
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  clientExperience?: string;
  confidence?: number;
}

/**
 * Match a resume to a job description using AI analysis
 * @param resumeText The extracted resume text
 * @param jobDescription The job description to match against
 * @returns Match result with score and insights
 */
export async function matchResumeToJob(
  resumeText: string,
  jobDescription: string,
): Promise<MatchScoreResult> {
  try {
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text is too short for meaningful analysis");
    }

    if (!jobDescription || jobDescription.trim().length < 50) {
      throw new Error("Job description is too short for meaningful analysis");
    }

    const response = await apiRequestWithJson<MatchScoreResult>(
      "POST",
      "/api/openai/match-resume",
      {
        resumeText,
        jobDescription,
      },
    );

    console.log("Received matchResumeToJob response:", response);
    console.log("Employment history data in response:", {
      clientNames: response.clientNames || [],
      jobTitles: response.jobTitles || [],
      relevantDates: response.relevantDates || [],
    });

    return response;
  } catch (error) {
    console.error("Error matching resume to job:", error);

    return {
      score: 0,
      strengths: [],
      weaknesses: [
        error instanceof Error ? error.message : "Failed to analyze resume",
      ],
      suggestions: ["Try again with a different resume or job description"],
      technicalGaps: [],
      matchingSkills: [],
      missingSkills: [],
      clientNames: [],
      jobTitles: [],
      relevantDates: [],
      clientExperience: "",
      confidence: 0,
    };
  }
}

/**
 * Process a resume file and extract text for analysis via backend
 */
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    
    console.log("Uploading resume file:", file.name, "Size:", file.size, "Type:", file.type);

    // Use fetch directly for better control over FormData uploads
    const response = await fetch("/api/openai/analyze-resume", {
      method: "POST",
      body: formData,
      // Don't set Content-Type, browser will set it with the correct boundary
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resume upload failed:", response.status, errorText);
      throw new Error(`Resume upload failed: ${response.status} ${errorText}`);
    }
    
    // Parse the JSON response
    const analysisResult = await response.json() as ResumeAnalysisResult;
    console.log("Resume analysis successful, data:", analysisResult);
    
    return {
      analysis: analysisResult,
      text: analysisResult.extractedText || "",
    };
  } catch (error) {
    console.error("Error processing resume file:", error);

    return {
      analysis: {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: `Error analyzing resume: ${error instanceof Error ? error.message : "Unknown error"}`,
        fileName: file.name,
      },
      text: `Error analyzing resume: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
