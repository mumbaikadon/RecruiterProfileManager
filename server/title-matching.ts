/**
 * Enhanced Job Title Matching System
 * 
 * This module provides advanced job title matching capabilities for the recommendation engine,
 * focusing on matching similar roles and technology-specific positions without requiring
 * full resume text analysis.
 */

// Define job title equivalence (titles that should be considered the same)
const equivalentTitles: Record<string, string[]> = {
  // Technical roles
  "Software Engineer": [
    "Software Developer", 
    "Application Developer", 
    "Programmer", 
    "SDE",
    "Computer Programmer",
    "Application Engineer"
  ],
  "Java Engineer": [
    "Java Developer",
    "Java Programmer",
    "J2EE Developer",
    "Java Application Developer",
    "Backend Java Developer"
  ],
  "Frontend Developer": [
    "Frontend Engineer",
    "UI Developer",
    "UI Engineer", 
    "Web Developer",
    "Client-Side Developer",
    "Web Frontend Developer"
  ],
  "Backend Developer": [
    "Backend Engineer",
    "Server-Side Developer",
    "API Developer",
    "Backend Programming Specialist"
  ],
  "Full Stack Developer": [
    "Full Stack Engineer",
    "Web Application Developer",
    "End-to-End Developer",
    "Full-Stack Programmer"
  ],
  "DevOps Engineer": [
    "Site Reliability Engineer",
    "Platform Engineer",
    "Release Engineer",
    "Infrastructure Engineer",
    "DevOps Specialist"
  ],
  "QA Engineer": [
    "Quality Assurance Engineer",
    "Test Engineer",
    "Software Tester",
    "Automation Engineer",
    "QA Specialist"
  ],
  "Data Scientist": [
    "Machine Learning Engineer",
    "AI Developer",
    "ML Engineer",
    "Data Analyst",
    "Analytics Engineer"
  ],
  "Data Engineer": [
    "Big Data Engineer",
    "ETL Developer",
    "Database Developer",
    "Data Pipeline Engineer"
  ],
  
  // Business/System Analysis
  "Business Analyst": [
    "Business Systems Analyst",
    "Requirements Analyst",
    "Process Analyst",
    "Business Process Analyst",
    "Systems Analyst"
  ],
  
  // Management
  "Project Manager": [
    "Program Manager",
    "IT Project Manager",
    "Technical Project Manager",
    "Delivery Manager",
    "Project Lead"
  ],
  "Product Manager": [
    "Product Owner",
    "Technical Product Manager",
    "Product Specialist"
  ]
};

// Technology-specific job mappings (more specific)
const techSpecificRoles: Record<string, string[]> = {
  "Java": [
    "Java Engineer",
    "Java Developer",
    "Java Programmer",
    "Java Architect",
    "J2EE Developer",
    "Spring Developer"
  ],
  "Python": [
    "Python Developer",
    "Python Engineer",
    "Django Developer",
    "Flask Developer"
  ],
  "JavaScript": [
    "JavaScript Developer",
    "Frontend Developer",
    "React Developer",
    "Angular Developer",
    "Vue Developer",
    "Node.js Developer"
  ],
  "C#": [
    "C# Developer",
    ".NET Developer",
    "ASP.NET Developer",
    ".NET Engineer"
  ],
  "Ruby": [
    "Ruby Developer",
    "Ruby on Rails Developer",
    "Rails Engineer"
  ],
  "PHP": [
    "PHP Developer",
    "Laravel Developer",
    "Symfony Developer",
    "WordPress Developer"
  ],
  "Mobile": [
    "Mobile Developer",
    "iOS Developer",
    "Android Developer", 
    "React Native Developer",
    "Flutter Developer"
  ],
  "Oracle": [
    "Oracle Developer",
    "Oracle DBA",
    "PL/SQL Developer",
    "Oracle Database Engineer"
  ],
  "SQL": [
    "Database Developer",
    "SQL Developer",
    "Database Administrator",
    "Database Engineer"
  ],
  "AWS": [
    "AWS Developer",
    "Cloud Engineer",
    "AWS Solutions Architect",
    "Cloud Developer"
  ],
  "DevOps": [
    "DevOps Engineer",
    "CI/CD Engineer",
    "Release Engineer",
    "Build Engineer"
  ],
  "UNIX": [
    "UNIX Administrator",
    "Linux Engineer",
    "System Administrator",
    "Linux Developer",
    "UNIX Engineer"
  ]
};

// Seniority levels with their weightings
const seniorityLevels: Record<string, number> = {
  "Junior": 0.7,
  "Associate": 0.8,
  "Mid-level": 0.9,
  "Senior": 1.0,
  "Lead": 1.1,
  "Principal": 1.2,
  "Staff": 1.1,
  "Architect": 1.2,
  "Manager": 1.0,
  "Director": 1.1
};

/**
 * Extract technologies from a job title
 * @param title Job title to analyze
 * @returns Array of technologies found in the title
 */
export function extractTechnologiesFromTitle(title: string): string[] {
  const lowerTitle = title.toLowerCase();
  const technologies: string[] = [];

  // Check for known technologies
  Object.keys(techSpecificRoles).forEach(tech => {
    // Look for the technology name in the title
    if (lowerTitle.includes(tech.toLowerCase())) {
      technologies.push(tech);
    }
  });

  return technologies;
}

/**
 * Check if two job titles are equivalent
 * @param title1 First job title
 * @param title2 Second job title
 * @returns True if equivalent, false otherwise
 */
