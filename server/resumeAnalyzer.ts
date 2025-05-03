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

  // Check for OPENAI_API_KEY
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is missing or empty");
    throw new Error("OpenAI API key is not configured. Please set up your API key in the environment variables.");
  }

  try {
    console.log("Starting resume analysis with OpenAI...");
    
    // Process inputs to improve analysis quality
    const processedResumeText = resumeText.trim().replace(/\s+/g, ' ');
    const processedJobDescription = jobDescription.trim().replace(/\s+/g, ' ');
    
    // For very short texts, we know OpenAI won't give good results
    if (processedResumeText.length < 100) {
      console.warn("Resume text is too short for meaningful analysis:", processedResumeText);
      throw new Error("The resume text is too short for meaningful analysis. Please provide a more detailed resume.");
    }
    
    if (processedJobDescription.length < 50) {
      console.warn("Job description is too short for meaningful analysis:", processedJobDescription);
      throw new Error("The job description is too short for meaningful analysis. Please provide a more detailed job description.");
    }
    
    // Truncate long inputs to stay within token limits while keeping enough context
    const maxResumeLength = 8000;
    const maxJobDescLength = 4000;
    
    const truncatedResume = processedResumeText.length > maxResumeLength 
      ? processedResumeText.substring(0, maxResumeLength) 
      : processedResumeText;
      
    const truncatedJobDesc = processedJobDescription.length > maxJobDescLength
      ? processedJobDescription.substring(0, maxJobDescLength)
      : processedJobDescription;
    
    console.log("Sending OpenAI request with resume length:", truncatedResume.length, "and job description length:", truncatedJobDesc.length);
    
    // Use OpenAI to analyze the resume against the job description
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer with extensive experience in technical recruiting and HR. " +
            "You compare resumes to job descriptions and provide detailed, constructive feedback. " +
            "You carefully analyze skills, experience, and qualifications to determine job fit. " +
            "You extract structured data including employment history, skills, and qualifications. " +
            "When calculating match scores, be objective but generous - if a candidate has transferable skills " +
            "or related experience, give them appropriate credit. " +
            "Always structure your response as valid JSON with specific required fields."
        },
        {
          role: "user",
          content: 
            `Analyze this resume for compatibility with the following job description and calculate a match percentage score.
            
            Resume:
            ${truncatedResume}
            
            Job Description:
            ${truncatedJobDesc}
            
            1. Extract this structured data from the resume:
            - clientNames: Array of ALL company names/employers the candidate has worked for
            - jobTitles: Array of ALL job titles held by the candidate
            - relevantDates: Array of ALL employment date ranges
            
            2. Analyze the match between this resume and job description with:
            - A detailed skills gap analysis (matching and missing skills)
            - Relevant experience assessment
            - Improvement suggestions
            - An overall match percentage score (0-100)
            
            Return your analysis as a JSON object with these fields:
            - clientNames (array of strings)
            - jobTitles (array of strings)
            - relevantDates (array of strings)
            - skillsGapAnalysis: { 
                missingSkills (array), 
                matchingSkills (array), 
                suggestedTraining (array) 
              }
            - relevantExperience (array of relevant experiences)
            - improvements: { 
                content (array), 
                formatting (array), 
                language (array) 
              }
            - overallScore (number 0-100)
            - confidenceScore (number 0-1)
            
            Ensure all arrays in the response are populated with actual data from your analysis.
            Do not return empty arrays unless absolutely no relevant information exists.
            If you find minimal information, still provide at least placeholder values with appropriate notes.
            Ensure the overallScore is greater than 0 unless the resume is completely mismatched with the job.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4, // Slightly lower temperature for more consistent results
      max_tokens: 2500, // Increased to allow for comprehensive analysis
    });

    console.log("OpenAI analysis completed");
    
    // Parse the response and return the structured analysis
    const responseContent = response.choices[0].message.content || '{}';
    let analysisResult;
    
    try {
      analysisResult = JSON.parse(responseContent) as AnalysisResult;
    } catch (parseError) {
      console.error("Failed to parse OpenAI response JSON:", parseError);
      console.error("Raw response content:", responseContent);
      throw new Error("Failed to parse OpenAI response into structured analysis");
    }
    
    // Log the structured data from OpenAI to help with debugging
    console.log("Match score from OpenAI:", analysisResult.overallScore);
    console.log("OpenAI extracted employment history data:");
    console.log("- clientNames:", JSON.stringify(analysisResult.clientNames || []));
    console.log("- jobTitles:", JSON.stringify(analysisResult.jobTitles || []));
    console.log("- relevantDates:", JSON.stringify(analysisResult.relevantDates || []));
    console.log("- matchingSkills count:", analysisResult.skillsGapAnalysis?.matchingSkills?.length || 0);
    console.log("- missingSkills count:", analysisResult.skillsGapAnalysis?.missingSkills?.length || 0);
    
    // Provide fallback responses for empty fields to ensure consistent response format
    // but also log warnings so we can diagnose problems
    if (!analysisResult.clientNames || analysisResult.clientNames.length === 0) {
      console.warn("No client names extracted from resume");
      analysisResult.clientNames = ["No employer information detected"];
    }
    
    if (!analysisResult.jobTitles || analysisResult.jobTitles.length === 0) {
      console.warn("No job titles extracted from resume");
      analysisResult.jobTitles = ["No job title information detected"];
    }
    
    if (!analysisResult.relevantDates || analysisResult.relevantDates.length === 0) {
      console.warn("No date ranges extracted from resume");
      analysisResult.relevantDates = ["No date information detected"];
    }
    
    // Give a minimum match score if the resume contains any relevant content
    if (analysisResult.overallScore === 0 && truncatedResume.length > 200) {
      console.warn("OpenAI returned 0% match score despite resume content - setting minimum score");
      analysisResult.overallScore = 10; // Default minimum score unless completely irrelevant
    }
    
    // Validate and sanitize the response
    const sanitizedResult: AnalysisResult = {
      // Add employment history data
      clientNames: Array.isArray(analysisResult.clientNames) 
        ? analysisResult.clientNames 
        : ["Information not found"],
      jobTitles: Array.isArray(analysisResult.jobTitles) 
        ? analysisResult.jobTitles 
        : ["Information not found"],
      relevantDates: Array.isArray(analysisResult.relevantDates) 
        ? analysisResult.relevantDates 
        : ["Information not found"],
      // Skills analysis
      skillsGapAnalysis: {
        missingSkills: Array.isArray(analysisResult.skillsGapAnalysis?.missingSkills) 
          ? analysisResult.skillsGapAnalysis.missingSkills 
          : ["Skills analysis not available"],
        matchingSkills: Array.isArray(analysisResult.skillsGapAnalysis?.matchingSkills) 
          ? analysisResult.skillsGapAnalysis.matchingSkills 
          : [],
        suggestedTraining: Array.isArray(analysisResult.skillsGapAnalysis?.suggestedTraining) 
          ? analysisResult.skillsGapAnalysis.suggestedTraining 
          : ["Skills development recommendations not available"]
      },
      relevantExperience: Array.isArray(analysisResult.relevantExperience) 
        ? analysisResult.relevantExperience 
        : ["Relevant experience analysis not available"],
      improvements: {
        content: Array.isArray(analysisResult.improvements?.content) 
          ? analysisResult.improvements.content 
          : ["Content improvement suggestions not available"],
        formatting: Array.isArray(analysisResult.improvements?.formatting) 
          ? analysisResult.improvements.formatting 
          : ["Formatting improvement suggestions not available"],
        language: Array.isArray(analysisResult.improvements?.language) 
          ? analysisResult.improvements.language 
          : ["Language improvement suggestions not available"]
      },
      overallScore: typeof analysisResult.overallScore === 'number' 
        ? Math.max(0, Math.min(100, analysisResult.overallScore)) 
        : 10, // Default to low but non-zero score if missing
      confidenceScore: typeof analysisResult.confidenceScore === 'number' 
        ? Math.max(0, Math.min(1, analysisResult.confidenceScore)) 
        : 0.5 // Default medium confidence
    };
    
    console.log("Final match score after validation:", sanitizedResult.overallScore);
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
      } else if (error.message.includes("billing")) {
        throw new Error("OpenAI billing error: Please check your account status");
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