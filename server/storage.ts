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
  }>> {
    console.log("Finding similar employment histories...");
    console.log(`Input: ${clientNames.length} companies, ${relevantDates.length} dates, excluding candidate ID: ${excludeCandidateId || 'none'}`);

    // Get all resume data from the database
    const allResumeData = await this.getAllResumeData();
    
    // Filter out the candidate we're validating (if provided)
    const otherCandidatesData = excludeCandidateId 
      ? allResumeData.filter(data => data.candidateId !== excludeCandidateId) 
      : allResumeData;
    
    console.log(`Comparing against ${otherCandidatesData.length} other candidates' resume data`);
    
    // Calculate similarity scores for each candidate
    const similarCandidates = otherCandidatesData
      .map(data => {
        // We need to ensure the arrays exist
        const candidateClientNames = data.clientNames || [];
        const candidateRelevantDates = data.relevantDates || [];
        
        // Calculate similarity between company names (ignoring titles as they could legitimately be the same)
        // Improved matching to handle company names with locations
        const nameMatches = clientNames.filter(name => {
          // Normalize input name - extract just the company part (before any comma)
          const normalizedName = name.split(',')[0].toLowerCase().trim();
          console.log(`Comparing input company: "${name}" (normalized: "${normalizedName}")`);
          
          return candidateClientNames.some(cName => {
            // Normalize candidate name similarly
            const normalizedCandidateName = cName.split(',')[0].toLowerCase().trim();
            const isMatch = normalizedCandidateName === normalizedName;
            
            if (isMatch) {
              console.log(`MATCH FOUND: "${cName}" matches "${name}"`);
            } else {
              console.log(`No match: "${cName}" (normalized: "${normalizedCandidateName}") vs "${name}" (normalized: "${normalizedName}")`);
            }
            
            return isMatch;
          });
        });
        
        // Calculate similarity between dates
        const dateMatches = relevantDates.filter(date => {
          const normalizedDate = date.toLowerCase().trim();
          console.log(`Comparing input date: "${date}"`);
          
          return candidateRelevantDates.some(cDate => {
            const normalizedCandidateDate = cDate.toLowerCase().trim();
            
            // Basic exact match
            const exactMatch = normalizedCandidateDate === normalizedDate;
            
            // Check if months/years match even if format differs
            const datePartsInput = normalizedDate.replace(/[^a-z0-9]/gi, ' ').split(/\s+/).filter(Boolean);
            const datePartsCandidate = normalizedCandidateDate.replace(/[^a-z0-9]/gi, ' ').split(/\s+/).filter(Boolean);
            
            // If both contain same months/years in any order, consider it a match
            const containsSameMonthsYears = datePartsInput.length > 0 && 
              datePartsInput.every(part => 
                datePartsCandidate.some(cPart => cPart === part)
              );
            
            const isMatch = exactMatch || containsSameMonthsYears;
            
            if (isMatch) {
              console.log(`DATE MATCH FOUND: "${cDate}" matches "${date}"`);
            } else {
              console.log(`No date match: "${cDate}" vs "${date}"`);
            }
            
            return isMatch;
          });
        });
        
        // Calculate similarity score (0-100)
        const totalItems = clientNames.length + relevantDates.length;
        const matchedItems = nameMatches.length + dateMatches.length;
        
        let similarityScore = 0;
        if (totalItems > 0) {
          similarityScore = Math.round((matchedItems / totalItems) * 100);
        }
        
        return {
          candidateId: data.candidateId,
          similarityScore,
          clientNames: candidateClientNames,
          relevantDates: candidateRelevantDates,
          // For debugging
          nameMatches: nameMatches.length,
          dateMatches: dateMatches.length,
          totalInputItems: totalItems,
          matchedItems
        };
      })
      // Filter candidates with at least 1 match and sort by similarity score (highest first)
      .filter(candidate => candidate.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Log the results for debugging
    console.log(`Found ${similarCandidates.length} candidates with similar employment histories`);
    similarCandidates.slice(0, 5).forEach((candidate, idx) => {
      console.log(`Top match #${idx + 1}: Candidate ID ${candidate.candidateId}, Similarity: ${candidate.similarityScore}%, Matched ${candidate.matchedItems}/${candidate.totalInputItems} items`);
    });
    
    // Return the matches with > 0% similarity (excluding debug fields)
    return similarCandidates.map(({ candidateId, similarityScore, clientNames, relevantDates }) => ({
      candidateId,
      similarityScore,
      clientNames,
      relevantDates
    }));
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