export function areEquivalentTitles(title1: string, title2: string): boolean {
  const normalizedTitle1 = title1.toLowerCase().trim();
  const normalizedTitle2 = title2.toLowerCase().trim();
  
  // Check for exact match
  if (normalizedTitle1 === normalizedTitle2) {
    return true;
  }
  
  // Check for title in equivalence groups
  for (const [mainTitle, equivalents] of Object.entries(equivalentTitles)) {
    const allTitles = [mainTitle.toLowerCase(), ...equivalents.map(t => t.toLowerCase())];
    
    if (allTitles.includes(normalizedTitle1) && allTitles.includes(normalizedTitle2)) {
      return true;
    }
  }
  
  // Check for technology-specific equivalence
  const tech1 = extractTechnologiesFromTitle(title1);
  const tech2 = extractTechnologiesFromTitle(title2);
  
  // If both titles share a technology and are both developer/engineer roles
  const sharedTechs = tech1.filter(t => tech2.includes(t));
  if (sharedTechs.length > 0) {
    const devTerms = ['developer', 'engineer', 'programmer', 'architect'];
    const isTitle1DevRole = devTerms.some(term => normalizedTitle1.includes(term));
    const isTitle2DevRole = devTerms.some(term => normalizedTitle2.includes(term));
    
    if (isTitle1DevRole && isTitle2DevRole) {
      return true;
    }
  }
  
  return false;
}

/**
 * Extract seniority level from a job title
 * @param title Job title to analyze
 * @returns Seniority level and its weight, or null if not found
 */
export function extractSeniority(title: string): { level: string; weight: number } | null {
  const lowerTitle = title.toLowerCase();
  
  for (const [level, weight] of Object.entries(seniorityLevels)) {
    if (lowerTitle.includes(level.toLowerCase())) {
      return { level, weight };
    }
  }
  
  // Default to mid-level if no seniority is specified
  return { level: "Mid-level", weight: 0.9 };
}

/**
 * Calculate enhanced job title match score
 * @param jobTitle The job title we're matching against
 * @param candidateTitles Array of the candidate's previous job titles
 * @returns Match score (0-1) and the best matched title
 */
export function calculateEnhancedTitleMatch(
  jobTitle: string,
  candidateTitles: string[]
): { score: number; matchedTitle: string | null; technologies: string[] } {
  if (!candidateTitles || candidateTitles.length === 0) {
    return { score: 0, matchedTitle: null, technologies: [] };
  }
  
  // Extract technologies from job title
  const jobTechs = extractTechnologiesFromTitle(jobTitle);
  
  let bestMatchScore = 0;
  let bestMatchTitle: string | null = null;
  let matchedTechnologies: string[] = [];
  
  // Find best matching title
  for (const candidateTitle of candidateTitles) {
    // Check for direct equivalence
    if (areEquivalentTitles(jobTitle, candidateTitle)) {
      // Perfect match for equivalent titles
      return { score: 1.0, matchedTitle: candidateTitle, technologies: jobTechs };
    }
    
    // Check for technology matches
    const candidateTechs = extractTechnologiesFromTitle(candidateTitle);
    const sharedTechs = jobTechs.filter(tech => candidateTechs.includes(tech));
    
    let score = 0;
    
    // Base score on word similarity
    const wordSimilarity = calculateWordSimilarity(jobTitle, candidateTitle);
    score += wordSimilarity * 0.6; // 60% weight for word similarity
    
    // Add tech matching bonus
    if (sharedTechs.length > 0) {
      const techMatchScore = sharedTechs.length / Math.max(jobTechs.length, 1);
      score += techMatchScore * 0.3; // 30% weight for tech matches
    }
    
    // Add seniority matching
    const jobSeniority = extractSeniority(jobTitle);
    const candidateSeniority = extractSeniority(candidateTitle);
    
    if (jobSeniority && candidateSeniority) {
      // Calculate seniority compatibility based on difference
      const seniorityDiff = Math.abs(jobSeniority.weight - candidateSeniority.weight);
      const seniorityMatch = Math.max(0, 1 - seniorityDiff);
      score += seniorityMatch * 0.1; // 10% weight for seniority match
    }
    
    if (score > bestMatchScore) {
      bestMatchScore = score;
      bestMatchTitle = candidateTitle;
      matchedTechnologies = sharedTechs;
    }
  }
  
  return { 
    score: bestMatchScore, 
    matchedTitle: bestMatchTitle,
    technologies: matchedTechnologies
  };
}

/**
 * Calculate word-level similarity between two job titles
 * @param title1 First title
 * @param title2 Second title
 * @returns Similarity score (0-1)
 */
function calculateWordSimilarity(title1: string, title2: string): number {
  const words1 = title1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = title2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) {
    return 0;
  }
  
  // Count words that match exactly
  const exactMatches = words1.filter(w => words2.includes(w)).length;
  
  // Count partial word matches (one word contains the other)
  let partialMatches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1)) {
        // Only count if they're not exact matches and at least 3 chars overlap
        if (word1 !== word2 && (word1.length >= 3 && word2.length >= 3)) {
          partialMatches++;
        }
      }
    }
  }
  
  // Calculate weighted score (exact matches worth more than partial matches)
  const totalWords = Math.max(words1.length, words2.length);
  const score = (exactMatches + (partialMatches * 0.5)) / totalWords;
  
  return Math.min(1, score); // Cap at 1.0
}