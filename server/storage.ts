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
    console.log("\n\n===== STARTING FRAUD DETECTION ANALYSIS =====");
    console.log("📋 CANDIDATE DATA BEING CHECKED:");
    console.log(`Input client names (${clientNames.length}): ${JSON.stringify(clientNames)}`);
    console.log(`Input relevant dates (${relevantDates.length}): ${JSON.stringify(relevantDates)}`);
    console.log(`Excluding candidate ID: ${excludeCandidateId || 'none'}`);

    // Normalize input company names for better matching
    const normalizedInputCompanies = clientNames.map(name => {
      // Extract just the main company name, removing locations and extra details
      // First split by commas and take first part
      let normalized = name.split(',')[0].toLowerCase().trim();
      // Then extract just the main company name (before any spaces)
      const mainCompanyName = normalized.split(/\s+/)[0];
      console.log(`Normalized company: "${name}" → "${mainCompanyName}" (from "${normalized}")`);
      return mainCompanyName;
    });

    // Normalize input dates for better matching
    const normalizedInputDates = relevantDates.map(date => {
      // Extract and standardize date components (years, months)
      const rawComponents = date.toLowerCase()
        .replace(/[^a-z0-9]/gi, ' ')  // Replace non-alphanumeric with spaces
        .split(/\s+/)                  // Split on whitespace
        .filter(Boolean);              // Remove empty strings
      
      // Extract just the year parts and month names/numbers
      const yearParts = rawComponents.filter(part => /^(19|20)\d{2}$/.test(part));
      const monthParts = rawComponents.filter(part => 
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[01]?\d)$/.test(part)
      );
      
      const components = [...yearParts, ...monthParts];
      
      console.log(`Normalized date: "${date}" → Components: ${JSON.stringify(components)}`);
      return {
        original: date,
        components: components
      };
    });

    // Get all resume data from the database
    const allResumeData = await this.getAllResumeData();
    console.log(`\nTotal resume data records in database: ${allResumeData.length}`);
    
    // Filter out the candidate we're validating (if provided)
    const otherCandidatesData = excludeCandidateId 
      ? allResumeData.filter(data => data.candidateId !== excludeCandidateId) 
      : allResumeData;
    
    console.log(`Comparing against ${otherCandidatesData.length} other candidates' resume data\n`);
    
    // Calculate similarity scores for each candidate
    const similarCandidates = otherCandidatesData
      .map(data => {
        console.log(`\n-------------------------------------`);
        console.log(`🔍 Checking candidate ID: ${data.candidateId}`);
        
        // We need to ensure the arrays exist
        const candidateClientNames = data.clientNames || [];
        const candidateRelevantDates = data.relevantDates || [];
        
        // Skip candidates with no data
        if (candidateClientNames.length === 0 && candidateRelevantDates.length === 0) {
          console.log(`Skipping candidate ${data.candidateId} - no employment history data`);
          return null;
        }
        
        console.log(`Candidate companies (${candidateClientNames.length}): ${JSON.stringify(candidateClientNames)}`);
        console.log(`Candidate dates (${candidateRelevantDates.length}): ${JSON.stringify(candidateRelevantDates)}`);
        
        // Normalize candidate company names using the same approach
        const normalizedCandidateCompanies = candidateClientNames.map(name => {
          // First split by commas and take first part
          let normalized = name.split(',')[0].toLowerCase().trim();
          // Then extract just the main company name (before any spaces)
          const mainCompanyName = normalized.split(/\s+/)[0];
          console.log(`Normalized candidate company: "${name}" → "${mainCompanyName}" (from "${normalized}")`);
          return mainCompanyName;
        });
        
        console.log(`Normalized candidate companies: ${JSON.stringify(normalizedCandidateCompanies)}`);
        
        // Check for job chronology match - look for matching sequence of companies
        let hasChronologyMatch = false;
        
        // Count matching companies with company-specific logging
        const matchingCompanies = [];
        for (const company of normalizedInputCompanies) {
          const matchIndex = normalizedCandidateCompanies.findIndex(c => c === company);
          if (matchIndex !== -1) {
            matchingCompanies.push({
              inputCompany: company,
              candidateCompany: candidateClientNames[matchIndex],
              index: matchIndex
            });
            console.log(`✓ COMPANY MATCH: "${candidateClientNames[matchIndex]}" matches "${company}"`);
          }
        }
        
        // Calculate company match percentage
        const companyMatchPercentage = normalizedInputCompanies.length > 0 ?
          (matchingCompanies.length / normalizedInputCompanies.length) * 100 : 0;
          
        console.log(`Company match percentage: ${companyMatchPercentage.toFixed(1)}%`);
        
        // Check if companies appear in the same order (chronology)
        if (matchingCompanies.length >= 2) {
          const indices = matchingCompanies.map(m => m.index);
          const isSorted = indices.every((val, i, arr) => !i || val >= arr[i - 1]);
          hasChronologyMatch = isSorted;
          
          console.log(`Company indices in candidate data: [${indices.join(', ')}]`);
          console.log(`Companies appear in same order: ${isSorted ? "YES" : "NO"}`);
        }
        
        // Normalize candidate dates for better comparisons
        const normalizedCandidateDates = candidateRelevantDates.map(date => {
          // Extract and standardize date components
          const rawComponents = date.toLowerCase()
            .replace(/[^a-z0-9]/gi, ' ')
            .split(/\s+/)
            .filter(Boolean);
          
          // Extract just year parts and month names/numbers
          const yearParts = rawComponents.filter(part => /^(19|20)\d{2}$/.test(part));
          const monthParts = rawComponents.filter(part => 
            /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|[01]?\d)$/.test(part)
          );
          
          const components = [...yearParts, ...monthParts];
          
          return {
            original: date,
            components: components
          };
        });
        
        // Count matching date components
        let totalDateComponentMatches = 0;
        let totalInputDateComponents = 0;
        let totalMatchingDates = 0;
        
        normalizedInputDates.forEach(inputDate => {
          if (inputDate.components.length > 0) {
            totalInputDateComponents += inputDate.components.length;
            
            normalizedCandidateDates.forEach(candidateDate => {
              if (candidateDate.components.length > 0) {
                // Count how many components match
                const matches = inputDate.components.filter(component => 
                  candidateDate.components.includes(component)
                );
                
                if (matches.length > 0) {
                  totalDateComponentMatches += matches.length;
                  
                  // If most components match (>50%), consider it a matching date
                  if (matches.length / inputDate.components.length > 0.5) {
                    totalMatchingDates++;
                    console.log(`✓ DATE MATCH: "${inputDate.original}" ~ "${candidateDate.original}"`);
                    console.log(`  Matching components: [${matches.join(', ')}]`);
                  }
                }
              }
            });
          }
        });
        
        // Calculate date match percentage
        const dateComponentMatchPercentage = totalInputDateComponents > 0 ?
          (totalDateComponentMatches / totalInputDateComponents) * 100 : 0;
          
        console.log(`Date component match percentage: ${dateComponentMatchPercentage.toFixed(1)}%`);
        console.log(`Total matching dates: ${totalMatchingDates} of ${normalizedInputDates.length}`);
        
        // Calculate overall similarity score with weighted components:
        // - 70% weight on company matches
        // - 30% weight on date matches
        const similarityScore = Math.round(
          (companyMatchPercentage * 0.7) + (dateComponentMatchPercentage * 0.3)
        );
        
        // Check if this is an identical chronology match
        const hasIdenticalChronology = hasChronologyMatch && 
          companyMatchPercentage >= 90 && 
          dateComponentMatchPercentage >= 80;
          
        // Check if this is a high similarity match
        const isHighSimilarity = similarityScore >= 80;
        
        console.log(`\nCandidate ${data.candidateId} detection results:`);
        console.log(`- Company matches: ${matchingCompanies.length}/${normalizedInputCompanies.length} (${companyMatchPercentage.toFixed(1)}%)`);
        console.log(`- Date component matches: ${totalDateComponentMatches}/${totalInputDateComponents} (${dateComponentMatchPercentage.toFixed(1)}%)`);
        console.log(`- Has identical chronology: ${hasIdenticalChronology ? "YES ⚠️" : "NO"}`);
        console.log(`- Is high similarity: ${isHighSimilarity ? "YES ⚠️" : "NO"}`);
        console.log(`- Overall similarity score: ${similarityScore}%`);
        
        return {
          candidateId: data.candidateId,
          similarityScore,
          clientNames: candidateClientNames,
          relevantDates: candidateRelevantDates,
          hasIdenticalChronology,
          isHighSimilarity,
          companyMatchPercentage,
          dateComponentMatchPercentage,
          matchingCompanies: matchingCompanies.length,
          totalCompanies: normalizedInputCompanies.length,
          matchingDateComponents: totalDateComponentMatches,
          totalDateComponents: totalInputDateComponents
        };
      })
      .filter(Boolean) // Remove null entries
      // Filter candidates with at least 50% similarity and sort by similarity score (highest first)
      .filter(candidate => candidate.similarityScore >= 50)
      .sort((a, b) => b.similarityScore - a.similarityScore);
    
    // Log the results for debugging
    console.log(`\n===== FRAUD DETECTION RESULTS SUMMARY =====`);
    console.log(`Found ${similarCandidates.length} candidates with significant similarity (≥50%)`);
    
    if (similarCandidates.length > 0) {
      console.log(`Top matches:`);
      similarCandidates.slice(0, 5).forEach((candidate, idx) => {
        console.log(`Match #${idx + 1}: Candidate ID ${candidate.candidateId}, Similarity: ${candidate.similarityScore}%, Identical Chronology: ${candidate.hasIdenticalChronology ? "YES ⚠️" : "No"}`);
      });
      
      // Log high similarity matches specifically
      const highSimilarityMatches = similarCandidates.filter(c => c.isHighSimilarity);
      if (highSimilarityMatches.length > 0) {
        console.log(`⚠️ WARNING: Found ${highSimilarityMatches.length} candidates with HIGH SIMILARITY (≥80%)`);
      }
      
      // Log identical chronology matches specifically
      const identicalChronologyMatches = similarCandidates.filter(c => c.hasIdenticalChronology);
      if (identicalChronologyMatches.length > 0) {
        console.log(`⚠️ CRITICAL: Found ${identicalChronologyMatches.length} candidates with IDENTICAL JOB CHRONOLOGY`);
      }
    } else {
      console.log("No similar employment histories found.");
    }
    
    console.log("===== FRAUD DETECTION ANALYSIS COMPLETE =====\n\n");
    
    // Return the matches (excluding debug fields for the API response)
    return similarCandidates.map(({ 
      candidateId, similarityScore, clientNames, relevantDates
    }) => ({
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