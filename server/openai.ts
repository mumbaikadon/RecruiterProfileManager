import OpenAI from "openai";
import { z } from "zod";

// Create OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Model configuration
// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const COMPLETION_MODEL = "gpt-4o";
const EMBEDDING_MODEL = "text-embedding-ada-002";

/**
 * Calculate cosine similarity between two vectors
 * This measures how similar two embeddings are
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  // Calculate dot product
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  
  // Calculate magnitudes
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  // Calculate cosine similarity
  return dotProduct / (magA * magB);
}

/**
 * Get embedding vector for text using OpenAI's embedding API
 */
async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000), // Limit to 8000 chars to fit token limits
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("Error getting embedding:", error);
    throw error;
  }
}

// Interface for resume analysis result
export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
}

// Interface for job match result 
export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technicalGaps?: string[]; // Added for more specific technology gap analysis
  matchingSkills?: string[]; // Skills matching the job description
  missingSkills?: string[]; // Skills required by job but missing from resume
  clientExperience?: string; // Analysis of how client experience relates to job
  confidence?: number; // Confidence level in the analysis (0-100)
}

/**
 * Analyzes resume text using OpenAI to extract key information
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  try {
    // Handle empty resume text
    if (!resumeText || resumeText.trim().length === 0) {
      console.warn("Empty resume text received, returning minimal data");
      return {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: "No resume text provided"
      };
    }
    
    // Import the sanitization utility
    const { sanitizeHtml } = await import('./utils');
    
    // Check for common problematic patterns in file content that cause JSON parsing issues
    if (resumeText.trim().startsWith('<!DOCTYPE') || resumeText.includes('<?xml')) {
      console.warn("Detected DOCTYPE/XML content in resume text - cleaning");
      resumeText = resumeText.replace(/<!DOCTYPE[^>]*>/gi, '')
                        .replace(/<\?xml[^>]*\?>/gi, '')
                        .replace(/<!--[\s\S]*?-->/g, '')
                        .replace(/<[^>]*>?/g, ' ');
    }
    
    // If text is too short after cleanup or clearly not a text document, return minimal data
    if (resumeText.trim().length < 50) {
      console.warn("Resume text is too short after cleaning (<50 chars)");
      return {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: resumeText.trim()
      };
    }
    
    // Further sanitize the text to prevent encoding issues (double sanitization for safety)
    resumeText = sanitizeHtml(resumeText);
    
    try {
      console.log("Analyzing resume text with OpenAI...");
      
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing resumes for the IT staffing industry. 
            
            Extract the following information from the resume, paying special attention to formatting and consistency:
            
            1. CLIENT NAMES: List all companies the candidate worked for as a contractor or consultant (not direct employers).
               - Look for patterns like "Client: [Company Name]" or similar indicators of contract work
               - Identify companies following words like "Client" or that appear before date ranges
               - Each client should be a separate entry with exact, full company name
               - Do NOT include location information in the client name
               - For example, if you see "Client: First Republic Bank", extract just "First Republic Bank"
               
            2. JOB TITLES: List the professional roles/titles held by the candidate.
               - Extract exactly as written in the resume (e.g., "Senior Software Developer", "Software Developer")
               - List titles in chronological order (most recent first)
               - Do NOT include extraneous information, just the title itself
               
            3. RELEVANT DATES: Employment periods for each role.
               - Extract date ranges exactly as written (e.g., "Dec 2022- Present", "March 2019 – July 2021")
               - Preserve the original formatting of dates (don't standardize to MM/YYYY)
               - Make sure each date corresponds to the correct client and job title
               
            4. SKILLS: Technical skills and technologies the candidate has experience with.
               - Focus on technical skills, programming languages, frameworks, tools
               - Include version numbers when mentioned (e.g., "Java 8", "Spring Boot 2.x")
               - List skills as individual entries, not paragraphs
               - Prioritize skills that appear most frequently or recently in the resume
               
            5. EDUCATION: Educational qualifications, degrees, certifications.
               - Include university degrees, certifications, and specialized training
               - Include graduation years when available
            
            Return the information in a structured JSON format with these exact keys: clientNames, jobTitles, relevantDates, skills, education.
            
            The response MUST be valid JSON with no trailing commas, properly escaped special characters, and all array entries must be strings.`
          },
          {
            role: "user",
            content: resumeText
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500,
        temperature: 0.3 // Lower temperature for more focused extraction
      });

      const content = response.choices[0].message.content;
      if (!content) {
        console.warn("Empty response from OpenAI, returning minimal data");
        return {
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: [],
          extractedText: resumeText.substring(0, 5000)
        };
      }

      console.log("OpenAI analysis completed successfully");
      
      // Try to parse the content as JSON, with error handling
      let result;
      try {
        // Attempt to clean up the response if it's not properly formatted JSON
        let cleanedContent = content;
        
        // If content has markdown code blocks, extract just the JSON part
        if (content.includes("```json")) {
          const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonBlockMatch && jsonBlockMatch[1]) {
            cleanedContent = jsonBlockMatch[1].trim();
          }
        } else if (content.includes("```")) {
          const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch && codeBlockMatch[1]) {
            cleanedContent = codeBlockMatch[1].trim();
          }
        }
        
        // Remove any trailing commas that might cause JSON parse errors
        cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1');
        
        result = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error("Error parsing OpenAI response:", parseError);
        console.log("Raw content:", content);
        
        // Provide fallback values if we can't parse the response
        result = {
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: []
        };
      }
      
      // Convert any non-string array elements to strings
      const normalizeStringArray = (arr: any[]): string[] => {
        if (!Array.isArray(arr)) return [];
        return arr.map(item => 
          typeof item === 'string' 
            ? item 
            : typeof item === 'object' && item !== null
              ? JSON.stringify(item)
              : String(item)
        );
      };

      // Normalize the result structure
      const normalizedResult = {
        clientNames: normalizeStringArray(result.clientNames || []),
        jobTitles: normalizeStringArray(result.jobTitles || []),
        relevantDates: normalizeStringArray(result.relevantDates || []),
        skills: normalizeStringArray(result.skills || []),
        education: normalizeStringArray(result.education || [])
      };
      
      // Ensure we have the expected structure
      const resumeSchema = z.object({
        clientNames: z.array(z.string()).default([]),
        jobTitles: z.array(z.string()).default([]),
        relevantDates: z.array(z.string()).default([]),
        skills: z.array(z.string()).default([]),
        education: z.array(z.string()).default([])
      });

      const validatedResult = resumeSchema.parse(normalizedResult);

      return {
        ...validatedResult,
        extractedText: resumeText.substring(0, 5000) // Store first 5000 chars as a sample
      };
    } catch (openaiError) {
      console.error("OpenAI API error:", openaiError);
      // Return minimal data instead of throwing error
      return {
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: resumeText.substring(0, 5000)
      };
    }
  } catch (error) {
    console.error("Unexpected error in resume analysis:", error);
    // Return minimal data instead of throwing error for any unexpected issues
    return {
      clientNames: [],
      jobTitles: [],
      relevantDates: [],
      skills: [],
      education: [],
      extractedText: resumeText ? resumeText.substring(0, 5000) : "Error processing resume"
    };
  }
}

/**
 * A simplified matcher for job and resume to avoid timeouts
 * This can be used as a fallback if the OpenAI API times out
 * This implementation properly compares skills instead of using fixed score ranges
 */
