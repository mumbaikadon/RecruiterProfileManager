import { 
  users, jobs, jobAssignments, candidates, resumeData, submissions, activities, candidateValidations, publicApplications,
  profileResumes, resumeContent, resumeMetadata, searchCache,
  type User, type InsertUser, 
  type Job, type InsertJob, 
  type JobAssignment, type InsertJobAssignment, 
  type Candidate, type InsertCandidate, 
  type ResumeData, type InsertResumeData, 
  type Submission, type InsertSubmission, 
  type Activity, type InsertActivity,
  type CandidateValidation, type InsertCandidateValidation,
  type PublicApplication, type InsertPublicApplication,
  type ProfileResume, type InsertProfileResume,
  type ResumeContent, type InsertResumeContent,
  type ResumeMetadata, type InsertResumeMetadata,
  type SearchCache, type InsertSearchCache
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, sql, gte, lte, or, ilike, inArray } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

export interface IStorage {
  sessionStore: any;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserStatus(id: number, status: string, approvedBy?: number): Promise<User>;
  updateUserRole(id: number, role: string, updatedBy: number): Promise<User>;
  getRecruiters(): Promise<User[]>;
  getPendingUsers(): Promise<User[]>;
  getAllUsers(): Promise<User[]>;

  // Job operations
  getJobs(filters?: { status?: string, date?: Date, searchTerm?: string }): Promise<Job[]>;
  getJob(id: number): Promise<Job | undefined>;
  getJobByJobId(jobId: string): Promise<Job | undefined>;
  createJob(job: InsertJob): Promise<Job>;
  updateJob(id: number, job: Partial<InsertJob>): Promise<Job>;
  updateJobStatus(id: number, status: string): Promise<Job>;

  // Job assignment operations
  assignRecruitersToJob(jobId: number, recruiterIds: number[]): Promise<JobAssignment[]>;
  getJobAssignments(jobId: number): Promise<JobAssignment[]>;
  getUserAssignedJobs(userId: number): Promise<Job[]>;

  // Candidate operations
  getCandidates(): Promise<Array<Candidate & { jobTitle?: string; yearsOfExperience?: number }>>;
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
  // Resume file storage operations
  storeResumeFile(candidateId: number, fileName: string, fileContent: Buffer, mimeType: string): Promise<ResumeData>;
  getResumeFile(candidateId: number): Promise<{fileName: string, fileContent: Buffer, mimeType: string} | null>;
  updateResumeText(candidateId: number, extractedText: string): Promise<void>;
  deleteResumeFiles(candidateIds: number[]): Promise<void>;

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

  // Public job application operations
  getPublicJobs(): Promise<Job[]>;
  createPublicApplication(application: InsertPublicApplication): Promise<PublicApplication>;
  getPublicApplications(filters?: { jobId?: number, status?: string }): Promise<PublicApplication[]>;
  getPublicApplication(id: number): Promise<PublicApplication | undefined>;
  updatePublicApplicationStatus(id: number, status: string, reviewedBy?: number, notes?: string): Promise<PublicApplication>;

