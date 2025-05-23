// Job type definition
export interface Job {
  id: number;
  jobId: string;
  title: string;
  description: string;
  city: string | null;
  state: string | null;
  jobType: "onsite" | "remote" | "hybrid" | null;
  clientName: string | null;
  clientFocus: string | null;
  status: "active" | "reviewing" | "closed";
  createdAt: Date;
  createdBy: number | null;
}

// Candidate type definition
export interface Candidate {
  id: number;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone: string;
  location?: string;
  workAuthorization: string;
  linkedIn?: string;
  dobMonth: number;
  dobDay: number;
  ssn4: string;
  willingToRelocate?: boolean;
  isUnreal?: boolean;
  unrealReason?: string;
  createdAt: string;
  resumeData?: ResumeData;
}

// Resume data type definition
export interface ResumeData {
  id?: number;
  candidateId?: number;
  clientNames?: string[];
  jobTitles?: string[];
  relevantDates?: string[];
  skills?: string[];
  education?: string[];
  extractedText?: string;
  fileName?: string;
  uploadedAt?: string;
}

// Submission type definition
export interface Submission {
  id: number;
  jobId: number;
  candidateId: number;
  recruiterId: number;
  status: string;
  feedback?: string;
  agreedRate?: number;
  submissionDate: string;
  job?: Job;
  candidate?: Candidate;
  recruiter?: Recruiter;
}

// Recruiter type definition
export interface Recruiter {
  id: number;
  username: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
}

// Activity type definition
export interface Activity {
  id: number;
  type: string;
  userId: number;
  entityId: number;
  entityType: string;
  details?: string;
  timestamp: string;
  user?: Recruiter;
}