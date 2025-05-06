import OpenAI from "openai";

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for gap details
interface GapDetail {
  category: string;
  gaps: string[];
  importance: string;
  impact: string;
  suggestions: string[];
}

// Interface for the analysis result
interface AnalysisResult {
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  education?: string[];
  skillsGapAnalysis: {
    missingSkills: string[];
    matchingSkills: string[];
    suggestedTraining: string[];
    gapDetails?: GapDetail[];
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
            "You are an expert resume analyzer specializing in extracting accurate employment history and education details from resumes. " +
            "Your primary task is to extract REAL data from the resume - never generate fake or generic data. " +
            "If you cannot find clear employment history or education details, respond with empty arrays rather than making up placeholder data. " +
            "Extract exact company names, job titles, employment dates, educational institutions, degrees, and graduation years directly from the resume text. " +
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
            
            IMPORTANT - DATA EXTRACTION INSTRUCTIONS:
            1. Carefully read the entire resume text
            
            2. EMPLOYMENT HISTORY:
               - Search for sections labeled "Experience", "Work Experience", "Professional Experience", "Employment History", etc.
               - Extract the following from these sections EXACTLY as they appear in the resume:
                  - clientNames: Array of company/employer names the candidate worked for (most recent first)
                  - jobTitles: Array of job titles/positions held by the candidate (most recent first)
                  - relevantDates: Array of employment periods (most recent first)
            
            3. EDUCATION:
               - Search for sections labeled "Education", "Academic Background", "Qualifications", etc.
               - Extract the following from these sections EXACTLY as they appear in the resume:
                  - education: Array of education details including degrees, institutions, and graduation years
                  - Format each entry as: "Degree, Institution, Year" or however it appears in the resume
            
            4. DETAILED SKILLS GAP ANALYSIS:
               - Identify key skills, experience, and qualifications required in the job description
               - Check if the resume demonstrates these required skills/experience
               - For each significant gap, provide specific details about:
                  a) The nature of the gap (domain expertise, technical skills, experience level, etc.)
                  b) The importance of this skill/experience to the role (critical, important, nice-to-have)
                  c) Specific examples of what's missing and why it matters
               - Group gaps into categories (technical skills, domain knowledge, experience type, etc.)
               - Provide actionable suggestions for addressing each gap
            
            5. Calculate an overall match percentage score (0-100) based on the alignment between the resume and job requirements.
            
            Return your analysis in a structured JSON format with the following fields:
            - clientNames (array of strings: extract EXACT company names from the resume)
            - jobTitles (array of strings: extract EXACT job titles from the resume)
            - relevantDates (array of strings: extract EXACT date ranges from the resume)
            - education (array of strings: extract EXACT education details from the resume)
            - skillsGapAnalysis: { 
                missingSkills (array of strings), 
                matchingSkills (array of strings), 
                suggestedTraining (array of strings),
                gapDetails: [
                  {
                    category: string, // e.g., "Technical Skills", "Domain Knowledge", "Industry Experience"
                    gaps: string[], // Specific gaps in this category
                    importance: string, // "Critical", "Important", or "Nice-to-have"
                    impact: string, // How this gap impacts candidacy
                    suggestions: string[] // Actionable ways to address this gap
                  }
                ] 
              }
            - relevantExperience (array of relevant experiences from the resume)
            - improvements: { content (array), formatting (array), language (array) }
            - overallScore (number 0-100)
            - confidenceScore (number 0-1)
            
            NOTICE: It is critical that you extract only actual data from the resume. NEVER invent company names, job titles, dates, education details, etc. If you cannot find certain information, return empty arrays for those fields.`
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
    
    // Log education data as well
    console.log("- education:", JSON.stringify(analysisResult.education));
    
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
      // Add education data
      education: Array.isArray(analysisResult.education)
        ? analysisResult.education
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
          : [],
        // Include detailed gap analysis if available
        gapDetails: Array.isArray(analysisResult.skillsGapAnalysis?.gapDetails)
          ? analysisResult.skillsGapAnalysis.gapDetails.map(gap => ({
              category: gap.category || "",
              gaps: Array.isArray(gap.gaps) ? gap.gaps : [],
              importance: gap.importance || "Important",
              impact: gap.impact || "",
              suggestions: Array.isArray(gap.suggestions) ? gap.suggestions : []
            }))
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