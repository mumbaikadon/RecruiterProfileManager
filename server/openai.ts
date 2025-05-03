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
 * Simple resume text analysis that extracts basic fields
 * This function will be used for initial resume data extraction
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  // Basic validation
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("Resume text cannot be empty");
  }
  
  try {
    // We keep this lightweight - just return the basic structure
    // Actual analysis is done in the matchResumeToJob function
    return {
      clientNames: [],
      jobTitles: [],  
      relevantDates: [],
      skills: [],
      education: [],
      extractedText: resumeText.substring(0, 4000) // Limit to 4000 chars for DB storage
    };
  } catch (error) {
    console.error("Error analyzing resume text:", error);
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