import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface JobRequirementsResult {
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

export async function parseJobRequirementsWithAI(requirementsText: string): Promise<JobRequirementsResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured');
  }

  try {
    console.log('Starting AI-powered job requirements parsing...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert job requirements parser specializing in extracting structured information from job postings. " +
            "You excel at identifying key details like job titles, client names, locations, rates, interview types, visa restrictions, and required skills. " +
            "Extract REAL data from the job requirements - never fabricate information. " +
            "If you cannot find specific information, leave those fields empty rather than making up data. " +
            "Be precise in identifying rates (including currency and payment terms like hourly, C2C, W2). " +
            "For skills, extract specific technical skills, frameworks, tools, and certifications mentioned. " +
            "For interview types, look for mentions of phone, video, onsite, hybrid, or remote interviews. " +
            "For visa restrictions, identify any work authorization requirements like US Citizen, Green Card, H1B, etc."
        },
        {
          role: "user",
          content: 
            `I need you to parse this job requirements text and extract structured information.
            
            Job Requirements Text:
            ${requirementsText}
            
            IMPORTANT - DATA EXTRACTION INSTRUCTIONS:
            1. Carefully read the entire job requirements text
            
            2. JOB DETAILS:
               - title: The job title or position name
               - client: The company or client name
               - city: The job location city
               - state: The job location state
               - rate: The pay rate (include currency, frequency, and terms like C2C, W2)
               - description: A clean job description (remove formatting artifacts)
            
            3. REQUIREMENTS:
               - interviewType: Type of interview (phone, video, onsite, hybrid, remote)
               - visaRestrictions: Work authorization requirements (US Citizen, Green Card, H1B, etc.)
               - requiredSkills: Array of specific technical skills, tools, frameworks mentioned
            
            Please return a JSON object with the following structure:
            {
              "title": "extracted job title",
              "client": "company name",
              "city": "city name",
              "state": "state name", 
              "rate": "pay rate with terms",
              "interviewType": "interview type",
              "visaRestrictions": "work authorization requirements",
              "requiredSkills": ["skill1", "skill2", "skill3"],
              "description": "clean job description"
            }
            
            NOTICE: Extract only actual data from the job requirements. NEVER invent company names, rates, skills, etc. If you cannot find certain information, omit those fields from the response.`
        }
      ],
      temperature: 0.1, // Low temperature for consistent parsing
      max_tokens: 2000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    console.log('Raw OpenAI response:', content);
    
    // Parse the JSON response
    let analysisResult: JobRequirementsResult;
    try {
      analysisResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError);
      console.error('Raw content:', content);
      throw new Error('Invalid JSON response from AI');
    }

    console.log('Parsed job requirements result:', analysisResult);
    
    // Validate and sanitize the response
    const sanitizedResult: JobRequirementsResult = {
      title: typeof analysisResult.title === 'string' ? analysisResult.title.trim() : undefined,
      client: typeof analysisResult.client === 'string' ? analysisResult.client.trim() : undefined,
      city: typeof analysisResult.city === 'string' ? analysisResult.city.trim() : undefined,
      state: typeof analysisResult.state === 'string' ? analysisResult.state.trim() : undefined,
      rate: typeof analysisResult.rate === 'string' ? analysisResult.rate.trim() : undefined,
      interviewType: typeof analysisResult.interviewType === 'string' ? analysisResult.interviewType.trim() : undefined,
      visaRestrictions: typeof analysisResult.visaRestrictions === 'string' ? analysisResult.visaRestrictions.trim() : undefined,
      requiredSkills: Array.isArray(analysisResult.requiredSkills) 
        ? analysisResult.requiredSkills.filter(skill => typeof skill === 'string' && skill.trim().length > 0)
        : [],
      description: typeof analysisResult.description === 'string' ? analysisResult.description.trim() : undefined,
    };

    // Remove undefined fields
    Object.keys(sanitizedResult).forEach(key => {
      if (sanitizedResult[key as keyof JobRequirementsResult] === undefined) {
        delete sanitizedResult[key as keyof JobRequirementsResult];
      }
    });

    console.log('Final sanitized result:', sanitizedResult);
    return sanitizedResult;
    
  } catch (error) {
    console.error('Error in parseJobRequirementsWithAI:', error);
    throw new Error(`Failed to parse job requirements: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}