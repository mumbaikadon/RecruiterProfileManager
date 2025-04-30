import OpenAI from "openai";
import { z } from "zod";

// Create OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
}

/**
 * Analyzes resume text using OpenAI to extract key information
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  // Import the sanitization utility
  const { sanitizeHtml } = await import('./utils');
  
  // Sanitize the resume text to remove any HTML tags
  // (Double sanitization for safety)
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
      throw new Error("Empty response from OpenAI");
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
  } catch (error) {
    console.error("OpenAI resume analysis error:", error);
    throw new Error(`Failed to analyze resume: ${(error as Error).message}`);
  }
}

/**
 * A simplified matcher for job and resume to avoid timeouts
 * This can be used as a fallback if the OpenAI API times out
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
    const score = Math.min(100, Math.round((commonWordsCount / jobWords.size) * 100));
    
    return {
      score: Math.max(10, score), // Ensure minimum score of 10%
      strengths: candidateStrengths.length > 0 ? candidateStrengths : ["Generic skill match"],
      weaknesses: ["Specific technical requirements could not be identified in job description"],
      suggestions: ["Request more details about technical requirements for this role"]
    };
  }
  
  // Normal scoring based on technical skills
  let score = Math.min(100, Math.round((matchingSkills.length / jobSkillsCount) * 100));
  
  // Ensure we have a minimum score of 5% when we have actual skills to match
  score = Math.max(5, score);
  
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
 * Matches resume to job description using OpenAI
 * Falls back to simple matcher if API times out
 */
export async function matchResumeToJob(
  resumeText: string,
  jobDescription: string
): Promise<MatchScoreResult> {
  // Import the sanitization utility
  const { sanitizeHtml } = await import('./utils');
  
  // Sanitize both the resume text and job description to remove any HTML tags
  // (Double sanitization for safety)
  resumeText = sanitizeHtml(resumeText);
  jobDescription = sanitizeHtml(jobDescription);
  // Set timeout for OpenAI call
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
            content: `You are an expert at matching candidates to job descriptions with emphasis on technical skills. Analyze the resume and job description to determine:
            1. A match score from 0-100
            2. The candidate's key strengths for this role (limit to 5)
            3. Specific technologies and skills mentioned in the job description that are missing from the resume (limit to 5)
            4. Specific client projects and date ranges from the resume, and whether they provide relevant experience
            5. Suggestions for how the candidate could be positioned for this role (limit to 3)
            
            Be very specific about technologies and skills that are missing. For example, instead of saying "Missing Java experience", say "Missing experience with Java Spring Boot" or "Missing experience with Java 11 features".
            
            Return as a JSON object with the keys: score, strengths, weaknesses, suggestions, and a new key called "technicalGaps" which contains an array of specific technologies missing.`
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
      
      // Ensure we have the expected structure with new technicalGaps field
      const matchSchema = z.object({
        score: z.number().min(0).max(100),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string()),
        suggestions: z.array(z.string()),
        technicalGaps: z.array(z.string()).optional()
      });

      const validatedResult = matchSchema.parse(result);
      
      // If technicalGaps exists, add them to weaknesses with "Missing skill: " prefix
      if (validatedResult.technicalGaps && validatedResult.technicalGaps.length > 0) {
        validatedResult.weaknesses = [
          ...validatedResult.weaknesses,
          ...validatedResult.technicalGaps.map(gap => `Missing technology: ${gap}`)
        ].slice(0, 10); // Limit to 10 total weaknesses
      }

      return validatedResult;
    })();
    
    // Race between timeout and OpenAI request
    return await Promise.race([openAiPromise, timeoutPromise]);
    
  } catch (error) {
    console.error("OpenAI job matching error:", error);
    console.log("Falling back to simple matcher due to error or timeout");
    
    // Fall back to simple matcher if OpenAI times out or errors
    return simpleResumeJobMatcher(resumeText, jobDescription);
  }
}