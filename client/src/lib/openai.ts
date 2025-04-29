import { apiRequest } from "./queryClient";

export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
}

/**
 * Analyzes resume text using OpenAI API through server endpoint
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  try {
    const result = await apiRequest<ResumeAnalysisResult>({
      method: "POST",
      url: "/api/openai/analyze-resume",
      data: { text: resumeText }
    });
    
    return result;
  } catch (error) {
    console.error("Error analyzing resume:", error);
    throw new Error("Failed to analyze resume text");
  }
}

/**
 * Matches resume to job description using OpenAI API through server endpoint
 */
export async function matchResumeToJob(
  resumeText: string, 
  jobDescription: string
): Promise<MatchScoreResult> {
  try {
    const result = await apiRequest<MatchScoreResult>({
      method: "POST",
      url: "/api/openai/match-resume",
      data: { 
        resumeText, 
        jobDescription 
      }
    });
    
    return result;
  } catch (error) {
    console.error("Error matching resume to job:", error);
    throw new Error("Failed to match resume to job description");
  }
}

/**
 * Analyzes a resume file by extracting its text and sending it to the OpenAI API
 */
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async function (e) {
      try {
        let text = '';
        
        if (typeof e.target?.result === 'string') {
          text = e.target.result;
        } else {
          throw new Error("Failed to read file content");
        }
        
        // Ensure we have meaningful content to analyze
        if (text.trim().length < 50) {
          throw new Error("Resume content is too short to analyze");
        }
        
        const analysis = await analyzeResumeText(text);
        resolve({
          analysis,
          text
        });
      } catch (error) {
        console.error("Error in resume analysis:", error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    reader.readAsText(file);
  });
}
