/**
 * Enhanced Recommendation Engine
 * 
 * This module integrates all the enhanced matching components to provide
 * more accurate and contextually relevant candidate recommendations.
 */

import { storage } from "./storage";
import { Job, Candidate, ResumeData } from "@shared/schema";
import { calculateEnhancedTitleMatch } from "./job-title-taxonomy";
import { calculateEnhancedSkillMatch, extractSkills } from "./skill-matching";
import { calculateEnhancedLocationMatch, parseLocation } from "./location-matching";
import { calculateClientExperienceMatch } from "./client-experience-matching";

// Extended recommendation interface with additional details
export interface EnhancedCandidateRecommendation {
  candidateId: number;
  candidateName: string;
  location: string;
  matchScore: number;
  matchReasons: string[];
  
  // Title match details
  titleMatch: {
    score: number;
    matchedTitle: string | null;
  };
  
  // Skill match details
  skillMatch: {
    score: number;
    matchedSkills: string[];
    partialMatches: Array<{skill: string, relatedTo: string, weight: number}>;
    missingSkills: string[];
    clientFocusMatches: string[];
  };
  
  // Location match details
  locationMatch: {
    score: number;
    description: string;
    distance: number | null;
    isWithinCommute: boolean;
    timeZoneCompatibility: number;
  };
  
  // Client experience details
  clientExperience: {
    hasExperience: boolean;
    clientName: string | null;
    industryMatch: boolean;
    industryName: string | null;
    isRegulated: boolean;
    domainExperience: string[];
    score: number;
  };
  
  // Experience level evaluation
  experienceLevel: {
    score: number;
    yearsOfExperience: number | null;
    leadershipExperience: boolean;
    seniorityMatch: string | null;
  };
}

/**
 * Estimate years of experience from resume data
 * @param resumeData Resume data containing employment history
 * @returns Estimated years of experience and whether leadership experience is present
 */
function estimateExperienceLevel(resumeData: ResumeData | null): { 
  yearsOfExperience: number | null; 
  leadershipExperience: boolean;
} {
  if (!resumeData || !resumeData.relevantDates || resumeData.relevantDates.length === 0) {
    return { yearsOfExperience: null, leadershipExperience: false };
  }
  
  // Simple leadership detection based on job titles
  const leadershipKeywords = [
    "lead", "senior", "manager", "director", "chief", "head", "vp", "president",
    "principal", "architect", "supervisor", "executive"
  ];
  
  const hasLeadershipTitle = resumeData.jobTitles 
    ? resumeData.jobTitles.some(title => 
        leadershipKeywords.some(keyword => 
          title.toLowerCase().includes(keyword)
        )
      )
    : false;
  
  // Rough estimation of experience from dates
  // This is a simplified approach - a real implementation would parse dates more accurately
  let yearsOfExperience = 0;
  
  const currentYear = new Date().getFullYear();
  const earliestYear = resumeData.relevantDates
    .map(date => {
      // Try to extract years from dates
      const yearMatch = date.match(/\b(19|20)\d{2}\b/);
      return yearMatch ? parseInt(yearMatch[0]) : currentYear;
    })
    .reduce((min, year) => Math.min(min, year), currentYear);
  
  if (earliestYear < currentYear) {
    yearsOfExperience = currentYear - earliestYear;
  }
  
  return {
    yearsOfExperience: yearsOfExperience > 0 ? yearsOfExperience : null,
    leadershipExperience: hasLeadershipTitle
  };
}

/**
 * Calculate experience level match between job and candidate
 * @param job Job with title and requirements
 * @param resumeData Candidate resume data
 * @returns Experience level match details
 */
function calculateExperienceLevelMatch(
  job: Job,
  resumeData: ResumeData | null
): {
  score: number;
  yearsOfExperience: number | null;
  leadershipExperience: boolean;
  seniorityMatch: string | null;
} {
  if (!resumeData) {
    return {
      score: 0.5, // Neutral score when no data available
      yearsOfExperience: null,
      leadershipExperience: false,
      seniorityMatch: null
    };
  }
  
  // Extract experience details
  const { yearsOfExperience, leadershipExperience } = estimateExperienceLevel(resumeData);
  
  // Determine job seniority from title
  const jobTitle = job.title.toLowerCase();
  
  const isSeniorRole = jobTitle.includes("senior") || 
                       jobTitle.includes("lead") || 
                       jobTitle.includes("principal") || 
                       jobTitle.includes("architect");
  
  const isJuniorRole = jobTitle.includes("junior") || 
                        jobTitle.includes("associate") || 
                        jobTitle.includes("entry") || 
                        jobTitle.includes("trainee");
  
  const isManagerialRole = jobTitle.includes("manager") || 
                           jobTitle.includes("director") || 
                           jobTitle.includes("head") || 
                           jobTitle.includes("chief") || 
                           jobTitle.includes("vp");
  
  // Calculate match score based on alignment
  let score = 0.5; // Default neutral score
  let seniorityMatch: string | null = null;
  
  if (yearsOfExperience !== null) {
    // Experience-based scoring
    if (isJuniorRole && yearsOfExperience <= 3) {
      score = 0.9; // Good match for junior roles
      seniorityMatch = "Junior role matches early career experience";
    } else if (isSeniorRole && yearsOfExperience >= 5) {
      score = 0.9; // Good match for senior roles
      seniorityMatch = "Senior role matches substantial experience";
    } else if (isManagerialRole && yearsOfExperience >= 8) {
      score = 0.9; // Good match for managerial roles
      seniorityMatch = "Management role matches extensive experience";
    } else if (isJuniorRole && yearsOfExperience > 5) {
      score = 0.3; // Overqualified for junior role
      seniorityMatch = "Candidate may be overqualified for junior role";
    } else if ((isSeniorRole || isManagerialRole) && yearsOfExperience < 3) {
      score = 0.3; // Underqualified for senior/managerial role
      seniorityMatch = "Candidate may need more experience for this senior role";
    } else {
      // Moderate match
      score = 0.7;
      seniorityMatch = "Moderate experience level match";
    }
  }
  
  // Adjust for leadership experience
  if (isManagerialRole && leadershipExperience) {
    score = Math.min(1.0, score + 0.2); // Bonus for leadership in managerial roles
    seniorityMatch = "Leadership experience matches management role";
  } else if (isSeniorRole && leadershipExperience) {
    score = Math.min(1.0, score + 0.1); // Smaller bonus for leadership in senior roles
  }
  
  return {
    score,
    yearsOfExperience,
    leadershipExperience,
    seniorityMatch
  };
}

