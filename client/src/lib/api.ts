/**
 * API client utilities and type definitions
 */

export interface Job {
  id: number;
  jobId: string;
  title: string;
  description: string;
  createdAt: string;
  status: 'active' | 'reviewing' | 'closed';
  createdBy: number | null;
}

export interface Candidate {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  location: string;
  workAuthorization: string;
  dateOfBirth: string;
  createdAt: string;
  resumeText?: string;
  resumeFileName?: string;
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  isUnreal?: boolean;
  unrealReason?: string;
  similarityScore?: number;
  similarCandidateIds?: number[];
}

export interface Submission {
  id: number;
  jobId: number;
  candidateId: number;
  recruiterId: number;
  status: string;
  submittedAt: string;
  updatedAt: string;
  matchScore?: number;
  matchStrengths?: string[];
  matchWeaknesses?: string[];
  matchSuggestions?: string[];
}

/**
 * General-purpose API request function
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const response = await fetch(url, {
    ...defaultOptions,
    ...options,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || `API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}