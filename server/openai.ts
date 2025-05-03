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
  
  // Check for OPENAI_API_KEY
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing or empty");
    throw new Error("OpenAI API key is not configured. Please set up your API key in the environment variables.");
  }
  
  try {
    console.log(`Starting resume text analysis with OpenAI... Text length: ${resumeText.length} characters`);
    
    // For very short texts, we know OpenAI won't give good results
    if (resumeText.trim().length < 100) {
      console.warn("Extracted resume text is too short for meaningful analysis:", resumeText);
      throw new Error("The extracted resume text is too short for meaningful analysis. Please check the file format or try a different resume file.");
    }
    
    // Trim and process the text to improve extraction
    let processedText = resumeText.trim();
    
    // Remove excessive whitespace
    processedText = processedText.replace(/\s+/g, ' ');
    
    // Make sure to keep a reasonable amount of text for the API
    const maxLength = 10000; // Increased from 8000 to improve extraction quality
    if (processedText.length > maxLength) {
      console.log(`Truncating resume text from ${processedText.length} to ${maxLength} characters for OpenAI API`);
      processedText = processedText.substring(0, maxLength);
    }
    
    // Use OpenAI to extract structured data from the resume
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume parser that extracts structured information from resumes. " +
            "Extract all factual information that is stated in the resume. " +
            "Be thorough in identifying company names, job titles, dates, skills, and education. " +
            "If information appears to be missing or unclear, make reasonable inferences based on context. " +
            "For employment history, ensure you capture every position mentioned."
        },
        {
          role: "user",
          content: 
            `Please extract the following structured data from this resume text:
            
            Resume:
            ${processedText}
            
            Extract and return the following information in JSON format:
            - clientNames: Array of company names/employers the candidate has worked for, ordered from most recent to oldest. Include ALL employers mentioned.
            - jobTitles: Array of job titles held by the candidate, ordered from most recent to oldest. Include ALL positions mentioned.
            - relevantDates: Array of employment date ranges (e.g., "April 2023 - Present"), ordered from most recent to oldest. Include ALL date ranges mentioned.
            - skills: Array of technical and soft skills mentioned in the resume
            - education: Array of educational qualifications
            
            Ensure the clientNames, jobTitles, and relevantDates arrays have the same length and corresponding indexes.
            Never leave arrays empty unless absolutely no information is present in the resume.
            If dates are unclear, provide approximate periods or indicate "Not specified".`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3, // Lower temperature for more factual extraction
      max_tokens: 1500, // Increased to allow for more detailed extraction
    });

    console.log("OpenAI extraction completed successfully");
    
    // Parse the response content
    const responseContent = response.choices[0].message.content || '{}';
    let extractionResult;
    
    try {
      extractionResult = JSON.parse(responseContent);
    } catch (parseError) {
      console.error("Failed to parse OpenAI response JSON:", parseError);
      console.error("Raw response content:", responseContent);
      throw new Error("Failed to parse the structured data from OpenAI response");
    }
    
    // Log the extracted data to help with debugging
    console.log("OpenAI extracted resume data:");
    console.log("- clientNames:", JSON.stringify(extractionResult.clientNames || []));
    console.log("- jobTitles:", JSON.stringify(extractionResult.jobTitles || []));
    console.log("- relevantDates:", JSON.stringify(extractionResult.relevantDates || []));
    console.log("- Number of skills:", extractionResult.skills ? extractionResult.skills.length : 0);
    console.log("- Number of education entries:", extractionResult.education ? extractionResult.education.length : 0);
    
    // Check if employment history is empty
    if ((!extractionResult.clientNames || extractionResult.clientNames.length === 0) &&
        (!extractionResult.jobTitles || extractionResult.jobTitles.length === 0)) {
      console.warn("OpenAI failed to extract employment history data from resume");
    }
    
    // Return the structured data with the original text (limited for DB storage)
    return {
      clientNames: Array.isArray(extractionResult.clientNames) ? extractionResult.clientNames : [],
      jobTitles: Array.isArray(extractionResult.jobTitles) ? extractionResult.jobTitles : [],
      relevantDates: Array.isArray(extractionResult.relevantDates) ? extractionResult.relevantDates : [],
      skills: Array.isArray(extractionResult.skills) ? extractionResult.skills : [],
      education: Array.isArray(extractionResult.education) ? extractionResult.education : [],
      extractedText: resumeText.substring(0, 5000) // Increased from 4000 for better context
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
      } else if (error.message.includes("billing")) {
        throw new Error("OpenAI billing error: Please check your account status");
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