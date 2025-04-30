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
    console.log("Sending resume and job description for matching...");
    console.log("Resume text length:", resumeText.length);
    console.log("Job description length:", jobDescription.length);
    
    const result = await apiRequest<MatchScoreResult>({
      method: "POST",
      url: "/api/openai/match-resume",
      data: { 
        resumeText, 
        jobDescription 
      }
    });
    
    console.log("Match result received:", result);
    
    // Ensure we always have valid data even if the API returns incomplete information
    return {
      score: typeof result.score === 'number' ? result.score : 0,
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
    };
  } catch (error) {
    console.error("Error matching resume to job:", error);
    // Return a fallback with a message about the error
    return {
      score: 0,
      strengths: [],
      weaknesses: ["Error during resume matching"],
      suggestions: ["Try again with a different resume format or contact support"]
    };
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
          
          // Check for common problematic patterns in file content that cause JSON parsing issues
          if (text.trim().startsWith('<!DOCTYPE') || text.includes('<?xml')) {
            // Pre-process the text to remove these problematic tags
            text = text.replace(/<!DOCTYPE[^>]*>/gi, '')
                      .replace(/<\?xml[^>]*\?>/gi, '')
                      .replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/<[^>]*>?/g, '');
                      
            console.log("Cleaned document with DOCTYPE/XML tags");
          }
          
          // If text still contains HTML-like content, it's probably a binary file being read as text
          if (text.includes('<html') || text.includes('<body')) {
            throw new Error("This appears to be a complex formatted document. Try saving as plain text (.txt) first.");
          }
        } else {
          throw new Error("Failed to read file content");
        }
        
        // Ensure we have meaningful content to analyze
        if (text.trim().length < 50) {
          throw new Error("Resume content is too short to analyze");
        }
        
        // Further sanitize the text before analysis
        text = text.replace(/[^\x20-\x7E\x0A\x0D]/g, ' '); // Replace non-ASCII chars with spaces
        
        try {
          const analysis = await analyzeResumeText(text);
          resolve({
            analysis,
            text
          });
        } catch (apiError) {
          console.error("API error in resume analysis:", apiError);
          // Create a fallback analysis object when the API fails
          const fallbackAnalysis: ResumeAnalysisResult = {
            clientNames: [],
            jobTitles: [],
            relevantDates: [],
            skills: [],
            education: [],
            extractedText: text.substring(0, 4000)
          };
          
          resolve({
            analysis: fallbackAnalysis,
            text: text
          });
        }
      } catch (error) {
        console.error("Error in resume analysis:", error);
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    // For Word documents (.docx), we should use readAsArrayBuffer
    // but that would require additional parsing libraries
    // For now, we'll try a simpler approach with readAsText
    reader.readAsText(file);
  });
}