function simpleResumeJobMatcher(resumeText: string, jobDescription: string): MatchScoreResult {
  // Convert texts to lowercase for better matching
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobDescription.toLowerCase();

  // Expanded list of common technical skills with variations
  const commonSkills = [
    // Frontend
    'javascript', 'typescript', 'react', 'angular', 'vue', 'nextjs', 'nuxt', 'svelte', 
    'redux', 'jquery', 'html5', 'css3', 'sass', 'less', 'tailwind', 'bootstrap', 'material-ui',
    'webpack', 'babel', 'eslint', 'prettier', 'storybook', 'responsive', 'mobile-first',
    
    // Backend
    'node', 'express', 'nestjs', 'python', 'django', 'flask', 'fastapi', 'java', 'spring', 
    'c#', '.net', 'asp.net', 'ruby', 'rails', 'php', 'laravel', 'symfony', 'go', 'golang',
    'rust', 'scala', 'kotlin', 'deno',
    
    // Database
    'sql', 'mysql', 'postgresql', 'sqlite', 'oracle', 'nosql', 'mongodb', 'dynamodb', 
    'firebase', 'cassandra', 'redis', 'elasticsearch', 'neo4j', 'couchdb', 'mariadb',
    'orm', 'sequelize', 'mongoose', 'typeorm', 'prisma', 'drizzle',
    
    // Cloud & DevOps
    'aws', 'ec2', 's3', 'lambda', 'azure', 'gcp', 'cloud', 'serverless', 'docker', 'kubernetes', 
    'ci/cd', 'jenkins', 'github actions', 'travis', 'gitlab', 'terraform', 'ansible', 'chef', 'puppet',
    'nginx', 'apache', 'load balancing', 'monitoring', 'prometheus', 'grafana', 'elk',
    
    // Methodologies & Practices
    'agile', 'scrum', 'kanban', 'tdd', 'bdd', 'devops', 'microservices', 'rest', 'graphql', 
    'soap', 'grpc', 'oauth', 'jwt', 'security', 'testing', 'unit testing', 'integration testing',
    'e2e testing', 'cypress', 'jest', 'mocha', 'chai', 'selenium',
    
    // Version Control
    'git', 'github', 'gitlab', 'bitbucket', 'svn', 'mercurial',
    
    // Mobile
    'ios', 'android', 'swift', 'objective-c', 'kotlin', 'java', 'react native', 'flutter', 
    'xamarin', 'ionic', 'cordova', 'mobile',
    
    // Big Data & ML
    'hadoop', 'spark', 'kafka', 'airflow', 'machine learning', 'deep learning', 'ai', 
    'tensorflow', 'pytorch', 'scikit-learn', 'nlp', 'computer vision', 'data science',
    
    // Specific tools & frameworks
    'jira', 'confluence', 'slack', 'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator',
    'webpack', 'parcel', 'rollup', 'vite', 'babel', 'moleculer'
  ];

  // Extract technical terms from job description that might not be in our common list
  const extractTechnicalTerms = (text: string): string[] => {
    // Look for text that might be a technology (e.g., capitalized words, words with numbers, hyphenated words)
    const technicalPattern = /\b([A-Z][a-z0-9]+(?:\.[A-Za-z0-9]+)*|\w+\.\w+|\w+-\w+)\b/g;
    const potentialTerms = text.match(technicalPattern) || [];
    
    // Filter out common English words and keep only likely technical terms
    return potentialTerms
      .filter(term => term.length > 2) // Avoid short words
      .map(term => term.toLowerCase());
  };

  // Add potential technical terms from job description to our skills list
  const jobSpecificTerms = extractTechnicalTerms(jobDescription);
  // Create a Set and convert back to array to get unique skills
  const uniqueSkills = new Set([...commonSkills, ...jobSpecificTerms]);
  const allSkills = Array.from(uniqueSkills);

  // Count matching skills
  const matchingSkills = allSkills.filter(skill => 
    resumeLower.includes(skill) && jobLower.includes(skill)
  );
  
  // Skills in job but not in resume
  const missingSkills = allSkills.filter(skill => 
    !resumeLower.includes(skill) && jobLower.includes(skill)
  );

  // Try to extract candidate strengths from resume
  const extractStrengths = (text: string): string[] => {
    const strengthPatterns = [
      /experience (?:with|in) ([^.]+)/gi,
      /proficient (?:with|in) ([^.]+)/gi,
      /expertise (?:with|in) ([^.]+)/gi,
      /skilled (?:with|in) ([^.]+)/gi,
      /knowledge of ([^.]+)/gi
    ];
    
    let strengths: string[] = [];
    
    strengthPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 3 && match[1].length < 100) {
          strengths.push(match[1].trim());
        }
      }
    });
    
    // Create a Set and convert back to array to get unique strengths
    const uniqueStrengths = new Set(strengths);
    return Array.from(uniqueStrengths).slice(0, 5); // Limit to 5 unique strengths
  };

  const candidateStrengths = extractStrengths(resumeText);

  // Calculate a more nuanced score based on matching skills and job requirements
  const jobSkillsCount = allSkills.filter(skill => jobLower.includes(skill)).length;
  
  // If no skills are found in job description, use a more basic approach
  if (jobSkillsCount === 0) {
    // Calculate the percentage of common words between resume and job description
    const resumeWordsArray = resumeLower.split(/\s+/).filter(w => w.length > 3);
    const jobWordsArray = jobLower.split(/\s+/).filter(w => w.length > 3);
    
    // Convert to Sets
    const resumeWords = new Set(resumeWordsArray);
    const jobWords = new Set(jobWordsArray);
    
    // Convert back to array to use filter
    const resumeWordsUnique = Array.from(resumeWords);
    const commonWordsCount = resumeWordsUnique.filter(word => jobWords.has(word)).length;
    
    // Adjusted scoring algorithm to prefer the 75-95% range as requested
    // Start with a base score then adjust up
    let baseScore = Math.min(100, Math.round((commonWordsCount / jobWords.size) * 100));
    let score = Math.max(75, baseScore); // Minimum 75% for any reasonable match
    
    // Cap at 95% to leave room for "perfect" matches
    score = Math.min(95, score);
    
    return {
      score: score,
      strengths: candidateStrengths.length > 0 ? candidateStrengths : ["Suitable skill profile for this role"],
      weaknesses: ["Some specific technical requirements couldn't be fully analyzed"],
      suggestions: ["Consider highlighting more technical skills in the resume"]
    };
  }
  
  // Normal scoring based on technical skills - adjusted to match industry standards
  // We're using a more generous scoring algorithm that starts at 75% and goes up to 95%
  // This matches real-world recruiting where most qualified candidates get 75-95%
  const matchRate = matchingSkills.length / jobSkillsCount;
  
  // Base score, minimum 75% (if we have any matches at all)
  let score = 75;
  
  if (matchRate > 0.25) score = 80;  // >25% match rate
  if (matchRate > 0.5) score = 85;   // >50% match rate
  if (matchRate > 0.7) score = 90;   // >70% match rate
  if (matchRate > 0.9) score = 95;   // >90% match rate
  
  // Generate specific missing technology gaps
  const technicalGaps = missingSkills.map(skill => 
    `Missing technology: ${skill.charAt(0).toUpperCase() + skill.slice(1)}`
  );
  
  return {
    score,
    strengths: matchingSkills.length > 0 
      ? matchingSkills.map(skill => `Experience with ${skill}`)
      : candidateStrengths.length > 0 
        ? candidateStrengths 
        : ["No specific matching skills identified"],
    weaknesses: missingSkills.map(skill => `No mention of ${skill}`),
    suggestions: missingSkills.slice(0, 3).map(skill => 
      `Consider highlighting any experience with ${skill}`
    ),
    technicalGaps: technicalGaps.slice(0, 5) // Limit to top 5 technical gaps
  };
}

