/**
 * Resume Data Transform Middleware
 * Automatically transforms resume data between DB and UI formats
 */

import { transformDatabaseToUIFormat, DatabaseResumeData } from '../shared/transformers/resumeDataTransformer';
import { Candidate, ResumeData } from '@shared/schema';

interface StructuredSkills {
  technical: string[];
  soft: string[];
  certifications: string[];
}

interface ExperienceEntry {
  company: string;
  position: string;
  dates: string;
  responsibilities: string[];
}

interface EducationEntry {
  degree: string;
  institution: string;
  year: string;
}

interface CandidateWithResumeData extends Candidate {
  resumeData?: ResumeData & {
    experience?: ExperienceEntry[];
    skills?: StructuredSkills;
    education?: EducationEntry[];
  };
}

/**
 * Middleware to transform a candidate's resume data from DB format to UI format
 * @param candidate The candidate object from the database
 * @returns The candidate with transformed resume data
 */
export function transformCandidateResumeData(candidate: CandidateWithResumeData) {
  // If no candidate or no resume data, return as is
  if (!candidate || !candidate.resumeData) {
    return candidate;
  }

  try {
    // Get the DB format resume data
    const dbResumeData = {
      clientNames: candidate.resumeData.clientNames || [],
      jobTitles: candidate.resumeData.jobTitles || [],
      relevantDates: candidate.resumeData.relevantDates || [],
      skills: candidate.resumeData.skills || [],
      softSkills: candidate.resumeData.softSkills || [],
      certifications: candidate.resumeData.certifications || [],
      publications: candidate.resumeData.publications || [],
      education: candidate.resumeData.education || [],
      extractedText: candidate.resumeData.extractedText || '',
      fileName: candidate.resumeData.fileName || '',
      uploadedAt: candidate.resumeData.uploadedAt
    };

    // Transform to structured UI format
    const structuredResumeData = transformDatabaseToUIFormat(dbResumeData);

    // Create a new object to avoid modifying the original
    return {
      ...candidate,
      // Keep the original resume data for compatibility
      resumeData: {
        ...candidate.resumeData,
        // Add the structured data
        experience: structuredResumeData.experience || [],
        skills: structuredResumeData.skills || {
          technical: [],
          soft: [],
          certifications: [],
          publications: []
        },
        // Ensure education data is properly passed through
        // Use either the transformed education data or the raw education strings
        education: structuredResumeData.education && structuredResumeData.education.length > 0 
          ? structuredResumeData.education 
          : (candidate.resumeData.education || [])
      }
    };
  } catch (error) {
    console.error('Error transforming resume data:', error);
    // Return original data if transformation fails
    return candidate;
  }
}

/**
 * Middleware to transform multiple candidates' resume data
 * @param candidates Array of candidate objects from the database
 * @returns The candidates with transformed resume data
 */
export function transformCandidatesResumeData(candidates: any[]) {
  if (!candidates || !Array.isArray(candidates)) {
    return candidates;
  }

  return candidates.map(candidate => transformCandidateResumeData(candidate));
}