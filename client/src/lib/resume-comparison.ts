/**
 * Utility functions for comparing resume data to detect changes
 * Used during candidate resubmission to identify profile updates
 */

export interface ResumeData {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills?: string[];
  education?: string[];
}

export interface ResumeComparisonResult {
  hasChanges: boolean;
  addedClients: string[];
  removedClients: string[];
  addedJobTitles: string[];
  removedJobTitles: string[];
  addedDates: string[];
  removedDates: string[];
  addedSkills: string[];
  removedSkills: string[];
  addedEducation: string[];
  removedEducation: string[];
  changesSummary: string;
  significantChanges: boolean; // Major profile alterations
}

/**
 * Compare two resume datasets and identify differences
 */
export function compareResumeData(
  existingData: ResumeData,
  newData: ResumeData
): ResumeComparisonResult {
  // Helper function to find differences between arrays
  const getArrayDifferences = (existing: string[], updated: string[]) => {
    const existingSet = new Set(existing.map(item => item.toLowerCase().trim()));
    const updatedSet = new Set(updated.map(item => item.toLowerCase().trim()));
    
    const added = updated.filter(item => !existingSet.has(item.toLowerCase().trim()));
    const removed = existing.filter(item => !updatedSet.has(item.toLowerCase().trim()));
    
    return { added, removed };
  };

  // Compare each field
  const clientDiff = getArrayDifferences(existingData.clientNames || [], newData.clientNames || []);
  const jobTitleDiff = getArrayDifferences(existingData.jobTitles || [], newData.jobTitles || []);
  const datesDiff = getArrayDifferences(existingData.relevantDates || [], newData.relevantDates || []);
  const skillsDiff = getArrayDifferences(existingData.skills || [], newData.skills || []);
  const educationDiff = getArrayDifferences(existingData.education || [], newData.education || []);

  // Check if any changes were detected
  const hasChanges = 
    clientDiff.added.length > 0 || clientDiff.removed.length > 0 ||
    jobTitleDiff.added.length > 0 || jobTitleDiff.removed.length > 0 ||
    datesDiff.added.length > 0 || datesDiff.removed.length > 0 ||
    skillsDiff.added.length > 0 || skillsDiff.removed.length > 0 ||
    educationDiff.added.length > 0 || educationDiff.removed.length > 0;

  // Determine if changes are significant (major profile alterations)
  const significantChanges = 
    clientDiff.added.length > 0 || clientDiff.removed.length > 0 ||
    jobTitleDiff.added.length > 0 || jobTitleDiff.removed.length > 0 ||
    datesDiff.added.length > 0 || datesDiff.removed.length > 0;

  // Generate a summary of changes
  const changeSummary = generateChangesSummary({
    clientDiff,
    jobTitleDiff,
    datesDiff,
    skillsDiff,
    educationDiff
  });

  return {
    hasChanges,
    addedClients: clientDiff.added,
    removedClients: clientDiff.removed,
    addedJobTitles: jobTitleDiff.added,
    removedJobTitles: jobTitleDiff.removed,
    addedDates: datesDiff.added,
    removedDates: datesDiff.removed,
    addedSkills: skillsDiff.added,
    removedSkills: skillsDiff.removed,
    addedEducation: educationDiff.added,
    removedEducation: educationDiff.removed,
    changesSummary: changeSummary,
    significantChanges
  };
}

/**
 * Generate a human-readable summary of changes
 */
function generateChangesSummary(changes: {
  clientDiff: { added: string[]; removed: string[] };
  jobTitleDiff: { added: string[]; removed: string[] };
  datesDiff: { added: string[]; removed: string[] };
  skillsDiff: { added: string[]; removed: string[] };
  educationDiff: { added: string[]; removed: string[] };
}): string {
  const summaryParts: string[] = [];
  
  if (changes.clientDiff.added.length > 0) {
    summaryParts.push(`Added ${changes.clientDiff.added.length} new company/client`);
  }
  
  if (changes.clientDiff.removed.length > 0) {
    summaryParts.push(`Removed ${changes.clientDiff.removed.length} previous company/client`);
  }
  
  if (changes.jobTitleDiff.added.length > 0) {
    summaryParts.push(`Added ${changes.jobTitleDiff.added.length} new job title(s)`);
  }
  
  if (changes.jobTitleDiff.removed.length > 0) {
    summaryParts.push(`Removed ${changes.jobTitleDiff.removed.length} previous job title(s)`);
  }
  
  if (changes.datesDiff.added.length > 0) {
    summaryParts.push(`Added ${changes.datesDiff.added.length} new employment date(s)`);
  }
  
  if (changes.datesDiff.removed.length > 0) {
    summaryParts.push(`Removed ${changes.datesDiff.removed.length} previous employment date(s)`);
  }
  
  if (changes.skillsDiff.added.length > 0) {
    summaryParts.push(`Added ${changes.skillsDiff.added.length} new skill(s)`);
  }
  
  if (changes.skillsDiff.removed.length > 0) {
    summaryParts.push(`Removed ${changes.skillsDiff.removed.length} previous skill(s)`);
  }
  
  if (changes.educationDiff.added.length > 0) {
    summaryParts.push(`Added ${changes.educationDiff.added.length} new education entry`);
  }
  
  if (changes.educationDiff.removed.length > 0) {
    summaryParts.push(`Removed ${changes.educationDiff.removed.length} previous education entry`);
  }
  
  if (summaryParts.length === 0) {
    return "No significant changes detected";
  }
  
  return summaryParts.join(", ");
}

/**
 * Get significance level of changes for UI display
 */
export function getChangesSeverity(comparison: ResumeComparisonResult): "LOW" | "MEDIUM" | "HIGH" {
  if (!comparison.hasChanges) return "LOW";
  
  // Count total significant changes
  const significantChangeCount = 
    comparison.addedClients.length + comparison.removedClients.length +
    comparison.addedJobTitles.length + comparison.removedJobTitles.length +
    comparison.addedDates.length + comparison.removedDates.length;
  
  if (significantChangeCount >= 3) return "HIGH";
  if (significantChangeCount >= 1) return "MEDIUM";
  return "LOW";
}