  // Profile Resume operations (Resume Database)
  getProfileResumes(filters?: { searchTerm?: string }): Promise<Array<ProfileResume & { extractedText?: string }>>;
  getProfileResume(id: number): Promise<ProfileResume | undefined>;
  createProfileResume(resume: InsertProfileResume, extractedText: string): Promise<ProfileResume>;
  deleteProfileResume(id: number): Promise<void>;
  searchProfileResumesByContent(searchTerm: string): Promise<Array<ProfileResume & { extractedText: string; rank: number }>>;
  searchProfileResumesByPhone(phonePattern: string): Promise<Array<ProfileResume & { extractedText?: string; highlightedText?: string; rank?: number }>>;
  getProfileResumeContent(resumeId: number): Promise<ResumeContent | undefined>;
}

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

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

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUserStatus(id: number, status: string, approvedBy?: number): Promise<User> {
    const updateData: any = { 
      status,
      approvedAt: status === 'approved' ? new Date() : null
    };
    
    if (approvedBy !== undefined) {
      updateData.approvedBy = approvedBy;
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserRole(id: number, role: string, updatedBy: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ role })
      .where(eq(users.id, id))
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

  async getPendingUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.status, "pending"))
      .orderBy(desc(users.createdAt));
  }

  async getAllUsers(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.status, "approved"))
      .orderBy(desc(users.createdAt));
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

  async updateJob(id: number, jobUpdate: Partial<InsertJob>): Promise<Job> {
    const [job] = await db
      .update(jobs)
      .set(jobUpdate)
      .where(eq(jobs.id, id))
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

  async getCandidates(): Promise<Array<Candidate & { jobTitle?: string; yearsOfExperience?: number }>> {
    const result = await db
      .select({
        ...candidates,
        jobTitle: sql<string | null>`
          CASE 
            WHEN ${resumeData.jobTitles} IS NOT NULL AND array_length(${resumeData.jobTitles}, 1) > 0 
            THEN ${resumeData.jobTitles}[1]
            ELSE NULL
          END
        `.as('jobTitle'),
        relevantDates: resumeData.relevantDates
      })
      .from(candidates)
      .leftJoin(resumeData, eq(resumeData.candidateId, candidates.id))
      .orderBy(desc(candidates.createdAt));
    
    // Import quote removal utility
    const { removeQuotes } = await import("./utils");
    
    return result.map(row => ({
      ...row,
      location: removeQuotes(row.location), // Clean location data when retrieving candidates
      jobTitle: row.jobTitle || undefined,
      yearsOfExperience: this.calculateYearsOfExperience(row.relevantDates)
    }));
  }

  private calculateYearsOfExperience(relevantDates: string[] | null): number | undefined {
    if (!relevantDates || relevantDates.length === 0) {
      return undefined;
    }

    let earliestYear: number | null = null;

    for (const dateRange of relevantDates) {
      // Extract year from any format: "March 2011", "2011-2013", "Mar 2011 - Nov 2013", etc.
      const yearMatch = dateRange.match(/(\d{4})/);
      
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        
        if (!earliestYear || year < earliestYear) {
          earliestYear = year;
        }
      }
    }

    if (!earliestYear) {
      return undefined;
    }

    // Simple calculation: current year minus start year
    const currentYear = new Date().getFullYear();
    return currentYear - earliestYear;
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(eq(candidates.id, id));
    
    return candidate;
  }

  async getCandidateByIdentity(dobMonth?: number, dobDay?: number, ssn4?: string): Promise<Candidate | undefined> {
    // Build conditions array only for provided values
    const conditions = [];
    
    if (dobMonth !== undefined && dobMonth !== null) {
      conditions.push(eq(candidates.dobMonth, dobMonth));
    }
    if (dobDay !== undefined && dobDay !== null) {
      conditions.push(eq(candidates.dobDay, dobDay));
    }
    if (ssn4 !== undefined && ssn4 !== null && ssn4 !== '') {
      conditions.push(eq(candidates.ssn4, ssn4));
    }
    
    // If no identifying information provided, can't check for duplicates
    if (conditions.length === 0) {
      return undefined;
    }
    
    const [candidate] = await db
      .select()
      .from(candidates)
      .where(and(...conditions));
    
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
    
    // Filter out candidates with no data and the one we're validating
    const validCandidatesData = allResumeData.filter(data => {
      return (!excludeCandidateId || data.candidateId !== excludeCandidateId) && 
             (data.clientNames?.length > 0 || data.relevantDates?.length > 0);
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
    totalCandidates: number;
    totalJobs: number;
  }> {
    // Get active jobs count
    const [activeJobsResult] = await db
      .select({ count: count() })
      .from(jobs)
      .where(eq(jobs.status, "active"));
    
    // Get total submissions for active jobs only
    const [totalSubmissionsResult] = await db
      .select({ count: count() })
      .from(submissions)
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .where(eq(jobs.status, "active"));
    
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
      .innerJoin(jobs, eq(submissions.jobId, jobs.id))
      .where(
        and(
          eq(jobs.status, "active"),
          gte(submissions.submittedAt, monday),
          lte(submissions.submittedAt, sunday)
        )
      );
    
    // Get total candidates count
    const [totalCandidatesResult] = await db
      .select({ count: count() })
      .from(candidates);
    
    // Get total jobs count (all statuses)
    const [totalJobsResult] = await db
      .select({ count: count() })
      .from(jobs);
    
    return {
      activeJobs: activeJobsResult?.count ?? 0,
      totalSubmissions: totalSubmissionsResult?.count ?? 0,
      assignedActiveJobs,
      submissionsThisWeek: submissionsThisWeekResult?.count ?? 0,
      totalCandidates: totalCandidatesResult?.count ?? 0,
      totalJobs: totalJobsResult?.count ?? 0
    };
  }

  // Public job application methods
  async getPublicJobs(): Promise<Job[]> {
    return db
      .select()
      .from(jobs)
      .where(eq(jobs.status, "active"))
      .orderBy(desc(jobs.createdAt));
  }

  async createPublicApplication(insertApplication: InsertPublicApplication): Promise<PublicApplication> {
    const [application] = await db
      .insert(publicApplications)
      .values(insertApplication)
      .returning();
    
    return application;
  }

  async getPublicApplications(filters?: { jobId?: number; status?: string }): Promise<PublicApplication[]> {
    let query = db.select().from(publicApplications);

    if (filters) {
      const conditions = [];
      
      if (filters.jobId) {
        conditions.push(eq(publicApplications.jobId, filters.jobId));
      }
      
      if (filters.status) {
        conditions.push(eq(publicApplications.status, filters.status));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }

    return query.orderBy(desc(publicApplications.appliedAt));
  }

  async getPublicApplication(id: number): Promise<PublicApplication | undefined> {
    const [application] = await db
      .select()
      .from(publicApplications)
      .where(eq(publicApplications.id, id));
    
    return application;
  }

  async updatePublicApplicationStatus(
    id: number, 
    status: string, 
    reviewedBy?: number, 
    notes?: string
  ): Promise<PublicApplication> {
    const updateData: any = { 
      status,
      reviewedAt: new Date()
    };
    
    if (reviewedBy) {
      updateData.reviewedBy = reviewedBy;
    }
    
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    
    const [application] = await db
      .update(publicApplications)
      .set(updateData)
      .where(eq(publicApplications.id, id))
      .returning();
    
    return application;
  }

  // Resume file storage methods
  async storeResumeFile(candidateId: number, fileName: string, fileContent: Buffer, mimeType: string): Promise<ResumeData> {
    // Validate file size (limit to 10MB to prevent database bloat)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (fileContent.length > maxFileSize) {
      throw new Error(`File size ${Math.round(fileContent.length / 1024 / 1024)}MB exceeds maximum allowed size of ${maxFileSize / 1024 / 1024}MB`);
    }
    
    // Convert buffer to base64 for database storage
    const base64Content = fileContent.toString('base64');
    
    // Get existing resume data or create new record
    const existingResumeData = await this.getResumeData(candidateId);
    
    if (existingResumeData) {
      // Update existing record with file data
      const [updated] = await db
        .update(resumeData)
        .set({
          fileName,
          fileContent: base64Content,
          fileSize: fileContent.length,
          mimeType
        })
        .where(eq(resumeData.candidateId, candidateId))
        .returning();
      
      return updated;
    } else {
      // Create new record with file data
      const [created] = await db
        .insert(resumeData)
        .values({
          candidateId,
          fileName,
          fileContent: base64Content,
          fileSize: fileContent.length,
          mimeType
        })
        .returning();
      
      return created;
    }
  }

  async getResumeFile(candidateId: number): Promise<{fileName: string, fileContent: Buffer, mimeType: string} | null> {
    const data = await this.getResumeData(candidateId);
    
    if (!data || !data.fileContent || !data.fileName || !data.mimeType) {
      return null;
    }
    
    // Convert base64 back to buffer
    const fileContent = Buffer.from(data.fileContent, 'base64');
    
    return {
      fileName: data.fileName,
      fileContent,
      mimeType: data.mimeType
    };
  }

  async updateResumeText(candidateId: number, extractedText: string): Promise<void> {
    await db
      .update(resumeData)
      .set({ extractedText })
      .where(eq(resumeData.candidateId, candidateId));
    
    console.log(`Updated extracted text for candidate ${candidateId}: ${extractedText.length} characters`);
  }

  async deleteResumeFiles(candidateIds: number[]): Promise<void> {
    if (candidateIds.length === 0) {
      return;
    }
    
    // Only delete resume files for candidates who are not submitted to any other ACTIVE jobs
    const candidatesWithActiveJobs = await db
      .select({ candidateId: submissions.candidateId })
      .from(submissions)
      .innerJoin(jobs, eq(jobs.id, submissions.jobId))
      .where(
        and(
          inArray(submissions.candidateId, candidateIds),
          eq(jobs.status, "active")
        )
      );
    
    const candidatesWithActiveJobIds = candidatesWithActiveJobs.map(row => row.candidateId);
    
    // Filter out candidates who still have active job submissions
    const candidatesForDeletion = candidateIds.filter(id => 
      !candidatesWithActiveJobIds.includes(id)
    );
    
    if (candidatesForDeletion.length === 0) {
      console.log("No candidates eligible for resume file deletion - all have active job submissions");
      return;
    }
    
    console.log(`Deleting resume files for ${candidatesForDeletion.length} candidates (${candidatesWithActiveJobIds.length} candidates preserved due to active job submissions)`);
    
    // Clear file content fields for eligible candidates only
    await db
      .update(resumeData)
      .set({
        fileName: null,
        fileContent: null,
        fileSize: null,
        mimeType: null
      })
      .where(inArray(resumeData.candidateId, candidatesForDeletion));
  }

  // Phase 1: Optimized Profile Resume operations (NO FULL TEXT)
  async getProfileResumes(filters?: { 
    searchTerm?: string;
    page?: number;
    limit?: number;
    includeFileData?: boolean;
  }): Promise<{
    resumes: Array<ProfileResume>;
    totalCount: number;
    hasMore: boolean;
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    
    // Select ONLY metadata - NO extractedText, minimal fileData
    let query = db
      .select({
        id: profileResumes.id,
        filename: profileResumes.filename,
        fileType: profileResumes.fileType,
        fileSize: profileResumes.fileSize,
        filePath: profileResumes.filePath,
        fileData: filters?.includeFileData ? profileResumes.fileData : sql`NULL`,
        candidateName: profileResumes.candidateName,
        candidateEmail: profileResumes.candidateEmail,
        processingStatus: profileResumes.processingStatus,
        uploadedAt: profileResumes.uploadedAt,
        uploadedBy: profileResumes.uploadedBy,
        // Get summary from metadata table instead of full text
        summaryText: resumeMetadata.summaryText,
      })
      .from(profileResumes)
      .leftJoin(resumeMetadata, eq(resumeMetadata.profileResumeId, profileResumes.id));

    if (filters?.searchTerm) {
      // Search in metadata first, fallback to content search
      query = query
        .leftJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
        .where(
          or(
            // Fast metadata search
            sql`${resumeMetadata.candidateNameNormalized} ILIKE ${`%${filters.searchTerm}%`}`,
            sql`${resumeMetadata.candidateEmailNormalized} ILIKE ${`%${filters.searchTerm}%`}`,
            sql`${profileResumes.filename} ILIKE ${`%${filters.searchTerm}%`}`,
            // Full-text search as fallback
            sql`to_tsvector('english', ${resumeContent.extractedText}) @@ plainto_tsquery('english', ${filters.searchTerm})`
          )
        );
    }

    const [resumes, [{ totalCount }]] = await Promise.all([
      query
        .orderBy(desc(profileResumes.uploadedAt))
        .limit(limit)
        .offset(offset),
      
      // Get total count for pagination
      db
        .select({ totalCount: count() })
        .from(profileResumes)
    ]);

    return {
      resumes: resumes as Array<ProfileResume>,
      totalCount: Number(totalCount),
      hasMore: (page * limit) < Number(totalCount)
    };
  }

  // Get profile resume metadata ONLY (ultra-fast)
  async getProfileResumeMetadata(filters?: {
    skills?: string[];
    companies?: string[];
    yearsExperience?: number;
    location?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    resumes: Array<ProfileResume & ResumeMetadata>;
    totalCount: number;
    hasMore: boolean;
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    
    let query = db
      .select({
        // Resume basic info
        id: profileResumes.id,
        filename: profileResumes.filename,
        fileType: profileResumes.fileType,
        fileSize: profileResumes.fileSize,
        candidateName: profileResumes.candidateName,
        candidateEmail: profileResumes.candidateEmail,
        processingStatus: profileResumes.processingStatus,
        uploadedAt: profileResumes.uploadedAt,
        uploadedBy: profileResumes.uploadedBy,
        // Structured metadata
        candidateNameNormalized: resumeMetadata.candidateNameNormalized,
        candidateEmailNormalized: resumeMetadata.candidateEmailNormalized,
        candidatePhone: resumeMetadata.candidatePhone,
        skills: resumeMetadata.skills,
        companies: resumeMetadata.companies,
        jobTitles: resumeMetadata.jobTitles,
        yearsExperience: resumeMetadata.yearsExperience,
        location: resumeMetadata.location,
        education: resumeMetadata.education,
        summaryText: resumeMetadata.summaryText,
      })
      .from(profileResumes)
      .innerJoin(resumeMetadata, eq(resumeMetadata.profileResumeId, profileResumes.id));

    // Apply filters using structured data (FAST!)
    const conditions = [];
    if (filters?.skills?.length) {
      conditions.push(sql`${resumeMetadata.skills} && ${filters.skills}`);
    }
    if (filters?.companies?.length) {
      conditions.push(sql`${resumeMetadata.companies} && ${filters.companies}`);
    }
    if (filters?.yearsExperience) {
      conditions.push(sql`${resumeMetadata.yearsExperience} >= ${filters.yearsExperience}`);
    }
    if (filters?.location) {
      conditions.push(sql`${resumeMetadata.location} ILIKE ${`%${filters.location}%`}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const [resumes, [{ totalCount }]] = await Promise.all([
      query
        .orderBy(desc(profileResumes.uploadedAt))
        .limit(limit)
        .offset(offset),
      
      db
        .select({ totalCount: count() })
        .from(profileResumes)
        .innerJoin(resumeMetadata, eq(resumeMetadata.profileResumeId, profileResumes.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
    ]);

    return {
      resumes: resumes as Array<ProfileResume & ResumeMetadata>,
      totalCount: Number(totalCount),
      hasMore: (page * limit) < Number(totalCount)
    };
  }

  // Get profile resume metadata only (NO file data, NO full text)
  async getProfileResume(id: number): Promise<ProfileResume | undefined> {
    const [resume] = await db
      .select({
        id: profileResumes.id,
        filename: profileResumes.filename,
        fileType: profileResumes.fileType,
        fileSize: profileResumes.fileSize,
        filePath: profileResumes.filePath,
        candidateName: profileResumes.candidateName,
        candidateEmail: profileResumes.candidateEmail,
        processingStatus: profileResumes.processingStatus,
        uploadedAt: profileResumes.uploadedAt,
        uploadedBy: profileResumes.uploadedBy,
        // Get summary instead of full text
        summaryText: resumeMetadata.summaryText,
      })
      .from(profileResumes)
      .leftJoin(resumeMetadata, eq(resumeMetadata.profileResumeId, profileResumes.id))
      .where(eq(profileResumes.id, id));
    return resume;
  }
  
  // Phase 1: Get FULL CONTENT only when explicitly requested (for View dialog)
  async getProfileResumeContent(id: number): Promise<{
    extractedText: string;
    compressedText?: string;
    wordCount?: number;
  } | null> {
    const [content] = await db
      .select({
        extractedText: resumeContent.extractedText,
        compressedText: resumeContent.compressedText,
        wordCount: resumeContent.wordCount,
      })
      .from(resumeContent)
      .where(eq(resumeContent.profileResumeId, id));
      
    if (!content) return null;
    
    // If we have compressed text, decompress it, otherwise use extracted text
    let finalText = content.extractedText;
    if (content.compressedText) {
      try {
        const { decompressText } = await import('./file-utils');
        finalText = await decompressText(content.compressedText);
      } catch (error) {
        console.warn(`Failed to decompress text for resume ${id}, using extracted text:`, error);
      }
    }
    
    return {
      extractedText: finalText,
      compressedText: content.compressedText,
      wordCount: content.wordCount
    };
  }
  
  // Phase 1: CRITICAL - Search with SNIPPETS only (massive memory savings)
  async searchProfileResumesWithSnippets(searchTerm: string, options?: {
    page?: number;
    limit?: number;
    maxSnippetLength?: number;
  }): Promise<{
    results: Array<ProfileResume & {
      rank: number;
      snippets: string;
      highlightedSnippets: string;
    }>;
    totalCount: number;
    hasMore: boolean;
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;
    const maxWords = options?.maxSnippetLength || 50;
    
    console.log("Snippet-based search starting for:", searchTerm);
    
    // Parse the search query
    const { parseSearchQuery, sanitizeTsquery } = await import('./search-parser');
    const parsed = parseSearchQuery(searchTerm);
    const sanitizedQuery = sanitizeTsquery(parsed.tsquery);
    const searchQuery = parsed.hasComplexLogic ? sanitizedQuery : searchTerm;
    
    // Use ts_headline for snippets - NO FULL TEXT!
    const tsHeadlineOptions = `'MaxWords=${maxWords}, MinWords=15, MaxFragments=3, StartSel=<mark>, StopSel=</mark>'`;
    
    let results;
    if (parsed.hasComplexLogic) {
      results = await db
        .select({
          // Basic resume info (NO fileData)
          id: profileResumes.id,
          filename: profileResumes.filename,
          fileType: profileResumes.fileType,
          fileSize: profileResumes.fileSize,
          candidateName: profileResumes.candidateName,
          candidateEmail: profileResumes.candidateEmail,
          processingStatus: profileResumes.processingStatus,
          uploadedAt: profileResumes.uploadedAt,
          uploadedBy: profileResumes.uploadedBy,
          // Search ranking and SNIPPETS ONLY
          rank: sql<number>`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), to_tsquery('english', ${searchQuery}))`,
          snippets: sql<string>`ts_headline('english', ${resumeContent.extractedText}, to_tsquery('english', ${searchQuery}), ${tsHeadlineOptions})`,
          highlightedSnippets: sql<string>`ts_headline('english', ${resumeContent.extractedText}, to_tsquery('english', ${searchQuery}), ${tsHeadlineOptions})`,
        })
        .from(profileResumes)
        .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
        .where(
          sql`to_tsvector('english', ${resumeContent.extractedText}) @@ to_tsquery('english', ${searchQuery})`
        )
        .orderBy(sql`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), to_tsquery('english', ${searchQuery})) DESC`)
        .limit(limit)
        .offset(offset);
    } else {
      results = await db
        .select({
          id: profileResumes.id,
          filename: profileResumes.filename,
          fileType: profileResumes.fileType,
          fileSize: profileResumes.fileSize,
          candidateName: profileResumes.candidateName,
          candidateEmail: profileResumes.candidateEmail,
          processingStatus: profileResumes.processingStatus,
          uploadedAt: profileResumes.uploadedAt,
          uploadedBy: profileResumes.uploadedBy,
          rank: sql<number>`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), plainto_tsquery('english', ${searchTerm}))`,
          snippets: sql<string>`ts_headline('english', ${resumeContent.extractedText}, plainto_tsquery('english', ${searchTerm}), ${tsHeadlineOptions})`,
          highlightedSnippets: sql<string>`ts_headline('english', ${resumeContent.extractedText}, plainto_tsquery('english', ${searchTerm}), ${tsHeadlineOptions})`,
        })
        .from(profileResumes)
        .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
        .where(
          sql`to_tsvector('english', ${resumeContent.extractedText}) @@ plainto_tsquery('english', ${searchTerm})`
        )
        .orderBy(sql`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), plainto_tsquery('english', ${searchTerm})) DESC`)
        .limit(limit)
        .offset(offset);
    }

    // Get total count for pagination
    const countQuery = parsed.hasComplexLogic
      ? sql`to_tsvector('english', ${resumeContent.extractedText}) @@ to_tsquery('english', ${searchQuery})`
      : sql`to_tsvector('english', ${resumeContent.extractedText}) @@ plainto_tsquery('english', ${searchTerm})`;
      
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(profileResumes)
      .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
      .where(countQuery);

    console.log(`Snippet search found ${results.length} results (${totalCount} total)`);
    
    return {
      results: results as Array<ProfileResume & { rank: number; snippets: string; highlightedSnippets: string; }>,
      totalCount: Number(totalCount),
      hasMore: (page * limit) < Number(totalCount)
    };
  }

  async createProfileResume(resume: InsertProfileResume, extractedText: string): Promise<ProfileResume> {
    return await db.transaction(async (tx) => {
      // Create the profile resume
      const [createdResume] = await tx
        .insert(profileResumes)
        .values(resume)
        .returning();

      // Create content hash for duplicate detection
      const crypto = await import('crypto');
      const contentHash = crypto.createHash('sha256').update(extractedText).digest('hex');

      // Create the resume content
      await tx
        .insert(resumeContent)
        .values({
          profileResumeId: createdResume.id,
          extractedText,
          contentHash,
        });

      return createdResume;
    });
  }

  async deleteProfileResume(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      // Delete content first (cascade should handle this, but being explicit)
      await tx.delete(resumeContent).where(eq(resumeContent.profileResumeId, id));
      // Delete the resume
      await tx.delete(profileResumes).where(eq(profileResumes.id, id));
    });
  }

  async searchProfileResumesByContent(searchTerm: string): Promise<Array<ProfileResume & { extractedText: string; rank: number; highlightedText?: string }>> {
    try {
      console.log("Advanced search starting for:", searchTerm);
      
      // Parse the search query to handle complex Boolean logic
      const { parseSearchQuery, sanitizeTsquery } = await import('./search-parser');
      const parsed = parseSearchQuery(searchTerm);
      const sanitizedQuery = sanitizeTsquery(parsed.tsquery);
      
      console.log("Parsed search query:", {
        original: parsed.originalQuery,
        tsquery: parsed.tsquery,
        sanitized: sanitizedQuery,
        hasComplexLogic: parsed.hasComplexLogic,
        terms: parsed.searchTerms
      });
      
      // Use to_tsquery for complex Boolean queries, plainto_tsquery for simple ones
      const searchQuery = parsed.hasComplexLogic ? sanitizedQuery : searchTerm;
      
      let results;
      
      if (parsed.hasComplexLogic) {
        // Complex Boolean search with to_tsquery
        results = await db
          .select({
            id: profileResumes.id,
            filename: profileResumes.filename,
            fileType: profileResumes.fileType,
            fileSize: profileResumes.fileSize,
            fileData: profileResumes.fileData,
            candidateName: profileResumes.candidateName,
            candidateEmail: profileResumes.candidateEmail,
            uploadedAt: profileResumes.uploadedAt,
            uploadedBy: profileResumes.uploadedBy,
            extractedText: resumeContent.extractedText,
            rank: sql<number>`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), to_tsquery('english', ${searchQuery}))`,
            highlightedText: sql<string>`ts_headline('english', ${resumeContent.extractedText}, to_tsquery('english', ${searchQuery}), 'MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>')`,
          })
          .from(profileResumes)
          .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
          .where(
            sql`to_tsvector('english', ${resumeContent.extractedText}) @@ to_tsquery('english', ${searchQuery})`
          )
          .orderBy(sql`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), to_tsquery('english', ${searchQuery})) DESC`)
          .limit(100);
      } else {
        // Simple search with plainto_tsquery
        results = await db
          .select({
            id: profileResumes.id,
            filename: profileResumes.filename,
            fileType: profileResumes.fileType,
            fileSize: profileResumes.fileSize,
            fileData: profileResumes.fileData,
            candidateName: profileResumes.candidateName,
            candidateEmail: profileResumes.candidateEmail,
            uploadedAt: profileResumes.uploadedAt,
            uploadedBy: profileResumes.uploadedBy,
            extractedText: resumeContent.extractedText,
            rank: sql<number>`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), plainto_tsquery('english', ${searchQuery}))`,
            highlightedText: sql<string>`ts_headline('english', ${resumeContent.extractedText}, plainto_tsquery('english', ${searchQuery}), 'MaxWords=50, MinWords=10, StartSel=<mark>, StopSel=</mark>')`,
          })
          .from(profileResumes)
          .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
          .where(
            sql`to_tsvector('english', ${resumeContent.extractedText}) @@ plainto_tsquery('english', ${searchQuery})`
          )
          .orderBy(sql`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), plainto_tsquery('english', ${searchQuery})) DESC`)
          .limit(50);
      }
      
      console.log(`Found ${results.length} matching resumes`);
      
      // If no results found with full-text search, try ILIKE search for numbers/patterns
      if (results.length === 0 && /^\d+$/.test(searchTerm)) {
        console.log("No full-text results for number search, trying ILIKE fallback...");
        const likePattern = `%${searchTerm}%`;
        
        const fallbackResults = await db
          .select({
            id: profileResumes.id,
            filename: profileResumes.filename,
            fileType: profileResumes.fileType,
            fileSize: profileResumes.fileSize,
            fileData: profileResumes.fileData,
            candidateName: profileResumes.candidateName,
            candidateEmail: profileResumes.candidateEmail,
            uploadedAt: profileResumes.uploadedAt,
            uploadedBy: profileResumes.uploadedBy,
            extractedText: resumeContent.extractedText,
            rank: sql<number>`1.0`,
            highlightedText: sql<string>`
              regexp_replace(
                substring(${resumeContent.extractedText}, 1, 500),
                ${searchTerm},
                '<mark>' || ${searchTerm} || '</mark>',
                'gi'
              )
            `,
          })
          .from(profileResumes)
          .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
          .where(ilike(resumeContent.extractedText, likePattern))
          .orderBy(desc(profileResumes.uploadedAt))
          .limit(50);
        
        console.log(`ILIKE fallback found ${fallbackResults.length} matching resumes`);
        return fallbackResults;
      }
      
      return results;
      
    } catch (error) {
      console.error("Advanced search failed, falling back to simple search:", error);
      
      // Fallback to simple search if complex query fails
      const results = await db
        .select({
          id: profileResumes.id,
          filename: profileResumes.filename,
          fileType: profileResumes.fileType,
          fileSize: profileResumes.fileSize,
          fileData: profileResumes.fileData,
          candidateName: profileResumes.candidateName,
          candidateEmail: profileResumes.candidateEmail,
          uploadedAt: profileResumes.uploadedAt,
          uploadedBy: profileResumes.uploadedBy,
          extractedText: resumeContent.extractedText,
          rank: sql<number>`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), plainto_tsquery('english', ${searchTerm}))`,
        })
        .from(profileResumes)
        .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
        .where(
          sql`to_tsvector('english', ${resumeContent.extractedText}) @@ plainto_tsquery('english', ${searchTerm})`
        )
        .orderBy(sql`ts_rank(to_tsvector('english', ${resumeContent.extractedText}), plainto_tsquery('english', ${searchTerm})) DESC`)
        .limit(25);

      return results;
    }
  }

  async getProfileResumeContent(resumeId: number): Promise<ResumeContent | undefined> {
    const [content] = await db
      .select()
      .from(resumeContent)
      .where(eq(resumeContent.profileResumeId, resumeId));
    return content;
  }

  async searchProfileResumesByPhone(phonePattern: string): Promise<Array<ProfileResume & { extractedText?: string; highlightedText?: string; rank?: number }>> {
    console.log(`Phone search starting for pattern: ${phonePattern}`);
    
    try {
      // Simplified phone search using LIKE and ILIKE patterns
      const likePattern = `%${phonePattern}%`;
      
      const results = await db
        .select({
          id: profileResumes.id,
          filename: profileResumes.filename,
          fileType: profileResumes.fileType,
          fileSize: profileResumes.fileSize,
          fileData: profileResumes.fileData,
          candidateName: profileResumes.candidateName,
          candidateEmail: profileResumes.candidateEmail,
          uploadedAt: profileResumes.uploadedAt,
          uploadedBy: profileResumes.uploadedBy,
          extractedText: resumeContent.extractedText,
          rank: sql<number>`1.0`,
          highlightedText: sql<string>`
            CASE 
              WHEN ${resumeContent.extractedText} ILIKE ${likePattern} THEN 
                regexp_replace(${resumeContent.extractedText}, ${phonePattern}, '<mark>' || ${phonePattern} || '</mark>', 'gi')
              ELSE 
                substring(${resumeContent.extractedText}, 1, 300) || '...'
            END
          `,
        })
        .from(profileResumes)
        .innerJoin(resumeContent, eq(resumeContent.profileResumeId, profileResumes.id))
        .where(
          or(
            ilike(resumeContent.extractedText, likePattern),
            ilike(profileResumes.candidateEmail, likePattern)
          )
        )
        .orderBy(desc(profileResumes.uploadedAt))
        .limit(50);
      
      console.log(`Phone search found ${results.length} matching resumes`);
      return results;
      
    } catch (error) {
      console.error("Phone search failed:", error);
      return [];
    }
  }
}

// Export an instance to use throughout the app
export const storage = new DatabaseStorage();