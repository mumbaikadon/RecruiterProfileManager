/**
 * Resume Data Transformer
 * 
 * This utility transforms flat resume data arrays into structured objects
 * for display in the UI. It doesn't modify the database schema or API,
 * just transforms the data on the client side.
 */

export interface StructuredResumeData {
  experience: Array<{
    company: string;
    title: string;
    period: string;
  }>;
  skills: {
    technical: string[];
    soft: string[];
    certifications: string[];
    publications: string[];
  };
  education: string[];
  workExperience?: Array<{
    position: string;
    company: string;
    dates: string;
    responsibilities: string[];
  }>;
}

/**
 * Transforms flat resume data arrays into structured format for UI display
 */
export function transformResumeData(resumeData: any): StructuredResumeData {
  if (!resumeData) {
    return {
      experience: [],
      skills: {
        technical: [],
        soft: [],
        certifications: []
      },
      education: []
    };
  }

  // Extract employment history
  const experience = [];
  const maxLength = Math.max(
    resumeData.clientNames?.length || 0,
    resumeData.jobTitles?.length || 0,
    resumeData.relevantDates?.length || 0
  );

  for (let i = 0; i < maxLength; i++) {
    experience.push({
      company: resumeData.clientNames?.[i] || "",
      title: resumeData.jobTitles?.[i] || "",
      period: resumeData.relevantDates?.[i] || ""
    });
  }

  // Create work experience in the format expected by WorkExperienceCard
  const workExperience = experience.map(item => ({
    position: item.title,
    company: item.company,
    dates: item.period,
    responsibilities: [] // No responsibilities in flat format
  }));

  // Format skills
  // Handle different skill types
  const skills = {
    technical: Array.isArray(resumeData.skills) ? resumeData.skills : [],
    soft: Array.isArray(resumeData.softSkills) ? resumeData.softSkills : [],
    certifications: Array.isArray(resumeData.certifications) ? resumeData.certifications : [],
    publications: Array.isArray(resumeData.publications) ? resumeData.publications : []
  };

  // If we have a skills object already structured, use that
  if (resumeData.skills && typeof resumeData.skills === 'object' && !Array.isArray(resumeData.skills)) {
    skills.technical = resumeData.skills.technical || skills.technical;
    skills.soft = resumeData.skills.soft || skills.soft;
    skills.certifications = resumeData.skills.certifications || skills.certifications;
    skills.publications = resumeData.skills.publications || skills.publications;
  }

  // Use education as is - it's already in the expected format
  const education = resumeData.education || [];

  return {
    experience,
    workExperience,
    skills,
    education
  };
}