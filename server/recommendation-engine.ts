import { storage } from "./storage";
import { Job, Candidate, ResumeData } from "@shared/schema";

export interface CandidateRecommendation {
  candidateId: number;
  candidateName: string;
  location: string;
  matchScore: number;
  matchReasons: string[];
  skillMatches: string[];
  locationMatch: string;
  clientExperience: string | null;
}

/**
 * Calculate similarity between two strings
 * @param str1 First string
 * @param str2 Second string
 * @returns Similarity score (0-1)
 */
function calculateStringSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // Check for exact match
  if (s1 === s2) return 1;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  // Check for word-level matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word)).length;
  const totalWords = Math.max(words1.length, words2.length);
  
  return totalWords > 0 ? commonWords / totalWords : 0;
}

/**
 * Calculate location match score between job and candidate
 * @param job Job with location details
 * @param candidate Candidate with location
 * @returns Location match score (0-1) and description of match
 */
function calculateLocationMatch(job: Job, candidate: Candidate): { score: number; description: string } {
  // Default for no location info
  if (!candidate.location) return { score: 0, description: "No location data" };
  
  // Handle remote jobs
  if (job.jobType === "remote") {
    return { score: 1, description: "Remote position (location not a factor)" };
  }
  
  // Parse candidate location (expected format: "City, State" or "City")
  const candidateLocationParts = candidate.location.split(',').map(part => part.trim());
  const candidateCity = candidateLocationParts[0];
  const candidateState = candidateLocationParts.length > 1 ? candidateLocationParts[1] : null;
  
  // Exact city match (best for onsite)
  if (job.city && candidateCity && job.city.toLowerCase() === candidateCity.toLowerCase()) {
    return { score: 1, description: `Same city (${job.city})` };
  }
  
  // Same state match (good for hybrid)
  if (job.state && candidateState && job.state.toLowerCase() === candidateState.toLowerCase()) {
    const score = job.jobType === "hybrid" ? 0.9 : 0.7;
    return { score, description: `Same state (${job.state})` };
  }
  
  // Nearby city (useful for hybrid)
  if (job.jobType === "hybrid" && job.city && candidateCity) {
    // Here you could implement a more sophisticated proximity check
    // For now, we'll return a modest score for different cities
    return { score: 0.5, description: `Different city (${candidateCity})` };
  }
  
  // For onsite jobs with location mismatch
  if (job.jobType === "onsite") {
    return { score: 0.1, description: "Location mismatch for onsite role" };
  }
  
  // Default
  return { score: 0.2, description: "Partial location match" };
}

/**
 * Check if candidate has experience with the same client
 */
function checkClientExperience(job: Job, resumeData: ResumeData | null): { hasExperience: boolean; clientName: string | null } {
  if (!resumeData || !resumeData.clientNames || resumeData.clientNames.length === 0) {
    return { hasExperience: false, clientName: null };
  }
  
  // First, check for direct client name match using the clientName field
  if (job.clientName) {
    const jobClientLower = job.clientName.toLowerCase();
    
    // Look for exact or partial match with candidate's client experience
    for (const candidateClient of resumeData.clientNames) {
      const candidateClientLower = candidateClient.toLowerCase();
      
      // Direct match (highest priority)
      if (candidateClientLower === jobClientLower) {
        return { hasExperience: true, clientName: candidateClient };
      }
      
      // Partial match (one contains the other)
      if (candidateClientLower.includes(jobClientLower) || 
          jobClientLower.includes(candidateClientLower)) {
        return { hasExperience: true, clientName: candidateClient };
      }
      
      // Handle common abbreviations like "FIS" for "FIS Global"
      if (jobClientLower.includes("fis") && candidateClientLower.includes("fis")) {
        return { hasExperience: true, clientName: candidateClient };
      }
    }
  }
  
  // Fallback to checking job title for client names (legacy approach)
  const jobWords = job.title.split(' ');
  
  for (const clientName of resumeData.clientNames) {
    // Check if any client name from resume matches words in job title
    if (jobWords.some(word => 
      word.length > 3 && // Only consider substantial words
      clientName.toLowerCase().includes(word.toLowerCase()))) {
      return { hasExperience: true, clientName };
    }
  }
  
  return { hasExperience: false, clientName: null };
}

/**
 * Calculate skill match between job and candidate
 */