/**
 * Find recommended candidates for a job using enhanced matching algorithms
 * @param jobId Job ID to find candidates for
 * @param limit Maximum number of recommendations to return
 * @param minThreshold Minimum match score threshold (0-1)
 * @returns List of candidate recommendations sorted by match score
 */
export async function findEnhancedRecommendedCandidates(
  jobId: number, 
  limit: number = 10,
  minThreshold: number = 0.3 // Lower default threshold to show more candidates
): Promise<EnhancedCandidateRecommendation[]> {
  // Get job details
  const job = await storage.getJob(jobId);
  if (!job) throw new Error("Job not found");
  
  // Get all candidates and their resume data
  const candidates = await storage.getCandidates();
  
  const recommendations: EnhancedCandidateRecommendation[] = [];
  
  // Extract job skills for context-aware title matching
  const jobSkills = extractSkills(job.description || '');
  
  // Parse job location
  const { city: jobCity, state: jobState } = parseLocation(
    [job.city, job.state].filter(Boolean).join(', ')
  );
  
  // Process each candidate
  for (const candidate of candidates) {
    // Skip invalid candidates
    if (candidate.isUnreal) continue;
    
    // Get resume data for candidate
    const resumeData = await storage.getResumeData(candidate.id);
    const safeResumeData = resumeData || null;
    
    // Parse candidate location
    const { city: candidateCity, state: candidateState } = parseLocation(candidate.location || '');
    
    // Calculate enhanced match scores
    
    // 1. Enhanced Title Match (using taxonomy and context)
    const titleMatch = calculateEnhancedTitleMatch(
      job.title,
      safeResumeData?.jobTitles || [],
      jobSkills,
      safeResumeData?.skills || []
    );
    
    // 2. Enhanced Skill Match (with related skills and partial matches)
    const skillMatch = calculateEnhancedSkillMatch(
      job.description || '',
      safeResumeData?.skills || [],
      job.clientFocus
    );
    
    // 3. Enhanced Location Match (with proximity and time zone awareness)
    const locationMatch = calculateEnhancedLocationMatch(
      jobCity,
      jobState,
      job.jobType || null,
      candidate.location
    );
    
    // 4. Enhanced Client Experience Match (with industry recognition)
    const clientExperience = calculateClientExperienceMatch(
      job.clientName,
      safeResumeData?.clientNames || []
    );
    
    // 5. Experience Level Match (new dimension)
    const experienceLevel = calculateExperienceLevelMatch(job, safeResumeData);
    
    // Calculate composite score with adjusted weights
    const weights = {
      titleMatch: 0.25,    // Reduced slightly from 0.3
      skillMatch: 0.35,    // Reduced slightly from 0.4
      locationMatch: 0.15, // Reduced slightly from 0.2
      clientExperience: 0.15, // Increased from 0.1
      experienceLevel: 0.1  // New dimension
    };
    
    const compositeScore = (
      weights.titleMatch * titleMatch.score +
      weights.skillMatch * skillMatch.score +
      weights.locationMatch * locationMatch.score +
      weights.clientExperience * clientExperience.score +
      weights.experienceLevel * experienceLevel.score
    );
    
    // Only include candidates with sufficient match
    if (compositeScore >= minThreshold) {
      // Collect match reasons
      const matchReasons: string[] = [];
      
      if (titleMatch.score > 0.6 && titleMatch.matchedTitle) {
        matchReasons.push(`Similar job title: ${titleMatch.matchedTitle}`);
      }
      
      if (skillMatch.matchedSkills.length > 0) {
        matchReasons.push(`Matches ${skillMatch.matchedSkills.length} required skills`);
        
        if (skillMatch.clientFocusMatches.length > 0) {
          matchReasons.push(`Matches ${skillMatch.clientFocusMatches.length} client focus areas`);
        }
      }
      
      if (locationMatch.score > 0.5) {
        matchReasons.push(locationMatch.description);
      }
      
      if (clientExperience.hasExperience && clientExperience.clientName) {
        if (clientExperience.score >= 0.9) {
          matchReasons.push(`Previous experience with ${clientExperience.clientName}`);
        } else if (clientExperience.industryMatch) {
          matchReasons.push(`Experience in the ${clientExperience.industryName} industry`);
        }
      }
      
      if (experienceLevel.seniorityMatch) {
        matchReasons.push(experienceLevel.seniorityMatch);
      }
      
      // Add recommendation
      recommendations.push({
        candidateId: candidate.id,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        location: candidate.location || 'Unknown',
        matchScore: Math.round(compositeScore * 100), // Convert to percentage
        matchReasons,
        titleMatch,
        skillMatch,
        locationMatch,
        clientExperience,
        experienceLevel
      });
    }
  }
  
  // Sort by match score (descending) and limit results
  return recommendations
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}