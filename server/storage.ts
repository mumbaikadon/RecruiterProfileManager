import { 
  users, jobs, jobAssignments, candidates, resumeData, submissions, activities, candidateValidations,
  type User, type InsertUser, 
  type Job, type InsertJob, 
  type JobAssignment, type InsertJobAssignment, 
  type Candidate, type InsertCandidate, 
  type ResumeData, type InsertResumeData, 
  type Submission, type InsertSubmission, 
  type Activity, type InsertActivity,
  type CandidateValidation, type InsertCandidateValidation
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getRecruiters(): Promise<User[]>;

  // Job operations
  getJobs(filters?: { status?: string, date?: Date, searchTerm?: string }): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  getJobByJobId(jobId: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJobStatus(id: number, status: string): Promise<Job>;

  // Job assignment operations
  assignRecruitersToJob(jobId: number, recruiterIds: number[]): Promise<JobAssignment[]>;
  getJobAssignments(jobId: number): Promise<JobAssignment[]>;
  getUserAssignedJobs(userId: number): Promise<Job[]>;

  // Candidate operations
  getCandidates(): Promise<Candidate[]>;
  getCandidate(id: number): Promise<Candidate | undefined>;
  getCandidateByIdentity(dobMonth: number, dobDay: number, ssn4: string): Promise<Candidate | undefined>;
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  markCandidateAsUnreal(candidateId: number, reason: string, validatedBy: number): Promise<Candidate>;
  updateCandidateValidation(candidateId: number, isUnreal: boolean, reason?: string, validatedBy?: number): Promise<Candidate>;

  // Resume data operations
  getResumeData(candidateId: number): Promise<ResumeData | undefined>;
  createResumeData(resumeData: InsertResumeData): Promise<ResumeData>;
  updateResumeData(id: number, resumeData: Partial<ResumeData>): Promise<ResumeData>;
  getAllResumeData(): Promise<ResumeData[]>;
  findSimilarEmploymentHistories(
    clientNames: string[], 
    relevantDates: string[], 
    excludeCandidateId?: number
  ): Promise<Array<{
    candidateId: number;
    similarityScore: number;
    clientNames: string[];
    relevantDates: string[];
  }>>;

  // Candidate validation operations
  createCandidateValidation(validation: InsertCandidateValidation): Promise<CandidateValidation>;
  getCandidateValidations(candidateId: number): Promise<CandidateValidation[]>;

  // Submission operations
  getSubmissions(filters?: { jobId?: number, candidateId?: number, recruiterId?: number }): Promise<Submission[]>;
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionByJobAndCandidate(jobId: number, candidateId: number): Promise<Submission | undefined>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmissionStatus(id: number, status: string, feedback?: string, lastUpdatedBy?: number): Promise<Submission>;
  
  // Activity operations
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Dashboard data
  getDashboardStats(): Promise<{
    activeJobs: number;
    totalSubmissions: number;
    assignedActiveJobs: number;
    submissionsThisWeek: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async markCandidateAsUnreal(candidateId: number, reason: string, validatedBy: number): Promise<Candidate> {
    const lastValidated = new Date();
    const [candidate] = await db
      .update(candidates)
      .set({ 
        isUnreal: true,
        unrealReason: reason,
        lastValidated,
        validatedBy 
      })
      .where(eq(candidates.id, candidateId))
      .returning();
    
    return candidate;
  }
  
  async updateCandidateValidation(
    candidateId: number, 
    isUnreal: boolean, 
    reason?: string, 
    validatedBy?: number
  ): Promise<Candidate> {
    const lastValidated = new Date();
    const updateData: any = { 
      isUnreal,
      lastValidated 
    };
    
    if (reason !== undefined) {
      updateData.unrealReason = reason;
    }
    
    if (validatedBy !== undefined) {
      updateData.validatedBy = validatedBy;
    }
    
    const [candidate] = await db
      .update(candidates)
      .set(updateData)
      .where(eq(candidates.id, candidateId))
      .returning();
    
    return candidate;
  }
  
  async updateResumeData(id: number, updateData: Partial<ResumeData>): Promise<ResumeData> {
    const [data] = await db
      .update(resumeData)
      .set(updateData)
      .where(eq(resumeData.id, id))
      .returning();
    
    return data;
  }
  
  async createCandidateValidation(validation: InsertCandidateValidation): Promise<CandidateValidation> {
    const [record] = await db
      .insert(candidateValidations)
      .values(validation)
      .returning();
    
    return record;
  }
  
  async getCandidateValidations(candidateId: number): Promise<CandidateValidation[]> {
    return db
      .select()
      .from(candidateValidations)
      .where(eq(candidateValidations.candidateId, candidateId))
      .orderBy(desc(candidateValidations.validatedAt));
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getRecruiters(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.role, "recruiter"))
      .orderBy(users.name);
  }

  async getJobs(filters?: { status?: string; date?: Date; searchTerm?: string }): Promise<Job[]> {
    let query = db.select().from(jobs);

    if (filters) {
      if (filters.status) {
        query = query.where(eq(jobs.status, filters.status));
      }

      if (filters.date) {
        const startOfDay = new Date(filters.date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(filters.date);
        endOfDay.setHours(23, 59, 59, 999);

        query = query.where(
          sql`${jobs.createdAt} >= ${startOfDay} AND ${jobs.createdAt} <= ${endOfDay}`
        );
      }

      if (filters.searchTerm) {
        query = query.where(
          sql`${jobs.title} ILIKE ${'%' + filters.searchTerm + '%'} OR 
              ${jobs.jobId} ILIKE ${'%' + filters.searchTerm + '%'} OR 
              ${jobs.description} ILIKE ${'%' + filters.searchTerm + '%'}`
        );
      }
    }

    return query.orderBy(desc(jobs.createdAt));
  }

  async getJob(id: number): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job;
  }

  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.jobId, jobId));
    return job;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values(insertJob)
      .returning();
    
    return job;
  }

  async updateJobStatus(id: number, status: string): Promise<Job> {
    const [job] = await db
      .update(jobs)
      .set({ status })
      .where(eq(jobs.id, id))
      .returning();
    
    return job;
  }
  
  async updateJobDescription(id: number, description: string): Promise<Job> {
    const [job] = await db
      .update(jobs)
      .set({ description })
      .where(eq(jobs.id, id))
      .returning();
    
    return job;
  }

  async assignRecruitersToJob(jobId: number, recruiterIds: number[]): Promise<JobAssignment[]> {
    // Create an array of assignment objects
    const assignmentValues = recruiterIds.map(userId => ({
      jobId,
      userId
    }));
    
    const result = await db
      .insert(jobAssignments)
      .values(assignmentValues)
      .returning()
      .catch(() => {
        // If there's a unique constraint violation, we'll handle it gracefully
        return [];
      });
    
    return result;
  }

  async getJobAssignments(jobId: number): Promise<JobAssignment[]> {
    return db
      .select()
      .from(jobAssignments)
      .where(eq(jobAssignments.jobId, jobId));
  }

  async getUserAssignedJobs(userId: number): Promise<Job[]> {
    return db
      .select({
        ...jobs
      })
      .from(jobs)
      .innerJoin(
        jobAssignments,
        and(
          eq(jobAssignments.jobId, jobs.id),
          eq(jobAssignments.userId, userId)
        )
      )
      .orderBy(desc(jobs.createdAt));
  }

  async getCandidates(): Promise<Candidate[]> {
    return db
      .select()
      .from(candidates)
      .orderBy(desc(candidates.createdAt));
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id));
    
    return candidate;
  }

  async getCandidateByIdentity(dobMonth: number, dobDay: number, ssn4: string): Promise<Candidate | undefined> {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.dobMonth, dobMonth),
          eq(candidates.dobDay, dobDay),
          eq(candidates.ssn4, ssn4)
        )
      );
    
    return candidate;
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const [candidate] = await db
      .insert(candidates)
      .values(insertCandidate)
      .returning();
    
    return candidate;
  }

  async getResumeData(candidateId: number): Promise<ResumeData | undefined> {
    const [data] = await db
      .select()
      .from(resumeData)
      .where(eq(resumeData.candidateId, candidateId));
    
    return data;
  }

  async createResumeData(insertResumeData: InsertResumeData): Promise<ResumeData> {
    const [data] = await db
      .insert(resumeData)
      .values(insertResumeData)
      .returning();
    
    return data;
  }

  async getAllResumeData(): Promise<ResumeData[]> {
    return db
      .select()
      .from(resumeData)
      .orderBy(desc(resumeData.uploadedAt));
  }

  async findSimilarEmploymentHistories(
    clientNames: string[],
    relevantDates: string[],
    excludeCandidateId?: number
  ): Promise<Array<{
    candidateId: number;
    similarityScore: number;
    clientNames: string[];
    relevantDates: string[];
    hasIdenticalChronology?: boolean;
    isHighSimilarity?: boolean;
    companyMatchPercentage?: number;
    dateMatchPercentage?: number;
  }>> {
    console.log("\n\n===== STARTING FRAUD DETECTION ANALYSIS =====");
    
    // Bail out early if there's no data to check
    if (!clientNames.length) {
      console.log("No company data to check - skipping validation");
      return [];
    }

    // Normalize input company names for better matching - with less logging
    const normalizedInputCompanies = clientNames.map(name => {
      let normalized = name.split(',')[0].toLowerCase().trim();
      return normalized.split(/\s+/)[0]; // Just the main company name
    });

    // Normalize input dates for better matching - with less logging
    const normalizedInputDates = relevantDates.map(date => {
      const rawComponents = date.toLowerCase()
        .replace(/[^a-z0-9]/gi, ' ')
        .split(/\s+/)
        .filter(Boolean);
      
      // Extract years and months
      const components = [
        ...rawComponents.filter(part => /^(19|20)\d{2}$/.test(part)),
        ...rawComponents.filter(part => /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[01]?\d)$/.test(part))
      ];
      
      return { original: date, components };
    });

    // Get resume data - but with early filtering to reduce processing
    const allResumeData = await this.getAllResumeData();
    
    // Filter out: 1) candidates with no data, 2) the one we're validating, and 3) any duplicates of the same candidate
    const validCandidatesData = allResumeData.filter(data => {
      // Always exclude the candidate being validated 
      if (excludeCandidateId && data.candidateId === excludeCandidateId) {
        return false;
      }
      
      // Ensure we have data to match
      return (data.clientNames?.length > 0 || data.relevantDates?.length > 0);
    });
    
    console.log(`Comparing against ${validCandidatesData.length} candidates with resume data`);
    
    // Early check - if we have very few candidates, no need for optimization
    if (validCandidatesData.length === 0) {
      return [];
    }
    
    // First pass - quick filtering to reduce candidates needing detailed analysis
    // Only do detailed processing for candidates with any company name match
    const potentialMatches = validCandidatesData.filter(data => {
      const candidateCompanyNames = data.clientNames || [];
      
      // Quick check - does any company name match (after normalization)?
      const hasAnyMatch = candidateCompanyNames.some(name => {
        const normalized = name.split(',')[0].toLowerCase().trim().split(/\s+/)[0];
        return normalizedInputCompanies.includes(normalized);
      });
      
      return hasAnyMatch;
    });
    
    console.log(`Found ${potentialMatches.length} candidates with at least one matching company name`);
    
    // Detailed analysis only for potential matches
    const similarCandidates = potentialMatches
      .map(data => {
        // Get candidate data
        const candidateClientNames = data.clientNames || [];
        const candidateRelevantDates = data.relevantDates || [];
        
        // Normalize candidate company names
        const normalizedCandidateCompanies = candidateClientNames.map(name => {
          const normalized = name.split(',')[0].toLowerCase().trim();
          return normalized.split(/\s+/)[0];
        });
        
        // Normalized candidate dates
        const normalizedCandidateDates = candidateRelevantDates.map(date => {
          const rawComponents = date.toLowerCase()
            .replace(/[^a-z0-9]/gi, ' ')
            .split(/\s+/)
            .filter(Boolean);
          
          const components = [
            ...rawComponents.filter(part => /^(19|20)\d{2}$/.test(part)),
            ...rawComponents.filter(part => /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[01]?\d)$/.test(part))
          ];
          
          return { original: date, components };
        });
        
        // Find matching companies
        const matchingCompanies = [];
        const matchingIndices = [];
        
        for (const company of normalizedInputCompanies) {
          const matchIndex = normalizedCandidateCompanies.findIndex(c => c === company);
          if (matchIndex !== -1) {
            matchingCompanies.push(company);
            matchingIndices.push(matchIndex);
          }
        }
        
        // Calculate company match percentage
        const companyMatchPercentage = normalizedInputCompanies.length > 0 ?
          (matchingCompanies.length / normalizedInputCompanies.length) * 100 : 0;
        
        // Check if companies appear in the same order (chronology)
        let hasChronologyMatch = false;
        if (matchingCompanies.length >= 2) {
          hasChronologyMatch = matchingIndices.every((val, i, arr) => !i || val >= arr[i - 1]);
        }
        
        // Date component matching - optimized with less logging
        let totalDateComponentMatches = 0;
        let totalInputDateComponents = 0;
        
        for (const inputDate of normalizedInputDates) {
          if (inputDate.components.length > 0) {
            totalInputDateComponents += inputDate.components.length;
            
            for (const candidateDate of normalizedCandidateDates) {
              if (candidateDate.components.length > 0) {
                // Count matching components
                const matches = inputDate.components.filter(component => 
                  candidateDate.components.includes(component)
                );
                
                if (matches.length > 0) {
                  totalDateComponentMatches += matches.length;
                }
              }
            }
          }
        }
        
        // Calculate date match percentage
        const dateMatchPercentage = totalInputDateComponents > 0 ?
          (totalDateComponentMatches / totalInputDateComponents) * 100 : 0;
        
        // Calculate overall similarity score with weighted components
        const similarityScore = Math.round(
          (companyMatchPercentage * 0.7) + (dateMatchPercentage * 0.3)
        );
        
        // Only log details for high similarity candidates
        if (similarityScore >= 50) {
          console.log(`\nCandidate ${data.candidateId} - ${similarityScore}% match`);
          console.log(`- Company matches: ${matchingCompanies.length}/${normalizedInputCompanies.length} (${companyMatchPercentage.toFixed(1)}%)`);
          console.log(`- Date component matches: ${totalDateComponentMatches}/${totalInputDateComponents} (${dateMatchPercentage.toFixed(1)}%)`);
        }
        
        // Return result if similarity is high enough
        if (similarityScore >= 50) {
          const hasIdenticalChronology = hasChronologyMatch && 
            companyMatchPercentage >= 90 && 
            dateMatchPercentage >= 80;
            
          const isHighSimilarity = similarityScore >= 80;
          
          return {
            candidateId: data.candidateId,
            similarityScore,
            clientNames: candidateClientNames,
            relevantDates: candidateRelevantDates,
            hasIdenticalChronology,
            isHighSimilarity,
            companyMatchPercentage,
            dateMatchPercentage
          };
        }
        
        return null;
      })
      .filter(Boolean) // Remove null entries
      .sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Log results summary
    console.log(`\n===== FRAUD DETECTION RESULTS SUMMARY =====`);
    console.log(`Found ${similarCandidates.length} candidates with significant similarity (≥50%)`);
    
    if (similarCandidates.length > 0) {
      // Log high similarity matches
      const highSimilarityMatches = similarCandidates.filter(c => c.isHighSimilarity);
      if (highSimilarityMatches.length > 0) {
        console.log(`⚠️ WARNING: Found ${highSimilarityMatches.length} candidates with HIGH SIMILARITY (≥80%)`);
      }
      
      // Log identical chronology matches
      const identicalChronologyMatches = similarCandidates.filter(c => c.hasIdenticalChronology);
      if (identicalChronologyMatches.length > 0) {
        console.log(`⚠️ CRITICAL: Found ${identicalChronologyMatches.length} candidates with IDENTICAL JOB CHRONOLOGY`);
      }
    } else {
      console.log("No similar employment histories found.");
    }
    
    console.log("===== FRAUD DETECTION ANALYSIS COMPLETE =====");
    
    // Return the matches
    return similarCandidates;
  }

  async getSubmissions(filters?: { jobId?: number, candidateId?: number, recruiterId?: number }): Promise<Submission[]> {
    let query = db.select().from(submissions);
    
    if (filters) {
      if (filters.jobId) {
        query = query.where(eq(submissions.jobId, filters.jobId));
      }
      
      if (filters.candidateId) {
        query = query.where(eq(submissions.candidateId, filters.candidateId));
      }
      
      if (filters.recruiterId) {
        query = query.where(eq(submissions.recruiterId, filters.recruiterId));
      }
    }
    
    return query.orderBy(desc(submissions.submittedAt));
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, id));
    
    return submission;
  }

  async getSubmissionByJobAndCandidate(jobId: number, candidateId: number): Promise<Submission | undefined> {
    const [submission] = await db
      .select()
      .from(submissions)
      .where(
        and(
          eq(submissions.jobId, jobId),
          eq(submissions.candidateId, candidateId)
        )
      );
    
    return submission;
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const now = new Date();
    const [submission] = await db
      .insert(submissions)
      .values({
        ...insertSubmission,
        updatedAt: now
      })
      .returning();
    
    return submission;
  }

  async updateSubmissionStatus(
    id: number, 
    status: string, 
    feedback?: string, 
    lastUpdatedBy?: number
  ): Promise<Submission> {
    const now = new Date();
    const updateData: any = { 
      status, 
      updatedAt: now
    };
    
    if (feedback !== undefined) {
      updateData.feedback = feedback;
    }
    
    if (lastUpdatedBy) {
      updateData.lastUpdatedBy = lastUpdatedBy;
    }
    
    const [submission] = await db
      .update(submissions)
      .set(updateData)
      .where(eq(submissions.id, id))
      .returning();
    
    return submission;
  }

  async getActivities(limit: number = 20): Promise<Activity[]> {
    return db
      .select()
      .from(activities)
      .orderBy(desc(activities.createdAt))
      .limit(limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db
      .insert(activities)
      .values(insertActivity)
      .returning();
    
    return activity;
  }

  async getDashboardStats(): Promise<{
    activeJobs: number;
    totalSubmissions: number;
    assignedActiveJobs: number;
    submissionsThisWeek: number;
  }> {
    // Get active jobs count
    const [activeJobsResult] = await db
      .select({ count: count() })
      .from(jobs)
      .where(eq(jobs.status, "active"));
    
    // Get total submissions
    const [totalSubmissionsResult] = await db
      .select({ count: count() })
      .from(submissions);
    
    // Get assigned active jobs count - jobs that are active and have at least one recruiter assigned
    const assignedActiveJobsQuery = await db
      .select({
        jobId: jobAssignments.jobId,
      })
      .from(jobAssignments)
      .innerJoin(
        jobs,
        and(
          eq(jobAssignments.jobId, jobs.id),
          eq(jobs.status, "active")
        )
      )
      .groupBy(jobAssignments.jobId);
    
    const assignedActiveJobs = assignedActiveJobsQuery.length;
    
    // Get submissions created this week (from Monday to Sunday)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    const [submissionsThisWeekResult] = await db
      .select({ count: count() })
      .from(submissions)
      .where(
        and(
          gte(submissions.submittedAt, monday),
          lte(submissions.submittedAt, sunday)
        )
      );
    
    return {
      activeJobs: activeJobsResult?.count ?? 0,
      totalSubmissions: totalSubmissionsResult?.count ?? 0,
      assignedActiveJobs,
      submissionsThisWeek: submissionsThisWeekResult?.count ?? 0
    };
  }
}

// Export an instance to use throughout the app
export const storage = new DatabaseStorage();