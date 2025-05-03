import OpenAI from "openai";

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for the analysis result
interface AnalysisResult {
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  skillsGapAnalysis: {
    missingSkills: string[];
    matchingSkills: string[];
    suggestedTraining: string[];
  };
  relevantExperience: string[];
  improvements: {
    content: string[];
    formatting: string[];
    language: string[];
  };
  overallScore: number;
  confidenceScore: number;
}

/**
 * Analyzes a resume by comparing it to a job description
 * @param resumeText The extracted resume text
 * @param jobDescription The job description to compare against
 * @returns Analysis result with match score and insights
 */
export async function analyzeResume(resumeText: string, jobDescription: string): Promise<AnalysisResult> {
  // Validate inputs
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("Resume text cannot be empty");
  }
  
  if (!jobDescription || jobDescription.trim().length === 0) {
    throw new Error("Job description cannot be empty");
  }

  try {
    console.log("Starting resume analysis with OpenAI...");
    
    // Use OpenAI to analyze the resume against the job description
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer that compares resumes to job descriptions and provides detailed feedback. " +
            "Analyze the resume against the job description and provide a comprehensive assessment. " +
            "Focus on identifying matching skills, missing skills, and areas for improvement. " +
            "Be constructive and thorough in your analysis. " +
            "Additionally, extract structured employment history data including client names/companies, job titles, and dates. " +
            "Respond with a JSON structure containing all analysis results."
        },
        {
          role: "user",
          content: 
            `Please analyze this resume for compatibility with the following job description. 
            
            Resume:
            ${resumeText}
            
            Job Description:
            ${jobDescription}
            
            1. First, extract the following structured data from the resume:
            - clientNames: Array of company names/employers the candidate has worked for, ordered from most recent to oldest
            - jobTitles: Array of job titles held by the candidate, ordered from most recent to oldest
            - relevantDates: Array of employment date ranges (e.g., "April 2023 - Present"), ordered from most recent to oldest
            
            2. Then analyze the fit between this resume and job description. Calculate an overall match percentage score (0-100).
            
            Return your analysis in a structured JSON format with the following fields:
            - clientNames (array of strings: company/employer names from most recent to oldest)
            - jobTitles (array of strings: job title positions from most recent to oldest)
            - relevantDates (array of strings: employment periods from most recent to oldest)
            - skillsGapAnalysis: { missingSkills (array), matchingSkills (array), suggestedTraining (array) }
            - relevantExperience (array of relevant experiences from the resume)
            - improvements: { content (array), formatting (array), language (array) }
            - overallScore (number 0-100)
            - confidenceScore (number 0-1)
            
            Focus on technical and soft skills, relevant experience, and overall fit. Ensure the clientNames, jobTitles, and relevantDates arrays have the same length and corresponding indexes (e.g., clientNames[0], jobTitles[0], and relevantDates[0] should all refer to the same job).`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000,
    });

    console.log("OpenAI analysis completed");
    
    // Parse the response and return the structured analysis
    // Parse the JSON response content (ensuring it's not null)
    const responseContent = response.choices[0].message.content || '{}';
    const analysisResult = JSON.parse(responseContent) as AnalysisResult;
    
    // Validate and sanitize the response
    const sanitizedResult: AnalysisResult = {
      skillsGapAnalysis: {
        missingSkills: Array.isArray(analysisResult.skillsGapAnalysis?.missingSkills) 
          ? analysisResult.skillsGapAnalysis.missingSkills 
          : [],
        matchingSkills: Array.isArray(analysisResult.skillsGapAnalysis?.matchingSkills) 
          ? analysisResult.skillsGapAnalysis.matchingSkills 
          : [],
        suggestedTraining: Array.isArray(analysisResult.skillsGapAnalysis?.suggestedTraining) 
          ? analysisResult.skillsGapAnalysis.suggestedTraining 
          : []
      },
      relevantExperience: Array.isArray(analysisResult.relevantExperience) 
        ? analysisResult.relevantExperience 
        : [],
      improvements: {
        content: Array.isArray(analysisResult.improvements?.content) 
          ? analysisResult.improvements.content 
          : [],
        formatting: Array.isArray(analysisResult.improvements?.formatting) 
          ? analysisResult.improvements.formatting 
          : [],
        language: Array.isArray(analysisResult.improvements?.language) 
          ? analysisResult.improvements.language 
          : []
      },
      overallScore: typeof analysisResult.overallScore === 'number' 
        ? Math.max(0, Math.min(100, analysisResult.overallScore)) 
        : 0,
      confidenceScore: typeof analysisResult.confidenceScore === 'number' 
        ? Math.max(0, Math.min(1, analysisResult.confidenceScore)) 
        : 0
    };
    
    return sanitizedResult;
    
  } catch (error) {
    console.error("Error during resume analysis:", error);
    
    // For OpenAI API errors, provide more specific error message
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("OpenAI API key error: Please check your API key configuration");
      } else if (error.message.includes("rate limit")) {
        throw new Error("OpenAI rate limit exceeded: Please try again later");
      } else if (error.message.includes("timeout")) {
        throw new Error("OpenAI request timed out: Please try again later");
      }
      throw error;
    }
    
    throw new Error("Unknown error during resume analysis");
  }
}

/**
 * Generates improved content for a section of the resume based on analysis
 * For future implementation if enhanced resume suggestions are needed
 */
export async function generateImprovedContent(
  resumeSection: string,
  jobDescription: string,
  sectionType: string
): Promise<string> {
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert resume writer who specializes in optimizing resume content to match job descriptions."
        },
        {
          role: "user",
          content: `Improve this ${sectionType} section of a resume to better match the following job description:
          
          ${sectionType} Section:
          ${resumeSection}
          
          Job Description:
          ${jobDescription}
          
          Focus on highlighting relevant skills and experience. Maintain the original information but improve phrasing, clarity, and relevance to the job description.`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    return response.choices[0].message.content || '';
  } catch (error) {
    console.error(`Error generating improved content for ${sectionType}:`, error);
    throw new Error(`Failed to generate improved content: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}