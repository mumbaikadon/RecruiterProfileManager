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
    // Enhanced debugging for resume text
    console.log("Sending OpenAI request with resume length:", resumeText.length, "and job description length:", jobDescription.length);
    
    // Log a preview of the resume text to debug content issues
    const resumePreview = resumeText.substring(0, 300) + "...";
    console.log("Resume text preview for analysis:", resumePreview);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer specializing in extracting accurate employment history from resumes. " +
            "Your primary task is to extract REAL employment data from the resume - never generate fake or generic data. " +
            "If you cannot find clear employment history, respond with empty arrays rather than making up placeholder data. " +
            "Extract exact company names, job titles, and employment dates directly from the resume text. " +
            "Be precise, accurate, and only use information actually present in the resume."
        },
        {
          role: "user",
          content: 
            `I need you to analyze this resume for compatibility with the following job description.
            
            Resume:
            ${resumeText}
            
            Job Description:
            ${jobDescription}
            
            IMPORTANT - EMPLOYMENT HISTORY EXTRACTION INSTRUCTIONS:
            1. Carefully read the entire resume text
            2. Search for sections labeled "Experience", "Work Experience", "Professional Experience", "Employment History", etc.
            3. Extract the following from these sections EXACTLY as they appear in the resume - do not generate or fabricate data:
               - clientNames: Array of company/employer names the candidate worked for (most recent first)
               - jobTitles: Array of job titles/positions held by the candidate (most recent first)
               - relevantDates: Array of employment periods (most recent first)
            
            2. Then analyze the fit between this resume and job description. Calculate an overall match percentage score (0-100).
            
            Return your analysis in a structured JSON format with the following fields:
            - clientNames (array of strings: extract EXACT company names from the resume)
            - jobTitles (array of strings: extract EXACT job titles from the resume)
            - relevantDates (array of strings: extract EXACT date ranges from the resume)
            - skillsGapAnalysis: { missingSkills (array), matchingSkills (array), suggestedTraining (array) }
            - relevantExperience (array of relevant experiences from the resume)
            - improvements: { content (array), formatting (array), language (array) }
            - overallScore (number 0-100)
            - confidenceScore (number 0-1)
            
            NOTICE: It is critical that you extract only actual employment data from the resume. NEVER invent company names, job titles, or dates. If you cannot find employment history, return empty arrays.`
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
    
    // Log the structured data from OpenAI to help with debugging
    console.log("OpenAI extracted employment history data:");
    console.log("- clientNames:", JSON.stringify(analysisResult.clientNames));
    console.log("- jobTitles:", JSON.stringify(analysisResult.jobTitles));
    console.log("- relevantDates:", JSON.stringify(analysisResult.relevantDates));
    
    // Validate and sanitize the response
    const sanitizedResult: AnalysisResult = {
      // Add employment history data
      clientNames: Array.isArray(analysisResult.clientNames) 
        ? analysisResult.clientNames 
        : [],
      jobTitles: Array.isArray(analysisResult.jobTitles) 
        ? analysisResult.jobTitles 
        : [],
      relevantDates: Array.isArray(analysisResult.relevantDates) 
        ? analysisResult.relevantDates 
        : [],
      // Skills analysis
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