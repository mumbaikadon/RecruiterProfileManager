import OpenAI from "openai";
import { analyzeResume as resumeAnalyzer } from "./resumeAnalyzer";

// Initialize OpenAI with API key from environment variables
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interface for the resume analysis result returned from the API
export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  softSkills: string[];
  certifications: string[];
  publications: string[];
  education: string[];
  extractedText: string;
}

// Interface for detailed gap information
export interface GapDetail {
  category: string;
  gaps: string[];
  importance: string;
  impact: string;
  suggestions: string[];
}

// Interface for the match result between a resume and job description
export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technicalGaps?: string[];
  matchingSkills?: string[];
  missingSkills?: string[];
  
  // Enhanced gap analysis details with domain-specific expertise gaps
  gapDetails?: GapDetail[];
  
  // Structured employment history data
  clientNames?: string[];
  jobTitles?: string[];  
  relevantDates?: string[];
  
  // Education data
  education?: string[];
  
  // Domain-specific expertise indicators
  domainExpertiseGaps?: string[];
  domainKnowledgeScore?: number;
  
  // Legacy fields for backward compatibility
  clientExperience?: string;
  confidence?: number;
}

/**
 * Resume text analysis that extracts basic fields including education
 * This function extracts information like employment history, education details,
 * and skills from the resume text using OpenAI
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  // Basic validation
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("Resume text cannot be empty");
  }
  
  try {
    console.log("Starting resume analysis with OpenAI...");
    console.log(`Resume text length: ${resumeText.length} characters`);
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer specializing in extracting accurate information from resumes. " +
            "Your task is to extract REAL data from the resume - never generate fake or generic data. " +
            "Extract company names, job titles, dates, skills, and education details directly from the resume text. " +
            "Be precise and only use information actually present in the resume."
        },
        {
          role: "user",
          content: 
            `Extract key information from this resume text:
            
            ${resumeText}
            
            EXTRACTION INSTRUCTIONS:
            1. Carefully read the entire resume text
            
            2. EMPLOYMENT HISTORY:
               - Extract company/employer names the candidate worked for
               - Extract job titles/positions held by the candidate
               - Extract employment periods (date ranges)
            
            3. EDUCATION:
               - Extract education details including degrees, institutions, and graduation years
               - Format as complete phrases (e.g., "Master's in Computer Science, University of XYZ, 2023")
            
            4. SKILLS:
               - Extract technical skills, technologies, programming languages, etc.
               - Include programming languages, frameworks, tools, platforms, databases
               - Extract soft skills (leadership, communication, etc.)
            
            5. CERTIFICATIONS:
               - Extract professional certifications, licenses, and credentials
               - Include certification name, issuing organization, and dates if available
            
            6. PUBLICATIONS/PROJECTS:
               - Extract any notable publications, research papers, or significant projects
            
            Return your analysis in a structured JSON format with the following fields:
            - clientNames (array of strings: extract company names)
            - jobTitles (array of strings: extract job titles)
            - relevantDates (array of strings: extract date ranges)
            - education (array of strings: extract education details)
            - skills (array of strings: extract technical skills)
            - softSkills (array of strings: extract soft skills)
            - certifications (array of strings: extract certifications)
            - publications (array of strings: extract publications/projects)
            
            NOTICE: If you cannot find certain information, return empty arrays for those fields.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1000,
    });

    console.log("OpenAI resume analysis completed");
    
    // Parse the response
    const responseContent = response.choices[0].message.content || '{}';
    const analysisResult = JSON.parse(responseContent);
    
    // Sanitize and return the result
    return {
      clientNames: Array.isArray(analysisResult.clientNames) ? analysisResult.clientNames : [],
      jobTitles: Array.isArray(analysisResult.jobTitles) ? analysisResult.jobTitles : [],  
      relevantDates: Array.isArray(analysisResult.relevantDates) ? analysisResult.relevantDates : [],
      skills: Array.isArray(analysisResult.skills) ? analysisResult.skills : [],
      softSkills: Array.isArray(analysisResult.softSkills) ? analysisResult.softSkills : [],
      certifications: Array.isArray(analysisResult.certifications) ? analysisResult.certifications : [],
      publications: Array.isArray(analysisResult.publications) ? analysisResult.publications : [],
      education: Array.isArray(analysisResult.education) ? analysisResult.education : [],
      extractedText: resumeText.substring(0, 4000) // Limit to 4000 chars for DB storage
    };
  } catch (error) {
    console.error("Error analyzing resume text:", error);
    
    // If there's an error, return empty fields rather than failing completely
    return {
      clientNames: [],
      jobTitles: [],  
      relevantDates: [],
      skills: [],
      softSkills: [],
      certifications: [],
      publications: [],
      education: [],
      extractedText: resumeText.substring(0, 4000)
    };
  }
}

/**
 * Advanced resume analysis that matches a resume against a job description
 * @param resumeText The resume text to analyze
 * @param jobDescription The job description to match against
 * @returns Analysis result with match score and insights
 */
