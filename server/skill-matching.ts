/**
 * Skill Matching Module
 * 
 * This module provides advanced skill matching capabilities with recognition of
 * related technologies, skill levels, and transferable skills.
 */

// Define skill clusters (related technologies that share similar concepts)
export const skillClusters: Record<string, string[]> = {
  // Frontend frameworks
  "React": ["React.js", "React Native", "Redux", "Flux", "JSX"],
  "Angular": ["AngularJS", "Angular 2+", "Angular Material", "NgRx"],
  "Vue": ["Vue.js", "Vuex", "Vue Router", "Nuxt.js"],
  
  // JavaScript ecosystem
  "JavaScript": ["ES6", "ES2015+", "TypeScript", "CoffeeScript", "Babel", "Webpack", "Rollup", "Parcel"],
  "TypeScript": ["JavaScript", "ES6", "Type Systems", "Interface Design"],
  
  // CSS frameworks/approaches
  "CSS": ["SCSS", "SASS", "LESS", "Styled Components", "CSS Modules", "Tailwind", "Bootstrap", "Material UI"],
  
  // Backend languages
  "Java": ["Spring", "Spring Boot", "Hibernate", "J2EE", "Kotlin", "Scala", "JUnit", "Maven", "Gradle"],
  "Python": ["Django", "Flask", "FastAPI", "PyTorch", "TensorFlow", "NumPy", "Pandas", "Scikit-learn"],
  ".NET": ["C#", "ASP.NET", "VB.NET", "Entity Framework", "LINQ", "WPF", "WCF"],
  "PHP": ["Laravel", "Symfony", "WordPress", "CodeIgniter", "CakePHP"],
  "Ruby": ["Rails", "Sinatra", "RSpec"],
  "Node.js": ["Express", "Koa", "Nest.js", "Fastify", "Hapi"],
  
  // Mobile development
  "iOS": ["Swift", "Objective-C", "UIKit", "SwiftUI", "Core Data"],
  "Android": ["Kotlin", "Java", "Android SDK", "Jetpack Compose", "Room"],
  "Mobile": ["React Native", "Flutter", "Xamarin", "Ionic", "Cordova"],
  
  // Databases
  "SQL": ["MySQL", "PostgreSQL", "SQL Server", "Oracle", "SQLite", "MariaDB"],
  "NoSQL": ["MongoDB", "DynamoDB", "Cassandra", "Firebase", "Redis", "Elasticsearch"],
  "GraphQL": ["Apollo", "Relay", "Prisma"],
  
  // DevOps and Cloud
  "AWS": ["EC2", "S3", "Lambda", "DynamoDB", "CloudFormation", "ECS", "EKS"],
  "Azure": ["App Service", "Azure Functions", "Cosmos DB", "Azure DevOps"],
  "GCP": ["Google Compute Engine", "App Engine", "BigQuery", "Firestore"],
  "DevOps": ["Docker", "Kubernetes", "CI/CD", "Jenkins", "GitHub Actions", "CircleCI", "Terraform", "Ansible", "Chef", "Puppet"],
  
  // AI/ML
  "Machine Learning": ["TensorFlow", "PyTorch", "Scikit-learn", "Keras", "Deep Learning", "Neural Networks", "Computer Vision", "NLP"],
  "Data Science": ["Python", "R", "Pandas", "NumPy", "Jupyter", "Matplotlib", "Data Analysis", "Statistical Analysis"],
  
  // Architecture patterns
  "Microservices": ["API Gateway", "Service Mesh", "Event-Driven Architecture", "Serverless"],
  "Web Services": ["REST", "SOAP", "GraphQL", "gRPC", "API Design"],
  
  // Testing
  "Testing": ["Unit Testing", "Integration Testing", "TDD", "BDD", "Automated Testing", "Jest", "Mocha", "Selenium", "Cypress"]
};

// Define transferable skills (skills from one domain that indicate capability in another)
export const transferableSkills: Record<string, string[]> = {
  "Java": ["C#", "Kotlin", "Scala"], // Object-oriented languages with similar concepts
  "React": ["Angular", "Vue"], // Component-based frontend frameworks
  "AWS": ["Azure", "GCP"], // Cloud platforms with similar service concepts
  "SQL Server": ["MySQL", "PostgreSQL", "Oracle"], // Relational databases
  "NoSQL": ["MongoDB", "DynamoDB", "Cassandra"], // Document databases
  "CI/CD": ["Jenkins", "GitHub Actions", "CircleCI", "GitLab CI"], // Continuous integration
  "Docker": ["Containerization", "Kubernetes"], // Container technologies
  "Python": ["R", "Julia"], // Data science languages
  "iOS": ["Mobile Development", "Android"], // Mobile platforms
  "TensorFlow": ["PyTorch", "Keras"] // Machine learning frameworks
};

