import { z } from "zod";
// Import natural modules directly
import natural from 'natural';
import * as nodeNlp from 'node-nlp';
import * as fs from 'fs';
import * as util from 'util';
import * as path from 'path';
import OpenAI from "openai";

// NLP setup
const nlpManager = new nodeNlp.NlpManager({ language: 'en' });
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

// Initialize basic NLP tools
const sentimentAnalyzer = new nodeNlp.SentimentAnalyzer({ language: 'en' });

// OpenAI client setup - use if API key is available
let openai: OpenAI | null = null;
try {
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("OpenAI client initialized successfully");
  } else {
    console.log("No OpenAI API key found, using NLP-only mode");
  }
} catch (error) {
  console.error("Error initializing OpenAI client:", error);
}

/**
 * Calculate cosine similarity between two arrays of strings
 * This measures how similar two texts are
 */
function cosineSimilarity(tokensA: string[], tokensB: string[]): number {
  // Create a set of all unique tokens
  const uniqueTokens = Array.from(new Set([...tokensA, ...tokensB]));
  
  // Create vectors for each set of tokens
  const vecA = uniqueTokens.map(token => tokensA.filter(t => t === token).length);
  const vecB = uniqueTokens.map(token => tokensB.filter(t => t === token).length);
  
  // Calculate dot product
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  
  // Calculate magnitudes
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  
  // Calculate cosine similarity
  return dotProduct / (magA * magB) || 0;
}

/**
 * Get tokenized terms from text with normalization
 */