export async function matchResumeToJob(resumeText: string, jobDescription: string): Promise<MatchScoreResult> {
  // Validate inputs
  if (!resumeText || resumeText.trim().length === 0) {
    throw new Error("Resume text cannot be empty");
  }
  
  if (!jobDescription || jobDescription.trim().length === 0) {
    throw new Error("Job description cannot be empty");
  }
  
  try {
    // Use the resumeAnalyzer from resumeAnalyzer.ts for the detailed analysis
    console.log("Calling resumeAnalyzer function");
    const analysis = await resumeAnalyzer(resumeText, jobDescription);
    
    // Format the result to match our expected API structure
    // Extract domain-specific expertise gaps from the detailed gap analysis
    // Use the provided domainExpertiseGaps if available, otherwise extract them from gapDetails
    let domainExpertiseGaps: string[] = [];
    if (Array.isArray(analysis.domainExpertiseGaps) && analysis.domainExpertiseGaps.length > 0) {
      // Use directly provided domain expertise gaps if available
      domainExpertiseGaps = analysis.domainExpertiseGaps;
    } else if (Array.isArray(analysis.skillsGapAnalysis.gapDetails)) {
      // Extract from gap details with industry-relevant filtering
      domainExpertiseGaps = analysis.skillsGapAnalysis.gapDetails.flatMap((detail: GapDetail): string[] => {
        // First check if the gap category is domain-specific
        const isDomainCategory = 
          detail.category.toLowerCase().includes('domain') ||
          detail.category.toLowerCase().includes('industry') ||
          detail.category.toLowerCase().includes('specific') ||
          detail.category.toLowerCase().includes('expertise') ||
          detail.category.toLowerCase().includes('knowledge') ||
          detail.importance === 'Critical';
        
        // If it's a domain category, include all gaps; otherwise filter for domain-specific terms
        return isDomainCategory ? detail.gaps : detail.gaps.filter(gap => 
          gap.toLowerCase().includes('payment') || 
          gap.toLowerCase().includes('api') || 
          gap.toLowerCase().includes('financial') ||
          gap.toLowerCase().includes('processing') ||
          gap.toLowerCase().includes('card') ||
          gap.toLowerCase().includes('transaction') ||
          gap.toLowerCase().includes('modeling') ||
          gap.toLowerCase().includes('notation') ||
          gap.toLowerCase().includes('bpmn') ||
          gap.toLowerCase().includes('uml') ||
          gap.toLowerCase().includes('methodology') ||
          gap.toLowerCase().includes('framework') ||
          gap.toLowerCase().includes('specific')
        );
      });
    }
    
    // Calculate a domain knowledge score based on gaps and strengths
    // First, check if we have a pre-calculated domain knowledge score
    let domainKnowledgeScore: number;
    
    if (typeof analysis.domainKnowledgeScore === 'number') {
      // Use the domain knowledge score provided by the analysis
      domainKnowledgeScore = analysis.domainKnowledgeScore;
    } else {
      // Identify domain-relevant strengths based on job description keywords
      // Check if job description contains business analyst terms
      const isBusinessAnalystRole = jobDescription.toLowerCase().includes('business analyst') || 
                                  jobDescription.toLowerCase().includes('system analyst') ||
                                  jobDescription.toLowerCase().includes('process') ||
                                  jobDescription.toLowerCase().includes('requirements');
                                  
      // Check if job description contains payment processing terms
      const isPaymentRole = jobDescription.toLowerCase().includes('payment') || 
                          jobDescription.toLowerCase().includes('transaction') ||
                          jobDescription.toLowerCase().includes('financial') ||
                          jobDescription.toLowerCase().includes('gateway');
      
      // Define domain-specific keywords based on role type
      const domainKeywords = isBusinessAnalystRole 
        ? ['process', 'requirement', 'analysis', 'model', 'diagram', 'bpmn', 'uml', 'system', 'stakeholder', 'agile']
        : isPaymentRole 
          ? ['payment', 'transaction', 'api', 'financial', 'gateway', 'processor', 'ecommerce']
          : ['api', 'development', 'architecture', 'integration', 'framework'];
      
      // Count strengths related to the domain
      const domainRelevantStrengths = analysis.relevantExperience.filter(exp => 
        domainKeywords.some(keyword => exp.toLowerCase().includes(keyword))
      ).length;
      
      // Count critical domain gaps
      const criticalDomainGaps = Array.isArray(analysis.skillsGapAnalysis.gapDetails)
        ? analysis.skillsGapAnalysis.gapDetails.filter(detail => 
            detail.importance === "Critical" && 
            domainKeywords.some(keyword => detail.category.toLowerCase().includes(keyword))
          ).length
        : 0;
      
      // Higher score means better domain knowledge (0-100)
      domainKnowledgeScore = Math.max(0, Math.min(100, 
        analysis.overallScore - (criticalDomainGaps * 15) + (domainRelevantStrengths * 5)
      ));
    }
    
    const result: MatchScoreResult = {
      // Core match scores and analysis
      score: analysis.overallScore,
      strengths: analysis.relevantExperience,
      
      // Use domain-specific gaps when possible, falling back to general gaps
      weaknesses: domainExpertiseGaps.length > 0 
        ? domainExpertiseGaps 
        : analysis.skillsGapAnalysis.missingSkills,
        
      suggestions: analysis.improvements.content,
      
      // Skills analysis
      technicalGaps: analysis.skillsGapAnalysis.missingSkills,
      matchingSkills: analysis.skillsGapAnalysis.matchingSkills,
      missingSkills: analysis.skillsGapAnalysis.missingSkills,
      
      // Enhanced gap analysis details
      gapDetails: Array.isArray(analysis.skillsGapAnalysis.gapDetails) 
        ? analysis.skillsGapAnalysis.gapDetails 
        : [],
      
      // Domain-specific expertise indicators
      domainExpertiseGaps,
      domainKnowledgeScore,
      
      // Employment history data
      clientNames: analysis.clientNames || [],
      jobTitles: analysis.jobTitles || [],
      relevantDates: analysis.relevantDates || [],
      
      // Education data
      education: analysis.education || [],
      
      // Legacy fields
      clientExperience: analysis.relevantExperience.join(", "),
      confidence: analysis.confidenceScore
    };
    
    return result;
  } catch (error) {
    console.error("Error matching resume to job:", error);
    throw error;
  }
}