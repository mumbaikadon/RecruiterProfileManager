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
  softSkills?: string[];
  certifications?: string[];
  publications?: string[];
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
    publications: string[];
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
      certifications: [],
      publications: []
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

  // Process technical skills
  const allSkills = dbData.skills || [];
  
  // Process soft skills directly from database if available
  const allSoftSkills = dbData.softSkills || [];
  
  // Process certifications directly from database if available
  const allCertifications = dbData.certifications || [];
  
  // Process publications directly from database if available  
  const allPublications = dbData.publications || [];
  
  // Simple heuristic: assuming skills with technical keywords are technical
  const technicalKeywords = ['java', 'python', 'javascript', 'typescript', 'react', 'node', '.net', 'c#', 'c++', 
    'sql', 'database', 'aws', 'cloud', 'docker', 'kubernetes', 'ai', 'ml', 'css', 'html'];
  
  // Simple heuristic: assuming skills with soft skill keywords are soft
  const softSkillKeywords = ['communication', 'leadership', 'teamwork', 'problem-solving', 'time management', 
    'collaboration', 'adaptability', 'creativity', 'critical thinking', 'presentation', 'organization'];
  
  // Simple heuristic: assuming skills with certification keywords are certifications
  const certificationKeywords = ['certified', 'certificate', 'certification', 'license', 'aws certified', 
    'microsoft certified', 'oracle certified', 'pmp', 'scrum', 'itil', 'cissp', 'cisa'];

  // Create skills object with all categories
  const skills = {
    technical: allSkills.filter(skill => 
      technicalKeywords.some(keyword => skill.toLowerCase().includes(keyword))
    ),
    soft: allSoftSkills.length > 0 ? 
      allSoftSkills : 
      allSkills.filter(skill => 
        softSkillKeywords.some(keyword => skill.toLowerCase().includes(keyword))
      ),
    certifications: allCertifications.length > 0 ? 
      allCertifications : 
      allSkills.filter(skill => 
        certificationKeywords.some(keyword => skill.toLowerCase().includes(keyword))
      ),
    publications: allPublications
  };

  // Add remaining skills to technical (default category)
  const categorizedSkills = [...skills.technical, ...skills.soft, ...skills.certifications];
  const remainingSkills = allSkills.filter(skill => !categorizedSkills.includes(skill));
  skills.technical = [...skills.technical, ...remainingSkills];

  // Transform education data
  const education = (dbData.education || []).map(edu => {
    // Try to parse education string into components - First attempt
    // Common formats: "Degree, Institution, Year" or "Degree from Institution, Year"
    let degreeMatch = edu.match(/^(.*?)(?:,|\sfrom\s|\sat\s)(.*?)(?:,|\s)(\d{4}|\d{4}-\d{4}|\d{4}-\d{2})$/i);
    
    if (degreeMatch && degreeMatch.length >= 4) {
      return {
        degree: degreeMatch[1].trim(),
        institution: degreeMatch[2].trim(),
        year: degreeMatch[3].trim()
      };
    }
    
    // Second attempt - For formats like "Master's in Computer Science University of Missouri, Kansas City, May 2023"
    degreeMatch = edu.match(/(Master\'s|Bachelor\'s|Associate\'s|Ph\.D\.|Doctorate|MBA)(\sin\s|\sof\s)(.*?)(University|College|Institute|School)(.*?)(May|June|July|August|September|October|November|December|January|February|March|April)(\s)(\d{4})/i);
    
    if (degreeMatch && degreeMatch.length >= 8) {
      const degree = `${degreeMatch[1]}${degreeMatch[2]}${degreeMatch[3]}`.trim();
      const institution = `${degreeMatch[4]}${degreeMatch[5]}`.trim();
      const year = `${degreeMatch[6]} ${degreeMatch[8]}`.trim();
      
      return {
        degree: degree,
        institution: institution,
        year: year
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
  
  // Extract technical skills
  const skills = uiData.skills?.technical || [];
  
  // Extract soft skills separately
  const softSkills = uiData.skills?.soft || [];
  
  // Extract certifications separately
  const certifications = uiData.skills?.certifications || [];
  
  // Extract publications separately
  const publications = uiData.skills?.publications || [];
  
  // Format education entries
  const education = uiData.education?.map(edu => 
    `${edu.degree}, ${edu.institution}, ${edu.year}`.trim().replace(/, $/, "")
  ) || [];

  return {
    clientNames,
    jobTitles,
    relevantDates,
    skills,
    softSkills,
    certifications,
    publications,
    education
  };
}