import OpenAI from 'openai';

// Create an OpenAI client instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Uses OPENAI_API_KEY from environment variables
});

export interface JobDescriptionAnalysisResult {
  keyTechnicalSkills: string[];
  nonTechnicalSkills: string[];
  experienceRequirements: string[];
  suggestedTechnicalQuestions: string[];
  suggestedBehavioralQuestions: string[];
}

export interface ContextualHelpQuery {
  feature: string;
  context?: string;
  question: string;
  userRole?: string;
}

/**
 * Get contextual help from AI assistant
 * @param query Help query parameters 
 * @returns AI generated help text
 */
export async function getContextualHelp(query: ContextualHelpQuery): Promise<string> {
  try {
    const { feature, context, question, userRole } = query;
    
    // Construct a system message that primes the AI to provide contextual help
    const systemContent = `You are an expert assistant for the HR recruitment application. 
Provide clear, helpful responses about the "${feature}" feature. 
Your answers should be concise (no more than 3 paragraphs) and conversational in tone.
${userRole ? `The user asking this question has the role: ${userRole}.` : ''}
${context ? `Additional context: ${context}` : ''}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: question }
      ],
      temperature: 0.7,
      max_tokens: 400
    });

    // Return the AI's response
    return response.choices[0].message.content || 'Sorry, I could not generate a helpful response.';
  } catch (error) {
    console.error('OpenAI contextual help error:', error);
    throw new Error(`Failed to get contextual help: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get feature explanation
 * @param feature Name of the feature to explain
 * @returns AI generated explanation
 */
export async function getFeatureExplanation(feature: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { 
          role: "system", 
          content: `You are an expert assistant for the HR recruitment application. 
Provide a brief, clear explanation (1-2 sentences) of what the "${feature}" feature does and how it helps the user.
Your explanation should be concise, friendly, and easily understood by non-technical users.` 
        },
        { 
          role: "user", 
          content: `What is the "${feature}" feature and what does it do?` 
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    // Return the AI's explanation
    return response.choices[0].message.content || `The ${feature} feature helps you manage recruitment tasks.`;
  } catch (error) {
    console.error('OpenAI feature explanation error:', error);
    throw new Error(`Failed to explain feature: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Analyzes a job description using AI to extract key information for interviews
 * @param jobDescription The full job description text
 * @returns Analysis results with key skills and suggested interview questions
 */
export async function analyzeJobDescription(jobDescription: string): Promise<JobDescriptionAnalysisResult> {
  try {
    if (!jobDescription || jobDescription.trim().length < 50) {
      throw new Error("Job description is too short for meaningful analysis");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: 
            "You are an expert technical interviewer helping prepare for candidate interviews. " +
            "Analyze the job description and identify: " +
            "1. Key technical skills required for the position " +
            "2. Important non-technical skills/soft skills mentioned " +
            "3. Essential experience requirements " +
            "4. Suggested technical questions to ask candidates " +
            "5. Suggested behavioral questions based on job requirements " +
            "Organize your response in a structured JSON format with these sections."
        },
        {
          role: "user",
          content: `Please analyze the following job description and provide key points to focus on during interviews:\n\n${jobDescription}`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    // Parse the JSON response
    const analysisText = response.choices[0].message.content;
    if (!analysisText) {
      throw new Error("Failed to get analysis from OpenAI");
    }

    // Safely parse the JSON response and handle potential parsing errors
    let parsedResult;
    try {
      parsedResult = JSON.parse(analysisText) as JobDescriptionAnalysisResult;
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.log("Raw response:", analysisText);
      throw new Error("Failed to parse analysis results from OpenAI");
    }
    
    // Ensure the result has all the expected fields with proper validation
    const result = {
      keyTechnicalSkills: Array.isArray(parsedResult.keyTechnicalSkills) ? parsedResult.keyTechnicalSkills : [],
      nonTechnicalSkills: Array.isArray(parsedResult.nonTechnicalSkills) ? parsedResult.nonTechnicalSkills : [],
      experienceRequirements: Array.isArray(parsedResult.experienceRequirements) ? parsedResult.experienceRequirements : [],
      suggestedTechnicalQuestions: Array.isArray(parsedResult.suggestedTechnicalQuestions) ? parsedResult.suggestedTechnicalQuestions : [],
      suggestedBehavioralQuestions: Array.isArray(parsedResult.suggestedBehavioralQuestions) ? parsedResult.suggestedBehavioralQuestions : [],
    };
    
    return result;
  } catch (error) {
    console.error("Error analyzing job description:", error);
    throw new Error(`Failed to analyze job description: ${error instanceof Error ? error.message : String(error)}`);
  }
}