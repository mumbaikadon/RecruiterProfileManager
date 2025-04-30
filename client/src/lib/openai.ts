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
    const res = await apiRequest("POST", "/api/openai/analyze-resume", { text: resumeText });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: "Failed to analyze resume" }));
      throw new Error(errorData.message || "Failed to analyze resume");
    }
    
    const result = await res.json();
    return result as ResumeAnalysisResult;
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
    
    const res = await apiRequest("POST", "/api/openai/match-resume", { 
      resumeText, 
      jobDescription 
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: "Failed to match resume" }));
      throw new Error(errorData.message || "Failed to match resume");
    }
    
    const result = await res.json();
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
    const fileName = file.name.toLowerCase();
    
    // Special handling for DOCX files
    if (fileName.endsWith('.docx')) {
      console.log("Processing DOCX file with special handling");
      
      // For DOCX files, we'll provide a minimal text representation
      // since we can't extract text properly without additional libraries
      const docxPlaceholder = `Resume file: ${file.name} (${Math.round(file.size / 1024)} KB)
Type: Word Document (DOCX format)
Last Modified: ${new Date(file.lastModified).toLocaleString()}`;
      
      // Return minimal data for DOCX files to avoid parsing errors
      resolve({
        analysis: {
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: [],
          extractedText: docxPlaceholder
        },
        text: docxPlaceholder
      });
      return;
    }
    
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
                      .replace(/<[^>]*>?/g, ' ');
                      
            console.log("Cleaned document with DOCTYPE/XML tags");
          }
          
          // If text still contains HTML-like content, it's probably a binary file being read as text
          if (text.includes('<html') || text.includes('<body')) {
            console.warn("Document appears to contain HTML content, providing limited parsing");
            text = `Resume file: ${file.name} (contains HTML content that cannot be fully parsed)`;
          }
          
          // Check for binary file signatures that might indicate a non-text file
          if (text.includes('\u0000') || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text.substring(0, 100))) {
            console.warn("File appears to be binary, cannot parse content directly");
            text = `Resume file: ${file.name} (binary format that cannot be directly read)`;
          }
        } else {
          console.warn("Failed to read file content as string");
          text = `Resume file: ${file.name} (format not supported for direct text extraction)`;
        }
        
        // Ensure we have meaningful content to analyze (even if it's just the filename)
        if (text.trim().length < 10) {
          text = `Resume file: ${file.name}`;
        }
        
        // Further sanitize the text before analysis
        text = text.replace(/[^\x20-\x7E\x0A\x0D]/g, ' '); // Replace non-ASCII chars with spaces
        
        try {
          console.log("Sending resume text for analysis, length:", text.length);
          const analysis = await analyzeResumeText(text);
          console.log("Analysis successful");
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
        // Don't reject - provide minimal data instead
        const minimalText = `Resume file: ${file.name}`;
        resolve({
          analysis: {
            clientNames: [],
            jobTitles: [],
            relevantDates: [],
            skills: [],
            education: [],
            extractedText: minimalText
          },
          text: minimalText
        });
      }
    };
    
    reader.onerror = () => {
      console.error("Error reading file:", file.name);
      // Don't reject - provide minimal data instead
      const errorText = `Error reading file: ${file.name}`;
      resolve({
        analysis: {
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: [],
          extractedText: errorText
        },
        text: errorText
      });
    };
    
    // For Word documents (.docx), we'll use the special handling above
    // For other files, try to read as text
    if (!fileName.endsWith('.docx')) {
      reader.readAsText(file);
    }
  });
}
