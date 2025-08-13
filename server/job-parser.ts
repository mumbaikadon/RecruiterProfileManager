import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ParsedJobData {
  title?: string;
  client?: string;
  city?: string;
  state?: string;
  rate?: string;
  interviewType?: string;
  visaRestrictions?: string;
  requiredSkills?: string[];
  description?: string;
}

export async function parseJobRequirements(requirementText: string): Promise<ParsedJobData> {
  try {
    const prompt = `
Parse the following job requirements and extract structured information. Return a JSON object with these fields:
- title: Job title/position
- client: Company/client name
- city: City location
- state: State location
- rate: Pay rate (e.g., "$55/hr", "$80k-100k/year")
- interviewType: Type of interview (phone, video, onsite, hybrid)
- visaRestrictions: Visa/work authorization requirements
- requiredSkills: Array of required technical skills
- description: Clean job description

Job Requirements Text:
${requirementText}

Return only valid JSON without any markdown formatting or explanations.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a job requirements parser. Extract structured information from job postings and return valid JSON only."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const parsedData = JSON.parse(responseContent);
    
    // Ensure requiredSkills is an array
    if (parsedData.requiredSkills && !Array.isArray(parsedData.requiredSkills)) {
      parsedData.requiredSkills = [parsedData.requiredSkills];
    }

    return parsedData;
  } catch (error) {
    console.error('Error parsing job requirements:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    throw new Error(`Failed to parse job requirements: ${errorMessage}`);
  }
}