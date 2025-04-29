import OpenAI from "openai";
import { z } from "zod";

// Create OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for resume analysis result
export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
}

// Interface for job match result 
export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

/**
 * Analyzes resume text using OpenAI to extract key information
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a resume analysis expert. Extract the following information from the resume: client names, job titles, relevant dates (employment periods), skills, and education details. Respond with a JSON object with these categories."
        },
        {
          role: "user",
          content: resumeText
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content);
    
    // Ensure we have the expected structure
    const resumeSchema = z.object({
      clientNames: z.array(z.string()).default([]),
      jobTitles: z.array(z.string()).default([]),
      relevantDates: z.array(z.string()).default([]),
      skills: z.array(z.string()).default([]),
      education: z.array(z.string()).default([])
    });

    const validatedResult = resumeSchema.parse(result);

    return {
      ...validatedResult,
      extractedText: resumeText.substring(0, 5000) // Store first 5000 chars as a sample
    };
  } catch (error) {
    console.error("OpenAI resume analysis error:", error);
    throw new Error(`Failed to analyze resume: ${(error as Error).message}`);
  }
}

/**
 * Matches resume to job description using OpenAI
 */
export async function matchResumeToJob(
  resumeText: string,
  jobDescription: string
): Promise<MatchScoreResult> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at matching candidates to job descriptions. Analyze the resume and job description to determine:
          1. A match score from 0-100
          2. The candidate's key strengths for this role
          3. Areas where the candidate's experience is weak compared to requirements
          4. Suggestions for how the candidate could be positioned for this role
          
          Return as a JSON object with the keys: score, strengths, weaknesses, and suggestions.`
        },
        {
          role: "user",
          content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const result = JSON.parse(content);
    
    // Ensure we have the expected structure
    const matchSchema = z.object({
      score: z.number().min(0).max(100),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      suggestions: z.array(z.string())
    });

    return matchSchema.parse(result);
  } catch (error) {
    console.error("OpenAI job matching error:", error);
    throw new Error(`Failed to match resume to job: ${(error as Error).message}`);
  }
}