import { activities, candidates, jobs, jobAssignments, resumeData, submissions, users } from "@shared/schema";
import type { 
  Activity, Candidate, InsertActivity, InsertCandidate, InsertJob, InsertJobAssignment, 
  InsertResumeData, InsertSubmission, InsertUser, Job, JobAssignment, 
  ResumeData, Submission, User 
} from "@shared/schema";

// Storage interface
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

// Memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private jobs: Map<number, Job>;
  private jobAssignments: Map<number, JobAssignment>;
  private candidates: Map<number, Candidate>;
  private resumeData: Map<number, ResumeData>;
  private submissions: Map<number, Submission>;
  private activities: Map<number, Activity>;
  
  private currentUserId: number;
  private currentJobId: number;
  private currentJobAssignmentId: number;
  private currentCandidateId: number;
  private currentResumeDataId: number;
  private currentSubmissionId: number;
  private currentActivityId: number;
  private currentExternalJobId: number;

  constructor() {
    this.users = new Map();
    this.jobs = new Map();
    this.jobAssignments = new Map();
    this.candidates = new Map();
    this.resumeData = new Map();
    this.submissions = new Map();
    this.activities = new Map();
    
    this.currentUserId = 1;
    this.currentJobId = 1;
    this.currentJobAssignmentId = 1;
    this.currentCandidateId = 1;
    this.currentResumeDataId = 1;
    this.currentSubmissionId = 1;
    this.currentActivityId = 1;
    this.currentExternalJobId = 1;
    
    // Create some initial data
    this.seedInitialData();
  }

  private seedInitialData() {
    // Create default admin user
    this.createUser({
      username: "admin",
      password: "admin123",
      name: "Admin User",
      email: "admin@example.com",
      role: "admin"
    });
    
    // Create a recruiter lead
    this.createUser({
      username: "johndoe",
      password: "password123",
      name: "John Doe",
      email: "john.doe@example.com",
      role: "lead"
    });
    
    // Create some recruiters
    this.createUser({
      username: "janesmith",
      password: "password123",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      role: "recruiter"
    });
    
    this.createUser({
      username: "robertjohnson",
      password: "password123",
      name: "Robert Johnson",
      email: "robert.johnson@example.com",
      role: "recruiter"
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const now = new Date();
    const user: User = { ...insertUser, id, createdAt: now };
    this.users.set(id, user);
    return user;
  }
  
  async getRecruiters(): Promise<User[]> {
    return Array.from(this.users.values()).filter(
      (user) => user.role === "recruiter" || user.role === "lead"
    );
  }

  // Job operations
  async getJobs(filters?: { status?: string; date?: Date; searchTerm?: string }): Promise<Job[]> {
    let result = Array.from(this.jobs.values());
    
    if (filters) {
      if (filters.status) {
        result = result.filter(job => job.status === filters.status);
      }
      
      if (filters.date) {
        const filterDate = new Date(filters.date);
        filterDate.setHours(0, 0, 0, 0);
        
        result = result.filter(job => {
          const jobDate = new Date(job.createdAt);
          jobDate.setHours(0, 0, 0, 0);
          return jobDate.getTime() === filterDate.getTime();
        });
      }
      
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        result = result.filter(job => 
          job.title.toLowerCase().includes(term) || 
          job.jobId.toLowerCase().includes(term) ||
          job.description.toLowerCase().includes(term)
        );
      }
    }
    
    // Sort by creation date, newest first
    return result.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getJob(id: number): Promise<Job | undefined> {
    return this.jobs.get(id);
  }
  
  async getJobByJobId(jobId: string): Promise<Job | undefined> {
    return Array.from(this.jobs.values()).find(
      (job) => job.jobId === jobId
    );
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const id = this.currentJobId++;
    const now = new Date();
    const year = now.getFullYear();
    const jobId = `JOB-${year}-${String(this.currentExternalJobId++).padStart(3, '0')}`;
    
    const job: Job = { 
      ...insertJob, 
      id, 
      jobId,
      createdAt: now
    };
    
    this.jobs.set(id, job);
    return job;
  }
  
  async updateJobStatus(id: number, status: string): Promise<Job> {
    const job = await this.getJob(id);
    if (!job) {
      throw new Error(`Job with ID ${id} not found`);
    }
    
    const updatedJob = { ...job, status };
    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  // Job assignment operations
  async assignRecruitersToJob(jobId: number, recruiterIds: number[]): Promise<JobAssignment[]> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found`);
    }
    
    const assignments: JobAssignment[] = [];
    
    for (const recruiterId of recruiterIds) {
      // Check if user exists
      const user = await this.getUser(recruiterId);
      if (!user) {
        throw new Error(`User with ID ${recruiterId} not found`);
      }
      
      // Check if assignment already exists
      const existingAssignment = Array.from(this.jobAssignments.values()).find(
        assignment => assignment.jobId === jobId && assignment.userId === recruiterId
      );
      
      if (!existingAssignment) {
        const id = this.currentJobAssignmentId++;
        const now = new Date();
        
        const assignment: JobAssignment = {
          id,
          jobId,
          userId: recruiterId,
          assignedAt: now
        };
        
        this.jobAssignments.set(id, assignment);
        assignments.push(assignment);
      }
    }
    
    return assignments;
  }
  
  async getJobAssignments(jobId: number): Promise<JobAssignment[]> {
    return Array.from(this.jobAssignments.values()).filter(
      assignment => assignment.jobId === jobId
    );
  }
  
  async getUserAssignedJobs(userId: number): Promise<Job[]> {
    const assignedJobIds = Array.from(this.jobAssignments.values())
      .filter(assignment => assignment.userId === userId)
      .map(assignment => assignment.jobId);
    
    return Array.from(this.jobs.values()).filter(
      job => assignedJobIds.includes(job.id)
    );
  }

  // Candidate operations
  async getCandidates(): Promise<Candidate[]> {
    return Array.from(this.candidates.values());
  }

  async getCandidate(id: number): Promise<Candidate | undefined> {
    return this.candidates.get(id);
  }
  
  async getCandidateByIdentity(dobMonth: number, dobDay: number, ssn4: string): Promise<Candidate | undefined> {
    return Array.from(this.candidates.values()).find(
      candidate => 
        candidate.dobMonth === dobMonth && 
        candidate.dobDay === dobDay && 
        candidate.ssn4 === ssn4
    );
  }

  async createCandidate(insertCandidate: InsertCandidate): Promise<Candidate> {
    const id = this.currentCandidateId++;
    const now = new Date();
    
    const candidate: Candidate = { 
      ...insertCandidate, 
      id, 
      createdAt: now
    };
    
    this.candidates.set(id, candidate);
    return candidate;
  }

  // Resume data operations
  async getResumeData(candidateId: number): Promise<ResumeData | undefined> {
    return Array.from(this.resumeData.values()).find(
      data => data.candidateId === candidateId
    );
  }

  async createResumeData(insertResumeData: InsertResumeData): Promise<ResumeData> {
    const id = this.currentResumeDataId++;
    const now = new Date();
    
    const resumeDataEntry: ResumeData = { 
      ...insertResumeData, 
      id, 
      uploadedAt: now
    };
    
    this.resumeData.set(id, resumeDataEntry);
    return resumeDataEntry;
  }

  // Submission operations
  async getSubmissions(filters?: { jobId?: number, candidateId?: number, recruiterId?: number }): Promise<Submission[]> {
    let result = Array.from(this.submissions.values());
    
    if (filters) {
      if (filters.jobId) {
        result = result.filter(submission => submission.jobId === filters.jobId);
      }
      
      if (filters.candidateId) {
        result = result.filter(submission => submission.candidateId === filters.candidateId);
      }
      
      if (filters.recruiterId) {
        result = result.filter(submission => submission.recruiterId === filters.recruiterId);
      }
    }
    
    // Sort by submission date, newest first
    return result.sort((a, b) => 
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  async getSubmission(id: number): Promise<Submission | undefined> {
    return this.submissions.get(id);
  }
  
  async getSubmissionByJobAndCandidate(jobId: number, candidateId: number): Promise<Submission | undefined> {
    return Array.from(this.submissions.values()).find(
      submission => submission.jobId === jobId && submission.candidateId === candidateId
    );
  }

  async createSubmission(insertSubmission: InsertSubmission): Promise<Submission> {
    const id = this.currentSubmissionId++;
    const now = new Date();
    
    const submission: Submission = { 
      ...insertSubmission, 
      id, 
      submittedAt: now,
      updatedAt: now
    };
    
    this.submissions.set(id, submission);
    return submission;
  }
  
  async updateSubmissionStatus(id: number, status: string): Promise<Submission> {
    const submission = await this.getSubmission(id);
    if (!submission) {
      throw new Error(`Submission with ID ${id} not found`);
    }
    
    const now = new Date();
    const updatedSubmission = { ...submission, status, updatedAt: now };
    this.submissions.set(id, updatedSubmission);
    return updatedSubmission;
  }

  // Activity operations
  async getActivities(limit: number = 20): Promise<Activity[]> {
    const result = Array.from(this.activities.values());
    
    // Sort by creation date, newest first
    return result
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = this.currentActivityId++;
    const now = new Date();
    
    const activity: Activity = { 
      ...insertActivity, 
      id, 
      createdAt: now
    };
    
    this.activities.set(id, activity);
    return activity;
  }
  
  // Dashboard stats
  async getDashboardStats(): Promise<{
    activeJobs: number;
    totalSubmissions: number;
    newToday: number;
    successRate: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const activeJobs = Array.from(this.jobs.values()).filter(
      job => job.status === "active"
    ).length;
    
    const totalSubmissions = this.submissions.size;
    
    const newToday = Array.from(this.submissions.values()).filter(submission => {
      const submissionDate = new Date(submission.submittedAt);
      submissionDate.setHours(0, 0, 0, 0);
      return submissionDate.getTime() === today.getTime();
    }).length;
    
    // Calculate success rate (submissions that reached 'hired' status)
    const hiredSubmissions = Array.from(this.submissions.values()).filter(
      submission => submission.status === "hired"
    ).length;
    
    const successRate = totalSubmissions > 0 
      ? Math.round((hiredSubmissions / totalSubmissions) * 100) 
      : 0;
    
    return {
      activeJobs,
      totalSubmissions,
      newToday,
      successRate
    };
  }
}

export const storage = new MemStorage();
