import { 
  users, jobs, jobAssignments, candidates, resumeData, submissions, activities,
  type User, type InsertUser, 
  type Job, type InsertJob, 
  type JobAssignment, type InsertJobAssignment, 
  type Candidate, type InsertCandidate, 
  type ResumeData, type InsertResumeData, 
  type Submission, type InsertSubmission, 
  type Activity, type InsertActivity
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, gte } from "drizzle-orm";

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

  // Resume data operations
  getResumeData(candidateId: number): Promise<ResumeData | undefined>;
  createResumeData(resumeData: InsertResumeData): Promise<ResumeData>;

  // Submission operations
  getSubmissions(filters?: { jobId?: number, candidateId?: number, recruiterId?: number }): Promise<Submission[]>;
  getSubmission(id: number): Promise<Submission | undefined>;
  getSubmissionByJobAndCandidate(jobId: number, candidateId: number): Promise<Submission | undefined>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmissionStatus(id: number, status: string): Promise<Submission>;
  
  // Activity operations
  getActivities(limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Dashboard data
  getDashboardStats(): Promise<{
    activeJobs: number;
    totalSubmissions: number;
    newToday: number;
    successRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
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

  async updateSubmissionStatus(id: number, status: string): Promise<Submission> {
    const now = new Date();
    const [submission] = await db
      .update(submissions)
      .set({
        status,
        updatedAt: now
      })
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