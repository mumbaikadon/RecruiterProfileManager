/**
 * Job Title Taxonomy
 * 
 * This module provides a hierarchical representation of job titles,
 * equivalence relations, and role hierarchies to improve candidate matching.
 */

// Define title equivalence (titles that should be considered the same)
export const equivalentTitles: Record<string, string[]> = {
  // Software Engineering
  "Software Engineer": [
    "Software Developer", 
    "Application Developer", 
    "Programmer", 
    "SDE",
    "Computer Programmer",
    "Coder"
  ],
  "Frontend Developer": [
    "Frontend Engineer",
    "UI Developer",
    "UI Engineer", 
    "Web Developer",
    "Client-Side Developer"
  ],
  "Backend Developer": [
    "Backend Engineer",
    "Server-Side Developer",
    "API Developer"
  ],
  "Full Stack Developer": [
    "Full Stack Engineer",
    "Web Application Developer",
    "End-to-End Developer"
  ],
  "DevOps Engineer": [
    "Site Reliability Engineer",
    "Platform Engineer",
    "Release Engineer",
    "Infrastructure Engineer"
  ],
  "QA Engineer": [
    "Quality Assurance Engineer",
    "Test Engineer",
    "Software Tester",
    "Automation Engineer"
  ],
  "Data Scientist": [
    "Machine Learning Engineer",
    "AI Developer",
    "ML Engineer"
  ],
  "Data Engineer": [
    "Big Data Engineer",
    "ETL Developer",
    "Database Developer"
  ],
  
  // Business/System Analysis
  "Business Analyst": [
    "Business Systems Analyst",
    "Requirements Analyst",
    "Process Analyst",
    "Business Process Analyst"
  ],
  "Systems Analyst": [
    "System Engineer",
    "IT Analyst",
    "Technical Analyst"
  ],
  
  // Management
  "Project Manager": [
    "Program Manager",
    "IT Project Manager",
    "Technical Project Manager",
    "Delivery Manager"
  ],
  "Product Manager": [
    "Product Owner",
    "Technical Product Manager"
  ],
  "Engineering Manager": [
    "Development Manager",
    "Software Development Manager",
    "Manager of Software Engineering"
  ],
  "CTO": [
    "Chief Technology Officer",
    "VP of Engineering",
    "Technical Director"
  ]
};

// Hierarchical relationships (child → parent)
export const titleHierarchy: Record<string, string[]> = {
  // Technical specialists roll up to general roles
  "Java Developer": ["Backend Developer", "Software Engineer"],
  "React Developer": ["Frontend Developer", "Software Engineer"],
  "Angular Developer": ["Frontend Developer", "Software Engineer"],
  "Vue Developer": ["Frontend Developer", "Software Engineer"],
  "Node.js Developer": ["Backend Developer", "Software Engineer"],
  "Python Developer": ["Backend Developer", "Software Engineer"],
  "iOS Developer": ["Mobile Developer", "Software Engineer"],
  "Android Developer": ["Mobile Developer", "Software Engineer"],
  "AWS Engineer": ["Cloud Engineer", "DevOps Engineer"],
  "Azure Engineer": ["Cloud Engineer", "DevOps Engineer"],
  "Database Administrator": ["Data Engineer"],
  
  // Seniority levels
  "Senior Software Engineer": ["Software Engineer"],
  "Lead Software Engineer": ["Senior Software Engineer"],
  "Principal Engineer": ["Lead Software Engineer"],
  "Software Architect": ["Principal Engineer"],
  "Senior Frontend Developer": ["Frontend Developer"],
  "Lead Frontend Developer": ["Senior Frontend Developer"],
  "Senior Backend Developer": ["Backend Developer"],
  "Lead Backend Developer": ["Senior Backend Developer"],
};

