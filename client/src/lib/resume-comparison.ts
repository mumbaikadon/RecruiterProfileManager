/**
 * Utility functions for comparing candidate resume data between submissions
 * This reuses the logic from our validation system in a focused way
 */

/**
 * Finds items that are in the new array but not in the original
 */
export function findNewItems(original: string[] | null, updated: string[] | null): string[] {
  if (!original || !updated) return [];
  return updated.filter(item => !original.includes(item));
}

/**
 * Finds items that are in the original array but not in the updated one
 */
export function findRemovedItems(original: string[] | null, updated: string[] | null): string[] {
  if (!original || !updated) return [];
  return original.filter(item => !updated.includes(item));
}

/**
 * Identifies matching entries between client names, job titles, and dates
 * to find where job titles or dates have changed for the same employer
 */
export function findChangedTitles(
  originalClients: string[] | null, 
  originalTitles: string[] | null,
  updatedClients: string[] | null, 
  updatedTitles: string[] | null
): Array<{employer: string, old: string, new: string}> {
  if (!originalClients || !originalTitles || !updatedClients || !updatedTitles) {
    return [];
  }

  const changes: Array<{employer: string, old: string, new: string}> = [];
  
  // Look for employers that exist in both sets
  originalClients.forEach((employer, index) => {
    const updatedIndex = updatedClients.findIndex(c => c === employer);
    
    // If this employer exists in both old and new resume data
    if (updatedIndex !== -1) {
      const originalTitle = originalTitles[index];
      const updatedTitle = updatedTitles[updatedIndex];
      
      // If the job title changed
      if (originalTitle !== updatedTitle) {
        changes.push({
          employer,
          old: originalTitle,
          new: updatedTitle
        });
      }
    }
  });
  
  return changes;
}

/**
 * Identifies matching entries between client names and dates
 * to find where dates have changed for the same employer
 */
export function findChangedDates(
  originalClients: string[] | null, 
  originalDates: string[] | null,
  updatedClients: string[] | null, 
  updatedDates: string[] | null
): Array<{employer: string, old: string, new: string}> {
  if (!originalClients || !originalDates || !updatedClients || !updatedDates) {
    return [];
  }

  const changes: Array<{employer: string, old: string, new: string}> = [];
  
  // Look for employers that exist in both sets
  originalClients.forEach((employer, index) => {
    const updatedIndex = updatedClients.findIndex(c => c === employer);
    
    // If this employer exists in both old and new resume data
    if (updatedIndex !== -1) {
      const originalDate = originalDates[index];
      const updatedDate = updatedDates[updatedIndex];
      
      // If the date range changed
      if (originalDate !== updatedDate) {
        changes.push({
          employer,
          old: originalDate,
          new: updatedDate
        });
      }
    }
  });
  
  return changes;
}

/**
 * Evaluate the overall risk level of the changes between resume versions
 */
export function evaluateRiskLevel(
  newEmployers: string[],
  removedEmployers: string[],
  changedDates: Array<{employer: string, old: string, new: string}>,
  changedTitles: Array<{employer: string, old: string, new: string}>
): 'none' | 'low' | 'medium' | 'high' {
  // Removed employers is suspicious - high risk
  if (removedEmployers.length > 1) {
    return 'high';
  }
  
  // Multiple changed dates is suspicious - medium to high risk
  if (changedDates.length > 1) {
    return changedDates.length > 2 ? 'high' : 'medium';
  }
  
  // One removed employer plus other changes - medium risk
  if (removedEmployers.length === 1 && (changedDates.length > 0 || changedTitles.length > 0)) {
    return 'medium';
  }
  
  // Changed job titles - low to medium risk
  if (changedTitles.length > 0) {
    return changedTitles.length > 2 ? 'medium' : 'low';
  }
  
  // Only added new employers - expected normal behavior - low risk
  if (newEmployers.length > 0 && removedEmployers.length === 0 && 
      changedDates.length === 0 && changedTitles.length === 0) {
    return 'low';
  }
  
  // Small changes or no changes
  return removedEmployers.length > 0 || changedDates.length > 0 ? 'low' : 'none';
}

/**
 * Compare two versions of a candidate's resume data
 * This reuses the validation logic from our fraud detection
 * but applies it to comparing a candidate's own submission history
 */
export function compareResumeVersions(previous: {
  clientNames: string[] | null;
  jobTitles: string[] | null;
  relevantDates: string[] | null;
}, current: {
  clientNames: string[] | null;
  jobTitles: string[] | null;
  relevantDates: string[] | null;
}) {
  // Find added and removed employers
  const newEmployers = findNewItems(previous.clientNames, current.clientNames);
  const removedEmployers = findRemovedItems(previous.clientNames, current.clientNames);
  
  // Find changed dates and job titles
  const changedDates = findChangedDates(
    previous.clientNames,
    previous.relevantDates,
    current.clientNames,
    current.relevantDates
  );
  
  const changedTitles = findChangedTitles(
    previous.clientNames,
    previous.jobTitles,
    current.clientNames,
    current.jobTitles
  );
  
  // Determine if there are any meaningful changes
  const hasChanges = newEmployers.length > 0 || 
                     removedEmployers.length > 0 || 
                     changedDates.length > 0 || 
                     changedTitles.length > 0;
  
  // Calculate risk level
  const overallRisk = evaluateRiskLevel(
    newEmployers,
    removedEmployers,
    changedDates,
    changedTitles
  );
  
  return {
    hasChanges,
    newEmployers,
    removedEmployers,
    changedDates,
    changedTitles,
    overallRisk
  };
}