// Define approximate skill levels and weightings
export const skillLevels: Record<string, number> = {
  "Beginner": 0.5,
  "Basic": 0.6,
  "Intermediate": 0.8,
  "Advanced": 1.0,
  "Expert": 1.2,
  "Master": 1.3
};

// Define cutting-edge vs legacy technology weightings
export const technologyRelevance: Record<string, number> = {
  // Cutting-edge (higher weight)
  "React": 1.2,
  "Vue": 1.2,
  "TypeScript": 1.2,
  "GraphQL": 1.3,
  "Kubernetes": 1.3,
  "Microservices": 1.2,
  "Serverless": 1.3,
  "TensorFlow": 1.3,
  "PyTorch": 1.3,
  "Docker": 1.2,
  "Swift": 1.2,
  "Kotlin": 1.2,
  "Flutter": 1.3,
  
  // Standard (neutral weight)
  "JavaScript": 1.0,
  "Java": 1.0,
  "Python": 1.0,
  "SQL": 1.0,
  "AWS": 1.0,
  "C#": 1.0,
  
  // Legacy (lower weight)
  "jQuery": 0.8,
  "PHP": 0.9,
  "AngularJS": 0.7,
  "Objective-C": 0.8,
  "SOAP": 0.7,
  "JSP": 0.7,
  "Perl": 0.7,
  "VB.NET": 0.8
};

/**
 * Extract skills from text using improved NLP techniques
 * @param text Text to extract skills from
 * @returns Array of extracted skills
 */
export function extractSkills(text: string): string[] {
  if (!text) return [];
  
  // This is a simplified implementation - in a real system, you'd use NLP libraries
  // or ML models to identify skill phrases more accurately
  
  // For now, we'll use a list-based approach with common tech terms
  const normalized = text.toLowerCase();
  const skills: string[] = [];
  
  // Check for each skill cluster and its related skills
  for (const [primarySkill, relatedSkills] of Object.entries(skillClusters)) {
    // Check for the primary skill
    if (containsSkill(normalized, primarySkill)) {
      skills.push(primarySkill);
    }
    
    // Check for related skills
    for (const related of relatedSkills) {
      if (containsSkill(normalized, related)) {
        skills.push(related);
      }
    }
  }
  
  // Deduplicate
  return Array.from(new Set(skills));
}

/**
 * Check if text contains a specific skill
 * @param normalizedText Normalized text to check
 * @param skill Skill to look for
 * @returns True if the skill is found
 */
function containsSkill(normalizedText: string, skill: string): boolean {
  const normalizedSkill = skill.toLowerCase();
  
  // Check for exact matches (bounded by non-word characters)
  const exactRegex = new RegExp(`\\b${normalizedSkill}\\b`, 'i');
  if (exactRegex.test(normalizedText)) {
    return true;
  }
  
  // For compound phrases, check if most parts are present
  if (normalizedSkill.includes(' ')) {
    const parts = normalizedSkill.split(' ');
    // If more than half of the parts are present, consider it a match
    let matchCount = 0;
    for (const part of parts) {
      if (part.length > 3 && normalizedText.includes(part)) {
        matchCount++;
      }
    }
    return matchCount >= Math.ceil(parts.length / 2);
  }
  
  return false;
}

/**
 * Find related skills for a given skill
 * @param skill The skill to find related skills for
 * @returns Array of related skills
 */
export function getRelatedSkills(skill: string): string[] {
  const normalizedSkill = skill.toLowerCase();
  
  // Check skill clusters
  for (const [primarySkill, relatedSkills] of Object.entries(skillClusters)) {
    if (primarySkill.toLowerCase() === normalizedSkill) {
      return relatedSkills;
    }
    
    if (relatedSkills.some(s => s.toLowerCase() === normalizedSkill)) {
      return [primarySkill, ...relatedSkills.filter(s => s.toLowerCase() !== normalizedSkill)];
    }
  }
  
  // Check transferable skills
  for (const [fromSkill, toSkills] of Object.entries(transferableSkills)) {
    if (fromSkill.toLowerCase() === normalizedSkill) {
      return toSkills;
    }
    
    if (toSkills.some(s => s.toLowerCase() === normalizedSkill)) {
      return [fromSkill, ...toSkills.filter(s => s.toLowerCase() !== normalizedSkill)];
    }
  }
  
  return [];
}