// Domain-specific title mappings
export const domainSpecificTitles: Record<string, Record<string, string[]>> = {
  "Finance": {
    "Financial Software Engineer": ["Software Engineer"],
    "Trading Systems Developer": ["Software Engineer"],
    "Financial Systems Analyst": ["Business Analyst", "Systems Analyst"],
    "Regulatory Technology Developer": ["Software Engineer"]
  },
  "Healthcare": {
    "Healthcare Software Engineer": ["Software Engineer"],
    "Clinical Systems Developer": ["Software Engineer"],
    "Healthcare Data Analyst": ["Data Analyst"],
    "Medical Systems Integrator": ["Integration Specialist", "Software Engineer"]
  },
  "E-commerce": {
    "E-commerce Developer": ["Full Stack Developer", "Software Engineer"],
    "Payments Integration Engineer": ["Software Engineer", "Backend Developer"],
    "Shopping Platform Engineer": ["Software Engineer"]
  },
  "Marketing": {
    "Marketing Automation Developer": ["Software Engineer"],
    "Digital Marketing Engineer": ["Software Engineer"],
    "MarTech Developer": ["Software Engineer"]
  }
};

// Tech stack to role mapping
export const techStackToRoles: Record<string, string[]> = {
  "React": ["Frontend Developer", "UI Developer", "Web Developer"],
  "Angular": ["Frontend Developer", "UI Developer", "Web Developer"],
  "Vue": ["Frontend Developer", "UI Developer", "Web Developer"],
  "JavaScript": ["Frontend Developer", "Full Stack Developer", "Web Developer"],
  "TypeScript": ["Frontend Developer", "Full Stack Developer", "Backend Developer"],
  "Node.js": ["Backend Developer", "Full Stack Developer"],
  "Express": ["Backend Developer", "Node.js Developer"],
  "Java": ["Backend Developer", "Software Engineer"],
  "Spring": ["Java Developer", "Backend Developer"],
  "Python": ["Backend Developer", "Data Engineer", "Data Scientist"],
  "Django": ["Python Developer", "Backend Developer"],
  "Flask": ["Python Developer", "Backend Developer"],
  "PHP": ["Backend Developer", "Web Developer"],
  "Laravel": ["PHP Developer", "Backend Developer"],
  "C#": ["Backend Developer", "Software Engineer", ".NET Developer"],
  ".NET": ["C# Developer", "Backend Developer"],
  "SQL": ["Database Developer", "Backend Developer", "Data Engineer"],
  "MongoDB": ["NoSQL Developer", "Database Developer"],
  "AWS": ["Cloud Engineer", "DevOps Engineer"],
  "Azure": ["Cloud Engineer", "DevOps Engineer"],
  "GCP": ["Cloud Engineer", "DevOps Engineer"],
  "Docker": ["DevOps Engineer", "Cloud Engineer"],
  "Kubernetes": ["DevOps Engineer", "Cloud Engineer"],
  "TensorFlow": ["Machine Learning Engineer", "Data Scientist"],
  "PyTorch": ["Machine Learning Engineer", "Data Scientist"],
  "Hadoop": ["Big Data Engineer", "Data Engineer"],
  "Spark": ["Data Engineer", "Big Data Engineer"]
};

/**
 * Find equivalent job titles for a given title
 * @param title The job title to find equivalents for
 * @returns Array of equivalent titles
 */
export function getEquivalentTitles(title: string): string[] {
  // Normalize the input title
  const normalizedTitle = title.toLowerCase().trim();
  
  // Check direct equivalences
  for (const [mainTitle, equivalents] of Object.entries(equivalentTitles)) {
    if (mainTitle.toLowerCase() === normalizedTitle || 
        equivalents.some(t => t.toLowerCase() === normalizedTitle)) {
      // Return all equivalents plus the main title
      return [mainTitle, ...equivalents];
    }
  }
  
  // No direct equivalence found
  return [title];
}

/**
 * Find parent roles for a given title (roles that this title can be considered a part of)
 * @param title The job title to find parent roles for
 * @returns Array of parent roles
 */
export function getParentRoles(title: string): string[] {
  const normalizedTitle = title.toLowerCase().trim();
  
  // Check direct hierarchy relations
  for (const [childTitle, parents] of Object.entries(titleHierarchy)) {
    if (childTitle.toLowerCase() === normalizedTitle) {
      return parents;
    }
  }
  
  return [];
}

/**
 * Find all possible roles that a person with the given title could fulfill
 * This includes equivalent titles, parent roles, and their equivalents
 * @param title The job title to expand
 * @returns Array of all possible matching roles
 */