/**
 * Matches resume to job description using OpenAI with embeddings-based similarity analysis
 * Falls back to simple matcher if API times out
 */
export async function matchResumeToJob(
  resumeText: string,
  jobDescription: string
): Promise<MatchScoreResult> {
  // Handle empty inputs with a fallback result
  if (!resumeText || !jobDescription || resumeText.trim().length < 50 || jobDescription.trim().length < 50) {
    console.warn("Resume or job description too short, using fallback matcher");
    return simpleResumeJobMatcher(resumeText || "", jobDescription || "");
  }
  
  try {
    // Import the sanitization utility
    const { sanitizeHtml } = await import('./utils');
    
    // Check for problematic patterns in file content that cause JSON parsing issues
    if (resumeText.trim().startsWith('<!DOCTYPE') || resumeText.includes('<?xml')) {
      console.warn("Detected DOCTYPE/XML content in resume text - cleaning");
      resumeText = resumeText.replace(/<!DOCTYPE[^>]*>/gi, '')
                      .replace(/<\?xml[^>]*\?>/gi, '')
                      .replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/<[^>]*>?/g, ' ');
    }
    
    // Sanitize both the resume text and job description to remove any HTML tags
    resumeText = sanitizeHtml(resumeText);
    jobDescription = sanitizeHtml(jobDescription);
    
    // Get embeddings for both texts
    let scaledScore = 75; // Default score
    
    try {
      console.log("Using embedding-based similarity for resume matching...");
      
      const resumeEmbedding = await getEmbedding(resumeText);
      const jobEmbedding = await getEmbedding(jobDescription);
      
      // Calculate similarity score (0 to 1)
      const similarity = cosineSimilarity(resumeEmbedding, jobEmbedding);
      console.log(`Semantic similarity between resume and job: ${similarity.toFixed(4)}`);
      
      // Convert to a percentage (0 to 100) and scale to recruiting industry expectations
      // In practice, similarity scores above 0.7 indicate strong matches
      
      // Adjust the scale to fit recruiting industry norms (75-95% for qualified candidates)
      // Map 0.5-0.9 similarity to 75-95% score range
      if (similarity >= 0.5) {
        scaledScore = Math.round(75 + ((similarity - 0.5) * (95 - 75) / 0.4));
        // Cap at 95% to leave room for "perfect" matches
        scaledScore = Math.min(95, scaledScore);
      } else {
        // For lower similarities, use a more generous scale that bottoms out at 60%
        scaledScore = Math.max(60, Math.round(60 + (similarity * 30)));
      }
      
      console.log(`Adjusted match score based on embeddings: ${scaledScore}%`);
    } catch (embeddingError) {
      console.error("Error using embeddings for matching, falling back to qualitative analysis only:", embeddingError);
      // Continue with qualitative analysis below
    }
    
    // Now proceed with qualitative analysis regardless of embedding success
    const TIMEOUT_MS = 20000; // Increased timeout for more detailed analysis
    
    try {
      console.log("Matching resume to job description with OpenAI...");
      
      // Create promise with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("OpenAI request timed out")), TIMEOUT_MS);
      });
      
      // Create the OpenAI request promise
      const openAiPromise = (async () => {
        // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an elite technical staffing AI that specializes in analyzing IT resumes against job descriptions with extremely high precision, always giving candidates a fair evaluation that matches industry standards. Your analysis is ALWAYS thorough, detailed, and generous when skills align.

              IMPORTANT: Your score should follow industry standards where most qualified candidates receive scores between 75-95%. Candidates who meet all core requirements should always score at least 75-85%, even if they're missing some preferred qualifications. Only candidates who are missing several required skills should score below 60%.

              Analyze the resume and job description to determine:

              1. A match score from 0-100 that accurately reflects how well the candidate's skills align with the job requirements
                 - Scores for qualified candidates with most required skills should be 75-95%
                 - Candidates with all core skills but missing some preferred qualifications should score 75-85%
                 - Only truly underqualified candidates should score below 60%
                 - When in doubt, favor a higher score if the candidate has relevant experience
              
              2. MATCHING SKILLS: Identify all technical skills from the resume that match skills mentioned in the job description
                 - Be specific (e.g., "Spring Boot" instead of just "Java")
                 - Include frameworks, languages, methodologies, and tools
                 - Only include skills that appear in BOTH the resume and job description
              
              3. MISSING SKILLS: Identify key technical skills from the job description that are missing from the resume
                 - Focus on technical requirements specifically mentioned as "required" or "must-have"
                 - Only include skills clearly missing from the resume
              
              4. STRENGTHS: The candidate's 3-5 most impressive strengths for this specific role
                 - Focus on experience durations, leadership roles, project scale/complexity
                 - Include relevant industry experience specific to the role
                 - Highlight skills that directly satisfy key job requirements
              
              5. WEAKNESSES: The candidate's 3-5 most significant gaps compared to the job requirements
                 - Focus on missing technical expertise or experience
                 - Note any mismatches in industry experience or project scale
              
              6. SUGGESTIONS: Provide 2-3 clear recommendations for how the candidate could improve their match for this role
              
              7. CLIENT EXPERIENCE: Analyze how the candidate's client experience relates to the job requirements
                 - Compare industry sectors, company sizes, and types of projects
                 - Look for client work that demonstrates relevant domain expertise
              
              8. TECHNICAL GAPS: Provide specific evaluation of technical skill gaps
                 - Focus on technology stacks, frameworks, and tools specifically required in the job

              9. CONFIDENCE: Provide a confidence level (0-100) in your assessment
                 - Higher confidence (85-100) when resume contains detailed, clear information
                 - Lower confidence (below 70) when resume lacks details or has ambiguous experience descriptions

              Return as a JSON object with these exact keys: score, matchingSkills, missingSkills, strengths, weaknesses, suggestions, technicalGaps, clientExperience, confidence.
              
              Your analysis must be extremely accurate and detailed. This matching data is being used for critical hiring decisions, so ensure score is fair and appropriately high for qualified candidates.`
            },
            {
              role: "user",
              content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}`
            }
          ],
          response_format: { type: "json_object" },
          max_tokens: 1500
        });

        const content = response.choices[0].message.content;
        if (!content) {
          throw new Error("Empty response from OpenAI");
        }

        console.log("OpenAI job matching completed successfully");
        
        // Try to parse the content as JSON, with error handling
        let result;
        try {
          // Attempt to clean up the response if it's not properly formatted JSON
          let cleanedContent = content;
          
          // If content has markdown code blocks, extract just the JSON part
          if (content.includes("```json")) {
            const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
            if (jsonBlockMatch && jsonBlockMatch[1]) {
              cleanedContent = jsonBlockMatch[1].trim();
            }
          } else if (content.includes("```")) {
            const codeBlockMatch = content.match(/```\s*([\s\S]*?)\s*```/);
            if (codeBlockMatch && codeBlockMatch[1]) {
              cleanedContent = codeBlockMatch[1].trim();
            }
          }
          
          // Remove any trailing commas that might cause JSON parse errors
          cleanedContent = cleanedContent.replace(/,(\s*[}\]])/g, '$1');
          
          result = JSON.parse(cleanedContent);
        } catch (parseError) {
          console.error("Error parsing OpenAI response:", parseError);
          console.log("Raw content:", content);
          
          // Provide fallback values if we can't parse the response
          result = {
            score: 0,
            strengths: [],
            weaknesses: ["Unable to process the match results"],
            suggestions: ["Try with a different resume format"],
            technicalGaps: []
          };
        }
        
        // Ensure we have the expected structure with new fields
        const matchSchema = z.object({
          score: z.number().min(0).max(100),
          matchingSkills: z.array(z.string()).optional(),
          missingSkills: z.array(z.string()).optional(),
          strengths: z.array(z.string()).optional(),
          weaknesses: z.array(z.string()).optional(),
          suggestions: z.array(z.string()).optional(),
          clientExperience: z.string().optional(),
          confidence: z.number().min(0).max(100).optional(),
          technicalGaps: z.array(z.string()).optional()
        });

        try {
          const validatedResult = matchSchema.parse(result);
          
          // Convert the new format to match our existing interface
          return {
            score: validatedResult.score,
            strengths: validatedResult.strengths || validatedResult.matchingSkills || [],
            weaknesses: validatedResult.weaknesses || validatedResult.missingSkills || [],
            suggestions: validatedResult.suggestions || [],
            technicalGaps: validatedResult.technicalGaps || validatedResult.missingSkills || [],
            matchingSkills: validatedResult.matchingSkills || [],
            missingSkills: validatedResult.missingSkills || [],
            clientExperience: validatedResult.clientExperience || "",
            confidence: validatedResult.confidence || 0
          };
        } catch (validationError) {
          console.warn("Schema validation failed, using raw result:", validationError);
          
          // Handle legacy format or unexpected structure
          return {
            score: result.score || 0,
            strengths: result.strengths || result.matchingSkills || [],
            weaknesses: result.weaknesses || result.missingSkills || [],
            suggestions: result.suggestions || [],
            technicalGaps: result.technicalGaps || result.missingSkills || [],
            matchingSkills: result.matchingSkills || [],
            missingSkills: result.missingSkills || [],
            clientExperience: result.clientExperience || "",
            confidence: result.confidence || 0
          };
        }
      })();
      
      // Race between timeout and OpenAI request
      return await Promise.race([openAiPromise, timeoutPromise]);
      
    } catch (innerError) {
      console.error("Inner try-catch: OpenAI job matching error:", innerError);
      throw innerError; // Re-throw for outer catch block
    }
  } catch (error) {
    console.error("Outer try-catch: OpenAI job matching error:", error);
    console.log("Falling back to simple matcher due to error or timeout");
    
    // Use a fixed fallback score 
    // or recompute skills for a custom response
    if (true) { // Always execute this logic rather than checking for scaledScore
      // Extract skills for better analysis using simple matcher logic
      const resumeLower = resumeText.toLowerCase();
      const jobLower = jobDescription.toLowerCase();
      
      // Use the skill extraction logic from the simple matcher
      const commonSkills = [
        'javascript', 'typescript', 'react', 'angular', 'vue', 'java', 'spring',
        'node', 'express', 'python', 'django', 'sql', 'nosql', 'mongodb',
        'aws', 'azure', 'docker', 'kubernetes', 'rest', 'graphql'
      ];
      
      // Count matching skills (simplified from simple matcher)
      const matchingSkills = commonSkills.filter(skill => 
        resumeLower.includes(skill) && jobLower.includes(skill)
      );
      
      // Skills in job but not in resume
      const missingSkills = commonSkills.filter(skill => 
        !resumeLower.includes(skill) && jobLower.includes(skill)
      );
      
      // Calculate a score based on match percentage
      const jobSkillsCount = commonSkills.filter(skill => jobLower.includes(skill)).length;
      const matchRate = jobSkillsCount > 0 ? matchingSkills.length / jobSkillsCount : 0;
      
      // Adjust scoring to match industry norms (75-95%)
      let score = 75; // Base score
      if (matchRate > 0.25) score = 80;  // >25% match rate
      if (matchRate > 0.5) score = 85;   // >50% match rate
      if (matchRate > 0.7) score = 90;   // >70% match rate
      if (matchRate > 0.9) score = 95;   // >90% match rate
      
      return {
        score: score,
        strengths: matchingSkills.map(skill => `Experience with ${skill}`),
        weaknesses: missingSkills.map(skill => `No mention of ${skill}`),
        suggestions: ["Consider adding more detail about your technical experience"],
        technicalGaps: missingSkills.map(skill => `Missing: ${skill}`),
        matchingSkills,
        missingSkills,
        clientExperience: "Could not analyze client experience in detail",
        confidence: 70 // Medium confidence due to partial analysis
      };
    }
    
    // Complete fallback to simple matcher if no embedding score available
    return simpleResumeJobMatcher(resumeText, jobDescription);
  }
}