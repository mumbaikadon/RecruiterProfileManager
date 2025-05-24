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

  // Handle both array and null cases safely
  const clientNames = Array.isArray(resumeData.clientNames) ? resumeData.clientNames : [];
  const jobTitles = Array.isArray(resumeData.jobTitles) ? resumeData.jobTitles : [];
  const relevantDates = Array.isArray(resumeData.relevantDates) ? resumeData.relevantDates : [];
  
  // Extract employment history
  const experience = [];
  const maxLength = Math.max(
    clientNames.length,
    jobTitles.length,
    relevantDates.length
  );

  // Only create experience entries if we actually have data
  if (maxLength > 0) {
    for (let i = 0; i < maxLength; i++) {
      // Only add non-empty entries
      const company = clientNames[i] || "";
      const title = jobTitles[i] || "";
      const period = relevantDates[i] || "";
      
      // Ensure we have at least some data for this entry
      if (company || title || period) {
        experience.push({
          company,
          title,
          period
        });
      }
    }
  }

  // Create work experience in the format expected by WorkExperienceCard
  const workExperience = experience.map(item => ({
    position: item.title,
    company: item.company,
    dates: item.period,
    responsibilities: [] // No responsibilities in flat format
  }));

  // Format skills
  // If the skills are already an array, use them as technical skills
  const skills = {
    technical: Array.isArray(resumeData.skills) ? resumeData.skills : [],
    soft: Array.isArray(resumeData.softSkills) ? resumeData.softSkills : [],
    certifications: Array.isArray(resumeData.certifications) ? resumeData.certifications : []
  };

  // Handle education data - ensure it's an array
  const education = Array.isArray(resumeData.education) ? resumeData.education : [];

  console.log("Transformed resume data:", {
    experienceCount: experience.length,
    educationCount: education.length,
    companies: clientNames,
    titles: jobTitles,
    dates: relevantDates
  });

  return {
    experience,
    workExperience,
    skills,
    education
  };
}