export function expandJobTitle(title: string): string[] {
  const result = new Set<string>([title]);
  
  // Add direct equivalents
  getEquivalentTitles(title).forEach(t => result.add(t));
  
  // Add parent roles
  const parents = getParentRoles(title);
  parents.forEach(parent => {
    result.add(parent);
    // Add equivalents of parent roles
    getEquivalentTitles(parent).forEach(t => result.add(t));
  });
  
  return Array.from(result);
}

/**
 * Find roles associated with specific technologies
 * @param technologies Array of technologies/skills
 * @returns Array of potential roles matching those technologies
 */
export function getRolesFromTechnologies(technologies: string[]): string[] {
  const roles = new Set<string>();
  
  technologies.forEach(tech => {
    const normalizedTech = tech.toLowerCase().trim();
    
    // Check each technology in our mapping
    for (const [techName, techRoles] of Object.entries(techStackToRoles)) {
      if (normalizedTech.includes(techName.toLowerCase())) {
        techRoles.forEach(role => roles.add(role));
      }
    }
  });
  
  return Array.from(roles);
}

/**
 * Calculate title match score using the enhanced taxonomy
 * @param jobTitle The job title we're matching against
 * @param candidateTitles Array of candidate's previous job titles
 * @param jobSkills Skills mentioned in the job (used for context)
 * @param candidateSkills Skills the candidate has (used for context)
 * @returns Match score (0-1) and the best matched title
 */
export function calculateEnhancedTitleMatch(
  jobTitle: string,
  candidateTitles: string[],
  jobSkills: string[] = [],
  candidateSkills: string[] = []
): { score: number; matchedTitle: string | null } {
  if (!candidateTitles || candidateTitles.length === 0) {
    return { score: 0, matchedTitle: null };
  }
  
  // Normalize job title
  const normalizedJobTitle = jobTitle.toLowerCase().trim();
  
  // Expand job title to include equivalents and parent roles
  const expandedJobTitles = expandJobTitle(jobTitle);
  
  // Consider roles based on job skills
  const jobSkillRoles = getRolesFromTechnologies(jobSkills);
  expandedJobTitles.push(...jobSkillRoles);
  
  // Deduplicate
  const allJobTitles = Array.from(new Set(expandedJobTitles));
  
  // Track best match
  let bestMatchScore = 0;
  let bestMatchTitle: string | null = null;
  
  // For each candidate title, check against all expanded job titles
  for (const candidateTitle of candidateTitles) {
    const normalizedCandidateTitle = candidateTitle.toLowerCase().trim();
    
    // Expand candidate title to include equivalents and parent roles
    const expandedCandidateTitles = expandJobTitle(candidateTitle);
    
    // Consider candidate skills for additional role matching
    const candidateSkillRoles = getRolesFromTechnologies(candidateSkills);
    expandedCandidateTitles.push(...candidateSkillRoles);
    
    // Direct title match (high score)
    if (allJobTitles.some(t => t.toLowerCase() === normalizedCandidateTitle)) {
      return { score: 1.0, matchedTitle: candidateTitle };
    }
    
    // Check for partial matches
    for (const expandedJobTitle of allJobTitles) {
      for (const expandedCandidateTitle of expandedCandidateTitles) {
        // Calculate direct string similarity
        const similarity = calculateTitleSimilarity(
          expandedJobTitle,
          expandedCandidateTitle
        );
        
        if (similarity > bestMatchScore) {
          bestMatchScore = similarity;
          bestMatchTitle = candidateTitle; // Use original candidate title for display
        }
      }
    }
  }
  
  return { score: bestMatchScore, matchedTitle: bestMatchTitle };
}

/**
 * Calculate string similarity between two job titles
 * @param title1 First title
 * @param title2 Second title
 * @returns Similarity score (0-1)
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const s1 = title1.toLowerCase();
  const s2 = title2.toLowerCase();
  
  // Check for exact match
  if (s1 === s2) return 1;
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.9;
  
  // Check for word-level matches
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  const commonWords = words1.filter(word => words2.includes(word)).length;
  const totalWords = Math.max(words1.length, words2.length);
  
  const wordSimilarity = totalWords > 0 ? commonWords / totalWords : 0;
  
  // Weight word similarity slightly higher for job titles
  return wordSimilarity * 0.8;
}