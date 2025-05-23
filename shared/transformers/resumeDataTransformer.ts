/**
 * Resume Data Transformer
 * Transforms resume data between database format (flat arrays) and UI format (structured objects)
 */
export {}

export interface DatabaseResumeData {
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  skills?: string[];
  education?: string[];
  extractedText?: string;
  fileName?: string;
  uploadedAt?: Date;
}

export interface StructuredResumeData {
  experience: Array<{
    company: string;
    position: string;
    dates: string;
    responsibilities: string[];
  }>;
  skills: {
    technical: string[];
    soft: string[];
    certifications: string[];
  };
  education: Array<{
    degree: string;
    institution: string;
    year: string;
  }>;
  projects?: Array<{
    name: string;
    description: string;
    technologies: string[];
  }>;
}

/**
 * Transform flat database resume data into structured UI format
 */
export function transformDatabaseToUIFormat(dbData: DatabaseResumeData): StructuredResumeData {
  // Default empty structure
  const defaultStructure: StructuredResumeData = {
    experience: [],
    skills: {
      technical: [],
      soft: [],
      certifications: []
    },
    education: []
  };

  // If no data, return default structure
  if (!dbData) return defaultStructure;

  // Transform experience data (combine company, title, dates)
  const experience = [];
  const maxLength = Math.max(
    dbData.clientNames?.length || 0,
    dbData.jobTitles?.length || 0,
    dbData.relevantDates?.length || 0
  );

  for (let i = 0; i < maxLength; i++) {
    experience.push({
      company: dbData.clientNames?.[i] || "",
      position: dbData.jobTitles?.[i] || "",
      dates: dbData.relevantDates?.[i] || "",
      responsibilities: [] // No responsibilities in flat format
    });
  }

  // Transform skills (categorize skills into technical/soft/certifications)
  const allSkills = dbData.skills || [];
  
  // Enhanced heuristic: expanded technical keywords for better detection
  const technicalKeywords = [
    'java', 'python', 'javascript', 'typescript', 'react', 'node', '.net', 'c#', 'c++', 'c', 'php',
    'sql', 'database', 'aws', 'cloud', 'docker', 'kubernetes', 'ai', 'ml', 'css', 'html',
    'express', 'angular', 'next.js', 'nest.js', 'bootstrap', 'tailwind', 'material-ui', 'webpack',
    'redux', 'graphql', 'mongodb', 'mysql', 'postgresql', 'dynamodb', 'nosql', 'rest', 'api',
    'git', 'jenkins', 'github', 'circleci', 'datadog', 'terraform', 'serverless', 'kafka', 'redis',
    'spring', 'boot', 'testing', 'jest', 'cypress', 'junit', 'selenium', 'devops', 'ci/cd', 'agile',
    'framework', 'library', 'architecture', 'component', 'front-end', 'back-end', 'full-stack',
    'microservice', 'mvc', 'orm', 'responsive', 'design', 'frontend', 'backend', 'development'
  ];
  
  // Enhanced heuristic: expanded soft skill keywords
  const softSkillKeywords = [
    'communication', 'leadership', 'teamwork', 'problem-solving', 'time management', 
    'collaboration', 'adaptability', 'creativity', 'critical thinking', 'presentation', 'organization',
    'management', 'mentoring', 'coordination', 'planning', 'analytical', 'negotiation', 'conflict',
    'documentation', 'reporting', 'prioritization', 'attention to detail', 'multitasking'
  ];
  
  // Enhanced heuristic: expanded certification keywords and patterns
  const certificationKeywords = [
    'certified', 'certificate', 'certification', 'license', 'aws certified', 'microsoft certified', 
    'oracle certified', 'pmp', 'scrum', 'itil', 'cissp', 'cisa', 'openjs', 'jsnad', 'practitioner', 'advanced',
    'foundation', 'professional', 'associate', 'expert', 'specialist', 'credential', 'accreditation',
    'badge', 'diploma', 'qualification'
  ];

  // First check for specific certifications in entire list - if entry starts with a certification-like keyword or contains specific patterns
  const certificationPattern = /^(certified|certificate in|certification in|license in|advanced|professional|associate|foundation)/i;
  const certificationPatternAnywhere = /(certified|certification|certificate|credential|qualification|accreditation)/i;
  
  // Find certification-like skills
  const certSkills = allSkills.filter(skill => 
    certificationPattern.test(skill) || 
    certificationKeywords.some(keyword => skill.toLowerCase().includes(keyword)) ||
    // Check for patterns that look like certifications (e.g., "OpenJS Node.js Application Developer")
    (skill.includes('Developer') && certificationPatternAnywhere.test(skill))
  );
  
  // Remove certifications from further classification
  const nonCertSkills = allSkills.filter(skill => !certSkills.includes(skill));
  
  // Find technical and soft skills
  const techSkills = nonCertSkills.filter(skill => 
    technicalKeywords.some(keyword => skill.toLowerCase().includes(keyword))
  );
  
  const softSkills = nonCertSkills.filter(skill => 
    softSkillKeywords.some(keyword => skill.toLowerCase().includes(keyword))
  );
  
  // Find any remaining skills that weren't categorized
  const categorized = [...techSkills, ...softSkills, ...certSkills];
  const otherSkills = allSkills.filter(skill => !categorized.includes(skill));
  
  // Create the final skills object
  const skills = {
    technical: [...techSkills, ...otherSkills], // Uncategorized skills default to technical
    soft: softSkills,
    certifications: certSkills
  };

  // Transform education data
  const education = (dbData.education || []).map(edu => {
    // Try to parse education string using multiple patterns
    
    // Pattern 1: "Degree, Institution, Year" or "Degree from Institution, Year"
    const standardPattern = /^(.*?)(?:,|\sfrom\s|\sat\s)(.*?)(?:,|\s)(\d{4}|\d{4}-\d{4}|\d{4}-\d{2})$/i;
    const degreeMatch = edu.match(standardPattern);
    
    if (degreeMatch && degreeMatch.length >= 4) {
      return {
        degree: degreeMatch[1].trim(),
        institution: degreeMatch[2].trim(),
        year: degreeMatch[3].trim()
      };
    }
    
    // Pattern 2: "Degree | Institution" followed by "Year" info (typical resume format)
    const pipePattern = /(.*?)\s*\|\s*(.*?)(?:\s+|$)(.*)/i;
    const pipeMatch = edu.match(pipePattern);
    
    if (pipeMatch && pipeMatch.length >= 3) {
      // Extract year from the remaining text
      const yearPattern = /.*?(\d{4}(?:\s*-\s*\d{4}|\s*-\s*\d{2})?)/;
      const yearMatch = pipeMatch[3] ? pipeMatch[3].match(yearPattern) : null;
      
      return {
        degree: pipeMatch[1].trim(),
        institution: pipeMatch[2].trim(),
        year: yearMatch && yearMatch[1] ? yearMatch[1].trim() : pipeMatch[3] ? pipeMatch[3].trim() : ""
      };
    }
    
    // Pattern 3: Try to identify degree, institution, and date in any order
    const degreeKeywords = /bachelor|master|ms|bs|ba|phd|diploma|certification|degree|b\.tech|m\.tech|b\.s\.|m\.s\./i;
    const yearPattern = /\b(19|20)\d{2}(?:\s*-\s*(?:19|20)?\d{2,4})?\b/;
    
    const hasDegree = degreeKeywords.test(edu);
    const yearMatch = edu.match(yearPattern);
    
    if (hasDegree) {
      // Split by common separators and try to identify parts
      const parts = edu.split(/[,|]/);
      let degree = "", institution = "", year = "";
      
      parts.forEach(part => {
        const trimmed = part.trim();
        if (degreeKeywords.test(trimmed) && !degree) {
          degree = trimmed;
        } else if (yearPattern.test(trimmed) && !year) {
          const match = trimmed.match(yearPattern);
          year = match ? match[0] : '';
        } else if (!institution && trimmed) {
          institution = trimmed;
        }
      });
      
      return {
        degree: degree || parts[0]?.trim() || "",
        institution: institution || "",
        year: year || (yearMatch ? yearMatch[0] : "")
      };
    }
    
    // Fallback: just use the full string as degree
    return {
      degree: edu,
      institution: "",
      year: ""
    };
  });

  return {
    experience,
    skills,
    education
  };
}

/**
 * Transform structured UI resume data into flat database format
 */
export function transformUIToDatabaseFormat(uiData: StructuredResumeData): DatabaseResumeData {
  if (!uiData) return {};

  // Extract client names from experience
  const clientNames = uiData.experience?.map(exp => exp.company) || [];
  
  // Extract job titles from experience
  const jobTitles = uiData.experience?.map(exp => exp.position) || [];
  
  // Extract dates from experience
  const relevantDates = uiData.experience?.map(exp => exp.dates) || [];
  
  // Combine all skills into a single array
  const skills = [
    ...(uiData.skills?.technical || []),
    ...(uiData.skills?.soft || []),
    ...(uiData.skills?.certifications || [])
  ];
  
  // Format education entries
  const education = uiData.education?.map(edu => 
    `${edu.degree}, ${edu.institution}, ${edu.year}`.trim().replace(/, $/, "")
  ) || [];

  return {
    clientNames,
    jobTitles,
    relevantDates,
    skills,
    education
  };
}