/**
 * Improved Recommendation Engine
 * 
 * This module integrates the enhanced title matching with your existing
 * recommendation system for better candidate suggestions.
 */

import { storage } from "./storage";
import { Job, Candidate, ResumeData } from "@shared/schema";
import { calculateEnhancedTitleMatch, extractTechnologiesFromTitle } from "./title-matching";

export interface ImprovedCandidateRecommendation {
  candidateId: number;
  candidateName: string;
  location: string;
  matchScore: number;
  matchReasons: string[];
  matchedTitle: string | null;
  matchedTechnologies: string[];
  locationCompatibility: string;
}

/**
 * Calculate simple location compatibility for a job and candidate
 * @param job Job with location details
 * @param candidate Candidate with location
 * @returns Compatibility score (0-1) and description
 */
function calculateLocationCompatibility(
  job: Job, 
  candidate: Candidate
): { score: number; description: string } {
  if (!candidate.location) {
    return { score: 0.5, description: "No location data available" };
  }

  // For remote jobs, be more lenient with location
  if (job.jobType === "remote") {
    return { score: 0.9, description: "Remote position - location flexible" };
  }

  // Exact state match
  if (job.state && candidate.location.includes(job.state)) {
    return { score: 0.9, description: `Located in ${job.state}` };
  }

  // Exact city match
  if (job.city && candidate.location.toLowerCase().includes(job.city.toLowerCase())) {
    return { score: 1.0, description: `Located in ${job.city}` };
  }

  // Nearby state/region - we could expand this with more geographical knowledge
  return { score: 0.6, description: "Different location, may require relocation" };
}

/**
 * Check for industry or client experience match
 * @param job Job with client name
 * @param candidateTitles Candidate job titles
 * @returns Match score (0-1) and reason
 */
function calculateIndustryMatch(
  job: Job,
  candidateTitles: string[]
): { score: number; reason: string | null } {
  if (!job.clientName || !candidateTitles || candidateTitles.length === 0) {
    return { score: 0, reason: null };
  }

  // Financial industry keywords
  const financialKeywords = [
    "bank", "financial", "finance", "investment", "trading", "wealth", 
    "asset", "credit", "loan", "mortgage", "insurance", "payment"
  ];

  const clientName = job.clientName.toLowerCase();
  
  // Check if this is a financial services client
  const isFinancialClient = clientName.includes("bank") || 
                            clientName.includes("financial") ||
                            clientName.includes("payment") ||
                            clientName.includes("capital") ||
                            clientName.includes("invest") ||
                            clientName.includes("fis");

  // Check candidate titles for industry experience
  for (const title of candidateTitles) {
    const lowerTitle = title.toLowerCase();
    
    // Check for direct client name match
    if (lowerTitle.includes(clientName)) {
      return { score: 1.0, reason: `Previous experience with ${job.clientName}` };
    }
    
    // For financial industry clients, check for financial industry experience
    if (isFinancialClient) {
      for (const keyword of financialKeywords) {
        if (lowerTitle.includes(keyword)) {
          return { score: 0.8, reason: "Financial industry experience" };
        }
      }
    }
  }

  return { score: 0, reason: null };
}

/**
 * Find improved candidate recommendations for a job
 * @param jobId Job ID to find candidates for
 * @param minThreshold Minimum match threshold (0-1)
 * @param limit Maximum number of recommendations
 * @returns List of candidate recommendations
 */
export async function findImprovedRecommendations(
  jobId: number,
  minThreshold: number = 0.3, // Lower threshold to show more candidates
  limit: number = 10
): Promise<ImprovedCandidateRecommendation[]> {
  // Get job details
  const job = await storage.getJob(jobId);
  if (!job) throw new Error("Job not found");
  
  // Get all candidates
  const candidates = await storage.getCandidates();
  
  const recommendations: ImprovedCandidateRecommendation[] = [];
  
  // Process each candidate
  for (const candidate of candidates) {
    // Skip candidates marked as unreal
    if (candidate.isUnreal) continue;
    
    // Get candidate resume data (if available)
    const resumeData = await storage.getResumeData(candidate.id);
    
    // Extract candidate job titles
    const candidateTitles = resumeData?.jobTitles || [];
    
    // Calculate enhanced title match
    const titleMatch = calculateEnhancedTitleMatch(job.title, candidateTitles);
    
    // Calculate location compatibility
    const locationMatch = calculateLocationCompatibility(job, candidate);
    
    // Calculate industry experience match
    const industryMatch = calculateIndustryMatch(job, candidateTitles);
    
    // Calculate technology match from job description
    // Extract technologies from job title and description
    const jobTechnologies = extractTechnologiesFromTitle(job.title);
    if (job.description) {
      // Add technologies from description (simplified approach)
      const descLower = job.description.toLowerCase();
      ["java", "oracle", "unix", "linux", "sql", "python", "javascript", "react"]
        .forEach(tech => {
          if (descLower.includes(tech) && !jobTechnologies.includes(tech)) {
            jobTechnologies.push(tech);
          }
        });
    }
    
    // Calculate technology match score
    const techMatchScore = titleMatch.technologies.length > 0
      ? titleMatch.technologies.length / Math.max(jobTechnologies.length, 1)
      : 0;
    
    // Calculate composite score with adjusted weights
    const weights = {
      titleMatch: 0.4,       // Title match is very important
      locationMatch: 0.3,    // Location is somewhat important
      industryMatch: 0.2,    // Industry experience is valuable
      technologyMatch: 0.1   // Technology match from title parsing
    };
    
    const compositeScore = (
      weights.titleMatch * titleMatch.score +
      weights.locationMatch * locationMatch.score +
      weights.industryMatch * industryMatch.score +
      weights.technologyMatch * techMatchScore
    );
    
    // Only include candidates with score above threshold
    if (compositeScore >= minThreshold) {
      // Collect match reasons
      const matchReasons: string[] = [];
      
      if (titleMatch.score > 0.6 && titleMatch.matchedTitle) {
        matchReasons.push(`Similar role: ${titleMatch.matchedTitle}`);
      }
      
      if (titleMatch.technologies.length > 0) {
        matchReasons.push(`Technology match: ${titleMatch.technologies.join(', ')}`);
      }
      
      if (locationMatch.score > 0.7) {
        matchReasons.push(locationMatch.description);
      }
      
      if (industryMatch.reason) {
        matchReasons.push(industryMatch.reason);
      }
      
      // Add recommendation
      recommendations.push({
        candidateId: candidate.id,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        location: candidate.location || 'Unknown',
        matchScore: Math.round(compositeScore * 100), // Convert to percentage
        matchReasons,
        matchedTitle: titleMatch.matchedTitle,
        matchedTechnologies: titleMatch.technologies,
        locationCompatibility: locationMatch.description
      });
    }
  }
  
  // Sort by match score (descending) and limit results
  return recommendations
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);
}