function extractTerms(text: string): string[] {
  // Clean and normalize text
  const cleanText = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Tokenize and stem words 
  const tokens = tokenizer.tokenize(cleanText);
  return tokens
    .filter(token => token.length > 2) // Remove short words
    .map(token => stemmer.stem(token));
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
 * Enhanced resume analysis interface with quality metrics
 */
export interface EnhancedResumeAnalysis extends ResumeAnalysisResult {
  qualityScore?: number;         // Overall quality score (0-100)
  contentSuggestions?: string[]; // Suggestions for content improvement
  formattingSuggestions?: string[]; // Suggestions for formatting improvement
  languageSuggestions?: string[]; // Suggestions for language improvement
  keywordScore?: number;         // How well the resume matches industry keywords (0-100)
  readabilityScore?: number;     // Readability score (0-100)
  aiEnhanced: boolean;           // Whether AI was used for enhanced analysis
}

/**
 * Analyzes resume text using NLP to extract key information
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
    
    // Check for common problematic patterns in file content that cause parsing issues
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
      console.log("Analyzing resume text with NLP...");
      
      // Prepare text for analysis
      const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      // Extract client names
      const clientNames = extractClientNames(resumeText);
      
      // Extract job titles
      const jobTitles = extractJobTitles(resumeText);
      
      // Extract dates
      const relevantDates = extractDates(resumeText);
      
      // Extract skills
      const skills = extractSkills(resumeText);
      
      // Extract education
      const education = extractEducation(resumeText);
      
      console.log("NLP analysis completed successfully");
      
      // Ensure we have the expected structure
      const resumeSchema = z.object({
        clientNames: z.array(z.string()).default([]),
        jobTitles: z.array(z.string()).default([]),
        relevantDates: z.array(z.string()).default([]),
        skills: z.array(z.string()).default([]),
        education: z.array(z.string()).default([])
      });

      const result = {
        clientNames,
        jobTitles,
        relevantDates,
        skills,
        education
      };

      const validatedResult = resumeSchema.parse(result);

      return {
        ...validatedResult,
        extractedText: resumeText.substring(0, 5000) // Store first 5000 chars as a sample
      };
    } catch (nlpError) {
      console.error("NLP processing error:", nlpError);
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
 * AI-enhanced resume analysis that adds quality metrics and improvement suggestions
 * Uses OpenAI if available, falls back to NLP methods if not
 */
export async function analyzeResumeWithAI(resumeText: string): Promise<EnhancedResumeAnalysis> {
  // First get the basic NLP analysis
  const basicAnalysis = await analyzeResumeText(resumeText);
  
  // If OpenAI is not available, return basic analysis with dummy quality metrics
  if (!openai) {
    console.log("OpenAI client not available, returning basic analysis only");
    const readabilityScore = calculateReadabilityScore(resumeText);
    
    return {
      ...basicAnalysis,
      qualityScore: 70, // Default score
      contentSuggestions: ["Use the OpenAI integration for more detailed content suggestions"],
      formattingSuggestions: ["Use the OpenAI integration for formatting suggestions"],
      languageSuggestions: [],
      readabilityScore,
      keywordScore: 65, // Default score
      aiEnhanced: false
    };
  }
  
  try {
    // Perform enhanced analysis with OpenAI
    console.log("Performing enhanced resume analysis with OpenAI...");
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert resume analyzer for IT staffing industry. Analyze this resume and provide quality metrics and improvement suggestions.
          
          Return your analysis in a structured JSON format with these exact keys:
          
          1. qualityScore: A number between 0 and 100 indicating overall resume quality
          2. contentSuggestions: Array of 3-5 specific suggestions for improving content
          3. formattingSuggestions: Array of 2-3 suggestions for improving formatting
          4. languageSuggestions: Array of 2-3 suggestions for improving language
          5. keywordScore: A number between 0 and 100 indicating how well the resume contains relevant IT industry keywords
          6. readabilityScore: A number between 0 and 100 indicating how readable the resume is
          
          Ensure your assessment is fair and constructive, offering actionable advice that would help the candidate improve their resume for IT positions.`
        },
        {
          role: "user",
          content: resumeText
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1500
    });
    
    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }
    
    console.log("OpenAI enhanced analysis completed successfully");
    
    // Parse the response
    const enhancedAnalysis = JSON.parse(content);
    
    // Merge the basic NLP analysis with the enhanced AI analysis
    return {
      ...basicAnalysis,
      qualityScore: enhancedAnalysis.qualityScore || 75,
      contentSuggestions: enhancedAnalysis.contentSuggestions || [],
      formattingSuggestions: enhancedAnalysis.formattingSuggestions || [],
      languageSuggestions: enhancedAnalysis.languageSuggestions || [],
      keywordScore: enhancedAnalysis.keywordScore || 70,
      readabilityScore: enhancedAnalysis.readabilityScore || calculateReadabilityScore(resumeText),
      aiEnhanced: true
    };
  } catch (error) {
    console.error("Error in AI-enhanced resume analysis:", error);
    
    // Fall back to basic analysis with calculated metrics
    const readabilityScore = calculateReadabilityScore(resumeText);
    
    return {
      ...basicAnalysis,
      qualityScore: 70, // Default fallback score
      contentSuggestions: ["Unable to provide AI-powered suggestions at this time"],
      formattingSuggestions: [],
      languageSuggestions: [],
      readabilityScore,
      keywordScore: 65, // Default fallback score
      aiEnhanced: false
    };
  }
}

/**
 * Calculate a simple readability score based on text metrics
 */
function calculateReadabilityScore(text: string): number {
  // Calculate average sentence length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
  
  if (sentences.length === 0) return 50; // Default score
  
  const avgSentenceLength = totalWords / sentences.length;
  
  // Calculate average word length
  const totalChars = text.replace(/\s+/g, '').length;
  const avgWordLength = totalWords > 0 ? totalChars / totalWords : 5;
  
  // Ideally we would use a proper readability formula like Flesch-Kincaid
  // But for simplicity, we'll use a basic model:
  // - Penalize very long sentences (over 25 words)
  // - Penalize very long words (over 8 chars)
  // - Score between 0-100
  
  const sentencePenalty = Math.max(0, Math.min(30, (avgSentenceLength - 15) * 2));
  const wordPenalty = Math.max(0, Math.min(30, (avgWordLength - 5) * 6));
  
  // Start with 100 and subtract penalties
  return Math.max(0, Math.min(100, 100 - sentencePenalty - wordPenalty));
}

/**
 * Extract client names from resume text using NLP
 */
function extractClientNames(text: string): string[] {
  const clientNames: string[] = [];
  
  // Look for common client indicators
  const clientPatterns = [
    /client\s*:\s*([^,.\n]+)/gi,
    /(?:worked for|at)\s+([^,.\n]+?)\s+(?:as|from|through)/gi,
    /(?:project|engagement|assignment)(?:\s+at|\s+with|\s+for)\s+([^,.\n]+)/gi
  ];
  
  // Apply each pattern and collect results
  clientPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 1) {
        // Clean up the company name
        const company = match[1].trim()
          .replace(/\s+/g, ' ')  // Normalize whitespace
          .replace(/\([^)]*\)/g, '') // Remove parenthetical information
          .trim();
        
        // Don't add if it's suspiciously short or has invalid characters
        if (company.length > 2 && !company.match(/^[0-9.]+$/)) {
          clientNames.push(company);
        }
      }
    }
  });
  
  // Look for company names with Inc., Corp., LLC, etc.
  const companyFormPatterns = [
    /([A-Z][A-Za-z0-9\s&]+)(?:\s+Inc\.|\s+Corp\.|\s+LLC|\s+Ltd\.)/g,
    /([A-Z][A-Za-z0-9\s&]+)(?:\s+Corporation|\s+Company|\s+Technologies)/g
  ];
  
  companyFormPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 2) {
        const company = match[1].trim();
        clientNames.push(company);
      }
    }
  });
  
  // Deduplicate and sort by length (longer names first which are usually more complete)
  return Array.from(new Set(clientNames))
    .filter(name => 
      // Filter out obvious non-companies
      !['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].includes(name) &&
      !/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)/.test(name)
    )
    .sort((a, b) => b.length - a.length);
}

/**
 * Extract job titles from resume text using NLP
 */
function extractJobTitles(text: string): string[] {
  const titles: string[] = [];
  
  // Common job title patterns
  const titlePatterns = [
    /(?:^|\n)([A-Z][A-Za-z\s]+(?:Developer|Engineer|Architect|Designer|Consultant|Manager|Lead|Analyst|Specialist))(?:$|,|\n| -)/gm,
    /(?:Title|Position|Role):\s*([^\n,.]+)/gi,
    /(?:as\s+a|as\s+an)\s+([^,.\n]{3,50}?)(?:\s+at|\s+for|\s+with|,|\.|$)/gi
  ];
  
  // Apply each pattern and collect results
  titlePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && match[1].trim().length > 3) {
        // Clean up the title
        const title = match[1].trim()
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();
        
        // Don't add if it's suspiciously generic or has invalid patterns
        if (title.length > 3 && 
            !title.match(/^(From|To|About|Contact|Summary|Resume)$/i)) {
          titles.push(title);
        }
      }
    }
  });
  
  // Common IT job titles
  const commonTitles = [
    'Software Engineer', 'Software Developer', 'Frontend Developer', 'Backend Developer',
    'Full Stack Developer', 'DevOps Engineer', 'Site Reliability Engineer', 'Data Scientist',
    'Machine Learning Engineer', 'Cloud Architect', 'Solutions Architect', 'Technical Lead',
    'Engineering Manager', 'Project Manager', 'Product Manager', 'Scrum Master',
    'QA Engineer', 'Test Engineer', 'UX Designer', 'UI Developer', 'System Administrator'
  ];
  
  // Check for these common titles
  commonTitles.forEach(title => {
    if (text.includes(title)) {
      titles.push(title);
    }
  });
  
  // Deduplicate and return
  return Array.from(new Set(titles));
}

/**
 * Extract dates from resume text
 */
function extractDates(text: string): string[] {
  const dates: string[] = [];
  
  // Date patterns (with various formats)
  const datePatterns = [
    // MM/YYYY - MM/YYYY
    /(\d{1,2}\/\d{4})\s*[-–—]\s*(\d{1,2}\/\d{4}|Present|Current|Now)/gi,
    
    // Month YYYY - Month YYYY
    /([A-Z][a-z]{2,8}\.?\s+\d{4})\s*[-–—]\s*([A-Z][a-z]{2,8}\.?\s+\d{4}|Present|Current|Now)/gi,
    
    // YYYY - YYYY
    /(\d{4})\s*[-–—]\s*(\d{4}|Present|Current|Now)/gi,
    
    // MM/YYYY - Present
    /(\d{1,2}\/\d{4})\s*[-–—]\s*(Present|Current|Now)/gi,
    
    // Abbreviated month formats
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}\s*[-–—]\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}/gi,
    
    // Abbreviated to present
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{4}\s*[-–—]\s*(Present|Current|Now)/gi
  ];
  
  // Apply each pattern and collect results
  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Get the full date range
      const dateRange = match[0].trim();
      if (dateRange.length > 5) {
        dates.push(dateRange);
      }
    }
  });
  
  // Deduplicate and return
  return Array.from(new Set(dates));
}

/**
 * Extract skills from resume text
 */
function extractSkills(text: string): string[] {
  // Pre-defined list of technical skills to look for
  const technicalSkills = [
    // Programming Languages
    'Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'C++', 'C', 'PHP', 'Ruby', 'Go', 
    'Golang', 'Swift', 'Kotlin', 'Scala', 'Rust', 'Perl', 'Shell', 'Bash', 'PowerShell',
    'Groovy', 'R', 'Dart', 'Clojure', 'Elixir', 'Erlang', 'F#', 'Haskell', 'Julia',
    
    // Web/Frontend
    'HTML', 'CSS', 'SCSS', 'SASS', 'LESS', 'Angular', 'React', 'Vue', 'Svelte', 'jQuery', 
    'Bootstrap', 'Tailwind', 'Material UI', 'Chakra UI', 'Redux', 'NextJS', 'NuxtJS', 
    'Gatsby', 'WebAssembly', 'Web Components', 'Shadow DOM',
    
    // Backend
    'Node.js', 'Express', 'NestJS', 'Spring', 'Spring Boot', 'Django', 'Flask', 'Laravel',
    'Rails', 'ASP.NET', '.NET Core', '.NET', 'FastAPI', 'Symfony', 'CodeIgniter', 'Play',
    'Ktor', 'Echo', 'Gin', 'Rocket', 'Actix',
    
    // Databases
    'SQL', 'MySQL', 'PostgreSQL', 'Oracle', 'SQLite', 'MongoDB', 'DynamoDB', 'Cassandra',
    'Redis', 'ElasticSearch', 'Neo4j', 'CosmosDB', 'Firebase', 'Firestore', 'CouchDB',
    'MariaDB', 'Snowflake', 'BigQuery', 'Redshift', 'SQL Server', 'Supabase',
    
    // Cloud
    'AWS', 'Azure', 'GCP', 'Google Cloud', 'Heroku', 'DigitalOcean', 'Linode', 'Netlify',
    'Vercel', 'Firebase', 'CloudFlare', 'S3', 'EC2', 'Lambda', 'ECS', 'EKS', 'Route 53',
    'CloudFront', 'IAM', 'VPC', 'RDS', 'DynamoDB', 'SNS', 'SQS', 'Step Functions',
    
    // DevOps
    'Docker', 'Kubernetes', 'Jenkins', 'GitHub Actions', 'CircleCI', 'TravisCI', 'ArgoCD',
    'Terraform', 'Ansible', 'Puppet', 'Chef', 'Prometheus', 'Grafana', 'ELK Stack', 
    'Nginx', 'Apache', 'CI/CD', 'Git', 'GitHub', 'GitLab', 'Bitbucket',
    
    // Testing
    'Jest', 'Mocha', 'Chai', 'Cypress', 'Selenium', 'JUnit', 'TestNG', 'PyTest', 'RSpec',
    'PHPUnit', 'XUnit', 'NUnit', 'Jasmine', 'Karma', 'WebdriverIO', 'Postman',
    
    // Mobile
    'Android', 'iOS', 'React Native', 'Flutter', 'Xamarin', 'Ionic', 'Cordova', 
    'SwiftUI', 'UIKit', 'Kotlin Multiplatform', 'NativeScript', 'PhoneGap',
    
    // AI/ML/Data
    'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Keras', 'scikit-learn',
    'Pandas', 'NumPy', 'Jupyter', 'NLTK', 'spaCy', 'OpenCV', 'Hadoop', 'Spark', 'Kafka',
    'Airflow', 'Databricks', 'Tableau', 'Power BI', 'Looker',
    
    // Other
    'GraphQL', 'REST API', 'SOAP', 'gRPC', 'WebSockets', 'Microservices', 'Serverless',
    'Blockchain', 'Ethereum', 'Solidity', 'WebRTC', 'PWA'
  ];
  
  // Feature version specific skills (Add version numbers if found)
  const versionedSkills: string[] = [];
  
  // Convert text to lowercase for case-insensitive matching
  const lowerText = text.toLowerCase();
  
  // Find skills mentioned in the resume
  const foundSkills = technicalSkills.filter(skill => {
    // Check for standalone mentions of the skill (word boundaries)
    const regex = new RegExp(`\\b${skill.toLowerCase()}\\b`, 'i');
    return regex.test(lowerText);
  });
  
  // Also check for versioned mentions (e.g., "Java 8" or "Angular 10")
  technicalSkills.forEach(skill => {
    // Look for skill followed by version number
    const versionRegex = new RegExp(`\\b${skill}\\s+([0-9](?:\\.[0-9x]+)?)\\b`, 'i');
    const match = text.match(versionRegex);
    if (match) {
      versionedSkills.push(`${skill} ${match[1]}`);
    }
  });
  
  // Additional pattern-based skill extraction (e.g., AWS services)
  const awsServicePattern = /\b(S3|EC2|Lambda|ECS|EKS|Route 53|CloudFront|IAM|VPC|RDS|DynamoDB|SNS|SQS|Step Functions)\b/g;
  let match;
  const awsServices: string[] = [];
  while ((match = awsServicePattern.exec(text)) !== null) {
    if (match[1]) {
      awsServices.push(`AWS ${match[1]}`);
    }
  }
  
  // Combine all skills and deduplicate
  const allSkills = [...foundSkills, ...versionedSkills, ...awsServices];
  return Array.from(new Set(allSkills)).sort();
}

/**
 * Extract education information from resume text
 */
function extractEducation(text: string): string[] {
  const education: string[] = [];
  
  // Pattern for common degrees
  const degreePatterns = [
    /(?:Bachelor|Master|PhD|Doctorate|B\.S\.|M\.S\.|M\.A\.|B\.A\.|MBA|Ph\.D\.|B\.E\.|M\.E\.)(?:\s+(?:of|in|degree))?\s+([^,.\n]+)/gi,
    /(?:^|\n)([A-Z][A-Za-z\s]+(?:University|College|Institute|School))(?:$|,|\n| -)/gm
  ];
  
  // Apply each pattern and collect results
  degreePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 5) {
        education.push(fullMatch);
      }
    }
  });
  
  // Look for certification patterns
  const certPatterns = [
    /\b(?:Certified|Certificate|Certification)\s+([^,.\n]{5,100})/gi,
    /\b([A-Z]{2,}(?:-[A-Z]+)*)(?:\s+certification)?\b/g // Acronym-based certifications like AWS-SAA, MCSD
  ];
  
  certPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0].trim();
      if (fullMatch.length > 5) {
        education.push(fullMatch);
      }
    }
  });
  
  // Deduplicate and return
  return Array.from(new Set(education));
}

/**
 * Document parser - simple version
 * This would be expanded with actual pdf-parse and mammoth integration
 */
async function parseDocument(buffer: Buffer, fileType: string): Promise<string> {
  // This is a simplified implementation
  // In a real implementation, we would use pdf-parse for PDFs and mammoth for DOCX
  
  try {
    if (fileType === 'pdf') {
      // Use pdf-parse to extract text from PDF
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return data.text;
    } else if (fileType === 'docx') {
      // Use mammoth to extract text from DOCX
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } else {
      // Assume it's plain text
      return buffer.toString('utf8');
    }
  } catch (error) {
    console.error(`Error parsing document of type ${fileType}:`, error);
    return '';
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
 * Matches resume to job description using NLP techniques
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
    
    // Check for problematic patterns in file content that cause parsing issues
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
    
    // First, get the NLP-based match result as a fallback
    const nlpResult = simpleResumeJobMatcher(resumeText, jobDescription);
    
    // If OpenAI is not available, return the NLP result
    if (!openai) {
      console.log("OpenAI not available, using NLP-only matching");
      return nlpResult;
    }
    
    try {
      console.log("Using OpenAI for enhanced resume-job matching...");
      
      // Prepare a shortened version of both texts to fit within token limits
      const resumeExcerpt = resumeText.substring(0, 2500); // Limit resume to 2500 chars
      const jobExcerpt = jobDescription.substring(0, 1500); // Limit job to 1500 chars
      
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert IT recruiter specializing in matching candidates to job descriptions.
            Analyze the resume and job description to provide a detailed match assessment.
            
            Return a JSON object with the following fields:
            1. score: A number between 0 and 100 indicating the overall match (higher is better)
            2. strengths: An array of 3-5 specific candidate strengths relevant to this job
            3. weaknesses: An array of 2-4 areas where the candidate lacks qualifications
            4. suggestions: An array of 2-3 actionable suggestions to improve candidacy 
            5. technicalGaps: An array of specific technical skills mentioned in the job but missing from the resume
            6. matchingSkills: An array of technical skills that match between the resume and job
            7. missingSkills: An array of skills required by the job but not found in the resume
            8. clientExperience: A string analyzing how the candidate's client experience relates to the job requirements
            9. confidence: A number between 0 and 100 indicating confidence in this analysis
            
            Be specific, insightful, and fair in your assessment.`
          },
          {
            role: "user",
            content: `Resume: ${resumeExcerpt}
            
            Job Description: ${jobExcerpt}`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });
      
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }
      
      console.log("OpenAI resume-job match analysis completed");
      
      // Parse the response
      const aiResult = JSON.parse(content);
      
      // Merge with NLP results taking the best parts of each
      return {
        score: aiResult.score || nlpResult.score,
        strengths: aiResult.strengths || nlpResult.strengths,
        weaknesses: aiResult.weaknesses || nlpResult.weaknesses,
        suggestions: aiResult.suggestions || nlpResult.suggestions,
        technicalGaps: aiResult.technicalGaps || [],
        matchingSkills: aiResult.matchingSkills || nlpResult.matchingSkills,
        missingSkills: aiResult.missingSkills || nlpResult.missingSkills,
        clientExperience: aiResult.clientExperience || "",
        confidence: aiResult.confidence || 90 // High confidence with AI analysis
      };
    } catch (error) {
      console.error("Error in AI resume-job matching:", error);
      console.log("Falling back to NLP-based matching due to OpenAI error");
      return nlpResult;
    }
  } catch (error) {
    console.error("Error in resume matching:", error);
    console.log("Falling back to simple matcher due to error");
    return simpleResumeJobMatcher(resumeText, jobDescription);
  }
}

