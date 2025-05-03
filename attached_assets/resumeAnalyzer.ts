import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

export async function analyzeResume(resumeText: string, jobDescription: string): Promise<AnalysisResult> {
  try {
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

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return {
      skillsGapAnalysis: {
        missingSkills: result.skillsGapAnalysis?.missingSkills || [],
        matchingSkills: result.skillsGapAnalysis?.matchingSkills || [],
        suggestedTraining: result.skillsGapAnalysis?.suggestedTraining || []
      },
      relevantExperience: result.relevantExperience || [],
      improvements: {
        content: result.improvements?.content || [],
        formatting: result.improvements?.formatting || [],
        language: result.improvements?.language || []
      },
      overallScore: Math.min(100, Math.max(0, result.overallScore || 0)),
      confidenceScore: Math.min(1, Math.max(0, result.confidenceScore || 0))
    };
  } catch (error) {
    console.error('Resume analysis error:', error);
    throw new Error('Failed to analyze resume');
  }
}

export async function generateImprovedContent(
  section: string,
  currentContent: string,
  jobDescription: string
): Promise<string> {
  try {
    const prompt = `
      Improve this ${section} section of the resume to better match the job requirements.
      Make it more impactful and professional while maintaining truthfulness.
      Focus on relevant achievements and metrics.

      Current content:
      ${currentContent}

      Job Description:
      ${jobDescription}

      Provide the improved content in JSON format: { "improvedContent": "..." }
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    return result.improvedContent || currentContent;
  } catch (error) {
    console.error('Content improvement error:', error);
    throw new Error('Failed to generate improved content');
  }
}