import OpenAI from "openai";
import { analyzeResume as resumeAnalyzer } from "./resumeAnalyzer";

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for the resume analysis result returned from the API
export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
}

// Interface for the match result between a resume and job description
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
  
  // Legacy fields for backward compatibility
  clientExperience?: string;
  confidence?: number;
}

/**
 * Analyzes resume text and extracts structured data using OpenAI
 * This function handles initial resume data extraction for storage
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  // Basic validation
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("Resume text cannot be empty");
  }
  
  try {
    console.log("Starting resume text analysis with OpenAI...");
    
    // Use OpenAI to extract structured data from the resume
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume parser that extracts structured information from resumes. " +
            "Extract only factual information that is explicitly stated in the resume. " +
            "Do not make assumptions or add information not present in the text."
        },
        {
          role: "user",
          content: 
            `Please extract the following structured data from this resume text:
            
            Resume:
            ${resumeText.substring(0, 8000)} // Limit input to 8000 chars to avoid token limits
            
            Extract and return the following information in JSON format:
            - clientNames: Array of company names/employers the candidate has worked for, ordered from most recent to oldest
            - jobTitles: Array of job titles held by the candidate, ordered from most recent to oldest
            - relevantDates: Array of employment date ranges (e.g., "April 2023 - Present"), ordered from most recent to oldest
            - skills: Array of technical and soft skills mentioned in the resume
            - education: Array of educational qualifications
            
            Ensure the clientNames, jobTitles, and relevantDates arrays have the same length and corresponding indexes.
            If you're not sure about any information, leave it out rather than guessing.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more factual extraction
      max_tokens: 1000,
    });

    console.log("OpenAI extraction completed");
    
    // Parse the response content
    const responseContent = response.choices[0].message.content || '{}';
    const extractionResult = JSON.parse(responseContent);
    
    // Log the extracted data to help with debugging
    console.log("OpenAI extracted resume data:");
    console.log("- clientNames:", JSON.stringify(extractionResult.clientNames || []));
    console.log("- jobTitles:", JSON.stringify(extractionResult.jobTitles || []));
    console.log("- relevantDates:", JSON.stringify(extractionResult.relevantDates || []));
    console.log("- Number of skills:", extractionResult.skills ? extractionResult.skills.length : 0);
    console.log("- Number of education entries:", extractionResult.education ? extractionResult.education.length : 0);
    
    // Return the structured data with the original text (limited for DB storage)
    return {
      clientNames: Array.isArray(extractionResult.clientNames) ? extractionResult.clientNames : [],
      jobTitles: Array.isArray(extractionResult.jobTitles) ? extractionResult.jobTitles : [],
      relevantDates: Array.isArray(extractionResult.relevantDates) ? extractionResult.relevantDates : [],
      skills: Array.isArray(extractionResult.skills) ? extractionResult.skills : [],
      education: Array.isArray(extractionResult.education) ? extractionResult.education : [],
      extractedText: resumeText.substring(0, 4000) // Limit to 4000 chars for DB storage
    };
  } catch (error) {
    console.error("Error analyzing resume text:", error);
    
    // For OpenAI API errors, provide more specific error message
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("OpenAI API key error: Please check your API key configuration");
      } else if (error.message.includes("rate limit")) {
        throw new Error("OpenAI rate limit exceeded: Please try again later");
      } else if (error.message.includes("timeout")) {
        throw new Error("OpenAI request timed out: Please try again later");
      }
    }
    
    throw error;
  }
}

/**
 * Advanced resume analysis that matches a resume against a job description
 * @param resumeText The resume text to analyze
 * @param jobDescription The job description to match against
 * @returns Analysis result with match score and insights
 */
export async function matchResumeToJob(resumeText: string, jobDescription: string): Promise<MatchScoreResult> {
  // Validate inputs
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("Resume text cannot be empty");
  }
  
  if (!jobDescription || jobDescription.trim().length === 0) {
    throw new Error("Job description cannot be empty");
  }
  
  try {
    // Use the resumeAnalyzer from resumeAnalyzer.ts for the detailed analysis
    console.log("Calling resumeAnalyzer function");
    const analysis = await resumeAnalyzer(resumeText, jobDescription);
    
    // Format the result to match our expected API structure
    const result: MatchScoreResult = {
      // Core match scores and analysis
      score: analysis.overallScore,
      strengths: analysis.relevantExperience,
      weaknesses: analysis.skillsGapAnalysis.missingSkills,
      suggestions: analysis.improvements.content,
      
      // Skills analysis
      technicalGaps: analysis.skillsGapAnalysis.missingSkills,
      matchingSkills: analysis.skillsGapAnalysis.matchingSkills,
      missingSkills: analysis.skillsGapAnalysis.missingSkills,
      
      // Employment history data
      clientNames: analysis.clientNames || [],
      jobTitles: analysis.jobTitles || [],
      relevantDates: analysis.relevantDates || [],
      
      // Legacy fields
      clientExperience: analysis.relevantExperience.join(", "),
      confidence: analysis.confidenceScore
    };
    
    return result;
  } catch (error) {
    console.error("Error matching resume to job:", error);
    throw error;
  }
}