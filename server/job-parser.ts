import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface ParsedJobData {
  title?: string;
  client?: string;
  city?: string;
  state?: string;
  rate?: string;
  interviewType?: "phone" | "video" | "onsite" | "hybrid";
  visaRestrictions?: string;
  requiredSkills?: string[];
  description?: string;
  duration?: string;
  jobType?: "onsite" | "remote" | "hybrid";
}

/**
 * Parse job requirements text using OpenAI to extract structured data
 * @param requirementText Raw job requirement text to parse
 * @returns Parsed job data structure
 */
export async function parseJobRequirements(requirementText: string): Promise<ParsedJobData> {
  if (!requirementText || requirementText.trim().length === 0) {
    throw new Error("Requirement text cannot be empty");
  }

  try {
    console.log("Starting job requirement parsing with OpenAI...");
    console.log(`Requirement text length: ${requirementText.length} characters`);

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert job posting parser specializing in extracting structured information from job requirements. " +
            "Your task is to extract REAL data from the job posting - never generate fake or generic data. " +
            "Parse the text carefully and extract job details like position title, location, rate, visa restrictions, " +
            "interview type, required skills, and job description. Be precise and only extract information actually present."
        },
        {
          role: "user",
          content: `
            Parse this job requirement text and extract the following information in JSON format:
            
            {
              "title": "Job title/position name",
              "client": "Client/company name",
              "city": "City name",
              "state": "State (use 2-letter code like FL, CA, or 'Remote')",
              "rate": "Pay rate (e.g., '$55/hr C2C', '$75-85/hour')",
              "interviewType": "phone|video|onsite|hybrid",
              "visaRestrictions": "Visa/sponsorship restrictions",
              "requiredSkills": ["skill1", "skill2", "skill3"],
              "description": "Detailed job description",
              "duration": "Contract duration if mentioned",
              "jobType": "onsite|remote|hybrid"
            }
            
            IMPORTANT PARSING RULES:
            1. Extract only information explicitly mentioned in the text
            2. For rates, capture the exact format used (e.g., "$55/hr C2C", "$75hr - $85/hour max")
            3. For locations, if city and state are mentioned separately, extract both
            4. For skills, extract from sections like "REQUIRED SKILLS" or "Requirements"
            5. For visa restrictions, look for phrases like "No Sponsorship", "USC/GC only", etc.
            6. For interview type, look for "Video", "Phone", "Onsite" mentions
            7. If information is not present, omit the field from the JSON
            8. For state, use standard 2-letter codes or "Remote"
            
            Job Requirement Text:
            ${requirementText}
          `
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and clean the parsed data
    const parsedData: ParsedJobData = {};
    
    if (result.title && typeof result.title === 'string') {
      parsedData.title = result.title.trim();
    }
    
    if (result.client && typeof result.client === 'string') {
      parsedData.client = result.client.trim();
    }
    
    if (result.city && typeof result.city === 'string') {
      parsedData.city = result.city.trim();
    }
    
    if (result.state && typeof result.state === 'string') {
      parsedData.state = result.state.trim();
    }
    
    if (result.rate && typeof result.rate === 'string') {
      parsedData.rate = result.rate.trim();
    }
    
    if (result.interviewType && ["phone", "video", "onsite", "hybrid"].includes(result.interviewType)) {
      parsedData.interviewType = result.interviewType;
    }
    
    if (result.visaRestrictions && typeof result.visaRestrictions === 'string') {
      parsedData.visaRestrictions = result.visaRestrictions.trim();
    }
    
    if (result.requiredSkills && Array.isArray(result.requiredSkills)) {
      parsedData.requiredSkills = result.requiredSkills
        .filter((skill: any) => typeof skill === 'string' && skill.trim().length > 0)
        .map((skill: any) => skill.trim());
    }
    
    if (result.description && typeof result.description === 'string') {
      parsedData.description = result.description.trim();
    }
    
    if (result.jobType && ["onsite", "remote", "hybrid"].includes(result.jobType)) {
      parsedData.jobType = result.jobType;
    }

    console.log("Job parsing completed successfully");
    console.log("Parsed data:", JSON.stringify(parsedData, null, 2));
    
    return parsedData;
  } catch (error) {
    console.error('Job requirement parsing error:', error);
    throw new Error('Failed to parse job requirements');
  }
}