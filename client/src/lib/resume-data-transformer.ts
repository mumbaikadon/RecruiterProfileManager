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
  console.log("Raw education data from database:", resumeData.education);
  console.log("Is education data an array?", Array.isArray(resumeData.education));
  console.log("Education data type:", typeof resumeData.education);
  
  // If education data exists but isn't an array, try to parse it
  let education = [];
  if (resumeData.education) {
    if (Array.isArray(resumeData.education)) {
      education = resumeData.education;
      console.log("Education data is a proper array with length:", education.length);
    } else if (typeof resumeData.education === 'string') {
      // Try to parse JSON string if that's what we received
      try {
        const parsed = JSON.parse(resumeData.education);
        education = Array.isArray(parsed) ? parsed : [];
        console.log("Parsed education data from string:", education);
      } catch (e) {
        console.error("Failed to parse education data string:", e);
        education = [resumeData.education]; // Use as single item if not parseable
      }
    } else {
      console.warn("Unknown education data format:", resumeData.education);
    }
  } else {
    console.log("No education data found in resume");
  }

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