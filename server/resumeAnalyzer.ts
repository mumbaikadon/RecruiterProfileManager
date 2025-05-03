import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface AnalysisResult {
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
  try {
    // Validate inputs
    if (!resumeText || resumeText.trim().length < 50) {
      throw new Error("Resume text is too short for meaningful analysis");
    }
    
    if (!jobDescription || jobDescription.trim().length < 50) {
      throw new Error("Job description is too short for meaningful analysis");
    }

    // Prepare a prompt for the OpenAI API
    const prompt = `
      Analyze this resume and job description pair. Focus on both matching skills/experience and gaps.
      Provide detailed feedback in JSON format with the following structure:
      {
        "skillsGapAnalysis": {
          "missingSkills": [], // Skills mentioned in job but missing from resume
          "matchingSkills": [], // Skills present in both resume and job requirements
          "suggestedTraining": [] // Specific courses or certifications that could help
        },
        "relevantExperience": [], // List of experiences from the resume that directly relate to job requirements
        "improvements": {
          "content": [], // Specific content improvement suggestions
          "formatting": [], // Formatting and structure suggestions
          "language": [] // Language and phrasing improvements
        },
        "overallScore": 0-100, // Overall match score
        "confidenceScore": 0-1 // Confidence in the analysis
      }

      Resume:
      ${resumeText}

      Job Description:
      ${jobDescription}
    `;

    // Call the OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    // Parse the response
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Failed to get analysis from OpenAI");
    }

    // Parse the JSON response
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      throw new Error("Failed to parse analysis results");
    }

    // Return the formatted result with default values for any missing fields
    return {
      skillsGapAnalysis: {
        missingSkills: Array.isArray(result.skillsGapAnalysis?.missingSkills) ? result.skillsGapAnalysis.missingSkills : [],
        matchingSkills: Array.isArray(result.skillsGapAnalysis?.matchingSkills) ? result.skillsGapAnalysis.matchingSkills : [],
        suggestedTraining: Array.isArray(result.skillsGapAnalysis?.suggestedTraining) ? result.skillsGapAnalysis.suggestedTraining : []
      },
      relevantExperience: Array.isArray(result.relevantExperience) ? result.relevantExperience : [],
      improvements: {
        content: Array.isArray(result.improvements?.content) ? result.improvements.content : [],
        formatting: Array.isArray(result.improvements?.formatting) ? result.improvements.formatting : [],
        language: Array.isArray(result.improvements?.language) ? result.improvements.language : []
      },
      overallScore: Math.min(100, Math.max(0, result.overallScore || 0)),
      confidenceScore: Math.min(1, Math.max(0, result.confidenceScore || 0))
    };
  } catch (error) {
    console.error('Resume analysis error:', error);
    throw new Error(`Failed to analyze resume: ${error instanceof Error ? error.message : String(error)}`);
  }
}