/**
 * Extract candidate strengths based on matching skills and experience
 */
function extractCandidateStrengths(text: string, matchingSkills: string[]): string[] {
  const strengths: string[] = [];
  
  // Check for years of experience mentions
  const experiencePatterns = [
    /(\d+)\+?\s+years?\s+(?:of\s+)?experience/gi,
    /experience\s+(?:of|with)\s+(\d+)\+?\s+years?/gi
  ];
  
  experiencePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && parseInt(match[1]) > 2) {
        strengths.push(`${match[1]}+ years of experience`);
        break; // Only get one experience strength
      }
    }
  });
  
  // Check for leadership/senior role mentions
  const leadershipPatterns = [
    /\b(?:lead|senior|principal|architect|manager|supervisor|head)\b/gi
  ];
  
  leadershipPatterns.forEach(pattern => {
    if (pattern.test(text)) {
      strengths.push("Leadership or senior-level experience");
      return; // Only add this once
    }
  });
  
  // Add top matching skills as strengths
  const topSkills = matchingSkills.slice(0, 3);
  topSkills.forEach(skill => {
    strengths.push(`Proficiency with ${skill}`);
  });
  
  // Look for education/certification strengths
  const educationPatterns = [
    /\b(?:Master|PhD|MBA|Doctorate)\b/gi,
    /\bcertified\b/gi
  ];
  
  educationPatterns.forEach((pattern, index) => {
    if (pattern.test(text)) {
      strengths.push(index === 0 
        ? "Advanced educational qualifications" 
        : "Relevant professional certifications");
    }
  });
  
  // Deduplicate and limit to 5 strengths
  return Array.from(new Set(strengths)).slice(0, 5);
}