function calculateSkillMatch(job: Job, resumeData: ResumeData | null): { score: number; matchedSkills: string[] } {
  if (!resumeData || !resumeData.skills || !job.description) {
    return { score: 0, matchedSkills: [] };
  }
  
  // Extract potential skills from job description (simplified)
  const descWords = job.description.toLowerCase().split(/\W+/).filter(word => word.length > 3);
  
  // Get client focus skills
  const clientFocusSkills = job.clientFocus 
    ? job.clientFocus.toLowerCase().split(',').map(skill => skill.trim())
    : [];
  
  const candidateSkills = resumeData.skills.map(skill => skill.toLowerCase());
  
  // Find matched skills
  const matchedSkills: string[] = [];
  
  // Check for direct skill matches
  for (const skill of candidateSkills) {
    // Check if candidate skill is in client focus (higher priority)
    const isClientFocusSkill = clientFocusSkills.some(focusSkill => 
      skill.includes(focusSkill) || focusSkill.includes(skill)
    );
    
    // Check if skill appears in job description
    const isInDescription = descWords.some(word => skill.includes(word));
    
    if (isClientFocusSkill || isInDescription) {
      matchedSkills.push(skill);
    }
  }
  
  // Calculate match score based on matches and weight client focus skills higher
  const clientFocusMatches = matchedSkills.filter(skill => 
    clientFocusSkills.some(focusSkill => 
      skill.includes(focusSkill) || focusSkill.includes(skill)
    )
  ).length;
  
  // Weight client focus matches more heavily (2x)
  const weightedMatches = matchedSkills.length + clientFocusMatches;
  const estimatedRequiredSkills = Math.min(10, Math.max(5, Math.floor(descWords.length / 50)));
  
  // Calculate score - cap at 1.0
  const score = Math.min(1.0, weightedMatches / estimatedRequiredSkills);
  
  return { score, matchedSkills };
}

/**
 * Calculate job title match score
 */
function calculateTitleMatch(job: Job, resumeData: ResumeData | null): { score: number; matchedTitle: string | null } {
  if (!resumeData || !resumeData.jobTitles || resumeData.jobTitles.length === 0) {
    return { score: 0, matchedTitle: null };
  }
  
  let bestMatchScore = 0;
  let bestMatchTitle: string | null = null;
  
  // Find best matching title
  for (const title of resumeData.jobTitles) {
    const similarity = calculateStringSimilarity(job.title, title);
    if (similarity > bestMatchScore) {
      bestMatchScore = similarity;
      bestMatchTitle = title;
    }
  }
  
  return { score: bestMatchScore, matchedTitle: bestMatchTitle };
}

/**
 * Find recommended candidates for a job
 * @param jobId Job ID to find candidates for
 * @param limit Maximum number of recommendations to return
 * @returns List of candidate recommendations sorted by match score
 */
export async function findRecommendedCandidates(jobId: number, limit: number = 10): Promise<CandidateRecommendation[]> {
  // Get job details
  const job = await storage.getJob(jobId);
  if (!job) throw new Error("Job not found");
  
  // Get all candidates and their resume data
  const candidates = await storage.getCandidates();
  
  const recommendations: CandidateRecommendation[] = [];
  
  // Process each candidate
  for (const candidate of candidates) {
    // Skip invalid candidates
    if (candidate.isUnreal) continue;
    
    // Get resume data for candidate
    const resumeData = await storage.getResumeData(candidate.id);
    const safeResumeData = resumeData || null;
    
    // Calculate various match scores
    const locationMatch = calculateLocationMatch(job, candidate);
    
    const titleMatch = calculateTitleMatch(job, safeResumeData);
    
    const skillMatch = calculateSkillMatch(job, safeResumeData);
    
    const clientExperience = checkClientExperience(job, safeResumeData);
    
    // Calculate composite score (weighted average)
    const weights = {
      titleMatch: 0.3,
      skillMatch: 0.4,
      locationMatch: 0.2,
      clientExperience: 0.1
    };
    
    const compositeScore = (
      weights.titleMatch * titleMatch.score +
      weights.skillMatch * skillMatch.score +
      weights.locationMatch * locationMatch.score +
      (clientExperience.hasExperience ? weights.clientExperience : 0)
    );
    
    // Only include candidates with at least 40% match
    if (compositeScore >= 0.4) {
      // Collect match reasons
      const matchReasons: string[] = [];
      
      if (titleMatch.score > 0.6 && titleMatch.matchedTitle) {
        matchReasons.push(`Similar job title: ${titleMatch.matchedTitle}`);
      }
      
      if (skillMatch.matchedSkills.length > 0) {
        matchReasons.push(`Matches ${skillMatch.matchedSkills.length} required skills`);
      }
      
      if (locationMatch.score > 0.5) {
        matchReasons.push(locationMatch.description);
      }
      
      if (clientExperience.hasExperience && clientExperience.clientName) {
        matchReasons.push(`Previous experience with ${clientExperience.clientName}`);
      }
      
      // Add recommendation
      recommendations.push({
        candidateId: candidate.id,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        location: candidate.location,
        matchScore: Math.round(compositeScore * 100), // Convert to percentage
        matchReasons,
        skillMatches: skillMatch.matchedSkills,
        locationMatch: locationMatch.description,
        clientExperience: clientExperience.clientName
      });
    }
  }
  
  // Sort by match score (descending) and limit results
  return recommendations
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}