/**
 * Calculate enhanced skill match between job requirements and candidate skills
 * @param jobDescription Job description text
 * @param candidateSkills Array of candidate skills
 * @param clientFocus Client focus areas (weighted more heavily)
 * @returns Match score and details
 */
export function calculateEnhancedSkillMatch(
  jobDescription: string,
  candidateSkills: string[],
  clientFocus: string | null
): { 
  score: number; 
  matchedSkills: string[]; 
  partialMatches: Array<{skill: string, relatedTo: string, weight: number}>;
  missingSkills: string[];
  clientFocusMatches: string[];
} {
  if (!jobDescription || !candidateSkills || candidateSkills.length === 0) {
    return { 
      score: 0, 
      matchedSkills: [], 
      partialMatches: [],
      missingSkills: [],
      clientFocusMatches: []
    };
  }
  
  // Extract job skills using improved NLP-based extraction
  const jobSkills = extractSkills(jobDescription);
  
  // Extract client focus skills
  const clientFocusSkills = clientFocus ? extractSkills(clientFocus) : [];
  
  // Normalize candidate skills
  const normalizedCandidateSkills = candidateSkills.map(s => s.toLowerCase());
  
  // Categorize matches
  const directMatches: string[] = [];
  const partialMatches: Array<{skill: string, relatedTo: string, weight: number}> = [];
  const allMatchedJobSkills = new Set<string>();
  
  // Check for direct matches
  for (const jobSkill of jobSkills) {
    const normalizedJobSkill = jobSkill.toLowerCase();
    
    // Direct match
    if (normalizedCandidateSkills.some(s => s === normalizedJobSkill)) {
      directMatches.push(jobSkill);
      allMatchedJobSkills.add(jobSkill);
      continue;
    }
    
    // Check for related/transferable skills
    for (const candidateSkill of normalizedCandidateSkills) {
      // Check if candidate skill is related to this job skill
      const relatedSkills = getRelatedSkills(jobSkill);
      if (relatedSkills.some(s => s.toLowerCase() === candidateSkill)) {
        partialMatches.push({
          skill: candidateSkill,
          relatedTo: jobSkill,
          weight: 0.7 // Partial credit for related skill
        });
        allMatchedJobSkills.add(jobSkill);
        break;
      }
      
      // Check if job skill is related to this candidate skill
      const candidateRelatedSkills = getRelatedSkills(candidateSkill);
      if (candidateRelatedSkills.some(s => s.toLowerCase() === normalizedJobSkill)) {
        partialMatches.push({
          skill: candidateSkill,
          relatedTo: jobSkill,
          weight: 0.7 // Partial credit for related skill
        });
        allMatchedJobSkills.add(jobSkill);
        break;
      }
    }
  }
  
  // Identify client focus matches
  const clientFocusMatches = directMatches.filter(skill => 
    clientFocusSkills.some(focusSkill => 
      skill.toLowerCase() === focusSkill.toLowerCase()
    )
  );
  
  // Identify missing skills
  const missingSkills = jobSkills.filter(skill => !allMatchedJobSkills.has(skill));
  
  // Calculate weighted score
  let totalScore = 0;
  let possibleScore = 0;
  
  // Weight each job skill
  for (const skill of jobSkills) {
    // Check if this is a client focus skill (higher weight)
    const isClientFocus = clientFocusSkills.some(
      focus => focus.toLowerCase() === skill.toLowerCase()
    );
    
    // Base weight for the skill
    let skillWeight = 1.0;
    
    // Apply technology relevance factor
    for (const [tech, weight] of Object.entries(technologyRelevance)) {
      if (skill.toLowerCase().includes(tech.toLowerCase())) {
        skillWeight *= weight;
        break;
      }
    }
    
    // Increase weight for client focus skills
    if (isClientFocus) {
      skillWeight *= 2.0; // Double weight for client focus
    }
    
    possibleScore += skillWeight;
    
    // Add to total if matched
    if (directMatches.includes(skill)) {
      totalScore += skillWeight; // Full credit
    } else {
      // Check for partial matches
      const partialMatch = partialMatches.find(m => m.relatedTo === skill);
      if (partialMatch) {
        totalScore += skillWeight * partialMatch.weight; // Partial credit
      }
    }
  }
  
  // Calculate final score (0-1)
  const finalScore = possibleScore > 0 ? Math.min(1, totalScore / possibleScore) : 0;
  
  return {
    score: finalScore,
    matchedSkills: directMatches,
    partialMatches,
    missingSkills,
    clientFocusMatches
  };
}