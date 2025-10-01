import { pgTable, text, serial, integer, date, timestamp, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

// Users table (recruiters and leads)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["recruiter", "lead", "admin", "sub-admin", "manager"] }).notNull().default("recruiter"),
  status: text("status", { enum: ["pending", "approved", "rejected", "deactivated"] }).notNull().default("pending"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Jobs table
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(), // External job ID (e.g., JOB-2023-001)
  title: text("title").notNull(),
  description: text("description").notNull(),
  client: text("client"), // Client name
  implOrPv: text("impl_or_pv"), // Implementation or Professional Services
  city: text("city"), // City for job location
  state: text("state"), // State for job location
  jobType: text("job_type", { enum: ["onsite", "remote", "hybrid"] }), // Job type (onsite, remote, hybrid)
  rate: text("rate"), // Pay rate (e.g., "$55/hr C2C", "$75-85/hour")
  interviewType: text("interview_type", { enum: ["phone", "video", "onsite", "hybrid"] }), // Interview type
  visaRestrictions: text("visa_restrictions"), // Visa/sponsorship restrictions
  requiredSkills: text("required_skills").array(), // Array of required skills
  status: text("status", { enum: ["active", "reviewing", "closed"] }).notNull().default("active"),
  emailMessageId: text("email_message_id"), // Email Message-ID from job assignment notification
  emailThreadReferences: text("email_thread_references"), // Email References header for threading
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

// Many-to-many relationship between jobs and users (job assignments)
export const jobAssignments = pgTable("job_assignments", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  userId: integer("user_id").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Ensure a user can only be assigned to a job once
    unique: uniqueIndex("job_user_unique_idx").on(table.jobId, table.userId),
  };
});

// Candidates table
export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  middleName: text("middle_name"),
  lastName: text("last_name").notNull(),
  dobMonth: integer("dob_month"), // Made optional for security reasons
  dobDay: integer("dob_day"), // Made optional for security reasons
  ssn4: text("ssn_last_four"), // Made optional for security reasons
  location: text("location").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  linkedIn: text("linkedin"),
  workAuthorization: text("work_authorization").notNull(),
  // New field to track unreal candidates
  isUnreal: boolean("is_unreal").default(false).notNull(),
  // New field to store reason for marking as unreal
  unrealReason: text("unreal_reason"),
  // Fields to track suspicious activity at the candidate level
  isSuspicious: boolean("is_suspicious").default(false).notNull(),
  suspiciousReason: text("suspicious_reason"),
  suspiciousSeverity: text("suspicious_severity", { enum: ["LOW", "MEDIUM", "HIGH"] }),
  // New field to track when candidate was validated
  lastValidated: timestamp("last_validated"),
  // New field to track who validated the candidate
  validatedBy: integer("validated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
});

// Resume data table (extracted metadata)
export const resumeData = pgTable("resume_data", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id),
  clientNames: text("client_names").array(),
  jobTitles: text("job_titles").array(),
  relevantDates: text("relevant_dates").array(),
  skills: text("skills").array(),
  education: text("education").array(),
  extractedText: text("extracted_text"),
  fileName: text("file_name"),  // Name of the original resume file
  fileContent: text("file_content"),  // Base64 encoded file content - for storing actual resume files
  fileSize: integer("file_size"),  // File size in bytes
  mimeType: text("mime_type"),  // MIME type of the file (e.g., application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document)
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Submissions table
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id),
  recruiterId: integer("recruiter_id").notNull().references(() => users.id),
  status: text("status", { 
    enum: [
      "New", 
      "Submitted To Vendor", 
      "Rejected By Vendor", 
      "Submitted To Client", 
      "Interview Scheduled", 
      "Interview Completed", 
      "Offer Extended", 
      "Offer Accepted", 
      "Offer Declined", 
      "Rejected"
    ] 
  }).notNull().default("New"),
  matchScore: integer("match_score").default(65),  // Default match score of 65%
  agreedRate: integer("agreed_rate").default(0),  // Default to 0 for better handling
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  notes: text("notes"),
  feedback: text("feedback"),  // Feedback about status changes
  isSuspicious: boolean("is_suspicious").default(false).notNull(),  // Flag for suspicious submissions
  suspiciousReason: text("suspicious_reason"),  // Reason why the submission was flagged
  suspiciousSeverity: text("suspicious_severity", { enum: ["LOW", "MEDIUM", "HIGH"] }),  // Severity level
  lastUpdatedBy: integer("last_updated_by").references(() => users.id),
}, (table) => {
  return {
    // Ensure each candidate is only submitted once per job
    unique: uniqueIndex("job_candidate_unique_idx").on(table.jobId, table.candidateId),
  };
});

// Candidate validation history table
export const candidateValidations = pgTable("candidate_validations", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull().references(() => candidates.id),
  jobId: integer("job_id").references(() => jobs.id), // Job they were being submitted to
  // Validation details
  validationType: text("validation_type", { enum: ["initial", "resubmission"] }).notNull(),
  validationResult: text("validation_result", { enum: ["matching", "unreal"] }).notNull(),
  // Previous resume data
  previousClientNames: text("previous_client_names").array(),
  previousJobTitles: text("previous_job_titles").array(),
  previousDates: text("previous_dates").array(),
  // New resume data
  newClientNames: text("new_client_names").array(),
  newJobTitles: text("new_job_titles").array(),
  newDates: text("new_dates").array(),
  // Resume file details
  resumeFileName: text("resume_file_name"),
  // Validation metadata
  reason: text("reason"),
  validatedAt: timestamp("validated_at").defaultNow().notNull(),
  validatedBy: integer("validated_by").notNull().references(() => users.id),
});

// Activities table (for activity feed)
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type", { 
    enum: [
      "job_created", 
      "job_closed",
      "job_updated",
      "candidate_submitted", 
      "status_changed", 
      "duplicate_detected", 
      "submission_status_changed",
      "system_integration",
      "candidate_validated"  // New activity type for candidate validation
    ] 
  }).notNull(),
  userId: integer("user_id").references(() => users.id),
  jobId: integer("job_id").references(() => jobs.id),
  candidateId: integer("candidate_id").references(() => candidates.id),
  submissionId: integer("submission_id").references(() => submissions.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Public job applications table (for non-admin users applying to jobs)
export const publicApplications = pgTable("public_applications", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => jobs.id),
  // Applicant information
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  // Optional fields
  coverLetter: text("cover_letter"),
  resumeFileName: text("resume_file_name"),
  resumeContent: text("resume_content"), // Extracted text from resume
  // Application status
  status: text("status", { 
    enum: ["pending", "reviewing", "shortlisted", "rejected", "hired"] 
  }).notNull().default("pending"),
  // Timestamps
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  notes: text("notes"), // Admin/recruiter notes
});

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertJobAssignmentSchema = createInsertSchema(jobAssignments).omit({ id: true, assignedAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true }).extend({
  dobMonth: z.union([z.number(), z.string().transform(val => val === '' ? undefined : Number(val))]).optional(),
  dobDay: z.union([z.number(), z.string().transform(val => val === '' ? undefined : Number(val))]).optional()
});
export const insertResumeDataSchema = createInsertSchema(resumeData).omit({ id: true, uploadedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, submittedAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertCandidateValidationSchema = createInsertSchema(candidateValidations).omit({ id: true, validatedAt: true });
export const insertPublicApplicationSchema = createInsertSchema(publicApplications).omit({ id: true, appliedAt: true });

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;

export type JobAssignment = typeof jobAssignments.$inferSelect;
export type InsertJobAssignment = z.infer<typeof insertJobAssignmentSchema>;

export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

export type ResumeData = typeof resumeData.$inferSelect;
export type InsertResumeData = z.infer<typeof insertResumeDataSchema>;

export type Submission = typeof submissions.$inferSelect;
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

export type CandidateValidation = typeof candidateValidations.$inferSelect;
export type InsertCandidateValidation = z.infer<typeof insertCandidateValidationSchema>;

export type PublicApplication = typeof publicApplications.$inferSelect;
export type InsertPublicApplication = z.infer<typeof insertPublicApplicationSchema>;

// Profile Resumes table - optimized for file system storage
export const profileResumes = pgTable("profile_resumes", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  fileType: text("file_type", { enum: ["pdf", "docx"] }).notNull(),
  fileSize: integer("file_size").notNull(),
  filePath: text("file_path"), // File system path instead of base64 data
  fileData: text("file_data"), // Optional: for backward compatibility, will be phased out
  candidateName: text("candidate_name"),
  candidateEmail: text("candidate_email"),
  processingStatus: text("processing_status", { enum: ["uploading", "processing", "completed", "failed"] }).default("completed"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  uploadedBy: integer("uploaded_by").references(() => users.id),
});

// Resume Content table - compressed text storage with full-text search
export const resumeContent = pgTable("resume_content", {
  id: serial("id").primaryKey(),
  profileResumeId: integer("profile_resume_id").notNull().references(() => profileResumes.id, { onDelete: "cascade" }),
  extractedText: text("extracted_text").notNull(),
  compressedText: text("compressed_text"), // Compressed version for storage optimization
  contentHash: text("content_hash").notNull(), // Hash for duplicate detection
  wordCount: integer("word_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Full-text search index on extracted content
    searchIdx: index("resume_content_search_idx").using("gin", sql`to_tsvector('english', ${table.extractedText})`),
    // Index on content hash for duplicate detection
    hashIdx: index("resume_content_hash_idx").on(table.contentHash),
  };
});

// Resume Metadata table - structured fields for fast filtering without text search
export const resumeMetadata = pgTable("resume_metadata", {
  id: serial("id").primaryKey(),
  profileResumeId: integer("profile_resume_id").notNull().references(() => profileResumes.id, { onDelete: "cascade" }),
  candidateNameNormalized: text("candidate_name_normalized"),
  candidateEmailNormalized: text("candidate_email_normalized"),
  candidatePhone: text("candidate_phone"),
  candidatePhoneLast4: text("candidate_phone_last4"), // Last 4 digits for quick lookup
  skills: text("skills").array().default(sql`'{}'::text[]`), // Array of skills
  companies: text("companies").array().default(sql`'{}'::text[]`), // Array of company names
  jobTitles: text("job_titles").array().default(sql`'{}'::text[]`), // Array of job titles
  yearsExperience: integer("years_experience"),
  location: text("location"),
  education: text("education").array().default(sql`'{}'::text[]`), // Array of education entries
  summaryText: text("summary_text"), // Short summary (max 500 chars)
  extractedAt: timestamp("extracted_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Indexes for fast filtering
    nameIdx: index("resume_metadata_name_idx").on(table.candidateNameNormalized),
    emailIdx: index("resume_metadata_email_idx").on(table.candidateEmailNormalized),
    phoneIdx: index("resume_metadata_phone_idx").on(table.candidatePhone),
    phoneLast4Idx: index("resume_metadata_phone_last4_idx").on(table.candidatePhoneLast4),
    skillsIdx: index("resume_metadata_skills_idx").using("gin", table.skills),
    companiesIdx: index("resume_metadata_companies_idx").using("gin", table.companies),
    jobTitlesIdx: index("resume_metadata_job_titles_idx").using("gin", table.jobTitles),
    yearsExpIdx: index("resume_metadata_years_exp_idx").on(table.yearsExperience),
  };
});

// Search Cache table - for caching frequent searches (Phase 3)
export const searchCache = pgTable("search_cache", {
  id: serial("id").primaryKey(),
  searchQuery: text("search_query").notNull(),
  queryHash: text("query_hash").notNull().unique(), // Hash of normalized query
  resultIds: integer("result_ids").array().default(sql`'{}'::integer[]`), // Array of profile resume IDs
  resultCount: integer("result_count").default(0),
  hitCount: integer("hit_count").default(1), // How many times this search was performed
  lastUsed: timestamp("last_used").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // Cache expiration
}, (table) => {
  return {
    queryHashIdx: index("search_cache_query_hash_idx").on(table.queryHash),
    lastUsedIdx: index("search_cache_last_used_idx").on(table.lastUsed),
    expiresAtIdx: index("search_cache_expires_at_idx").on(table.expiresAt),
  };
});

// Processing Job Queue - for asynchronous file processing
export const processingJobs = pgTable("processing_jobs", {
  id: serial("id").primaryKey(),
  profileResumeId: integer("profile_resume_id").notNull().references(() => profileResumes.id, { onDelete: "cascade" }),
  jobType: text("job_type", { enum: ["extract_text", "generate_summary", "analyze_content"] }).notNull().default("extract_text"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed", "retrying"] }).notNull().default("pending"),
  priority: integer("priority").notNull().default(0), // Higher number = higher priority
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),
  errorMessage: text("error_message"),
  processingData: text("processing_data"), // JSON data for job context (file path, etc.)
  startedAt: timestamp("started_at"),
  retryAt: timestamp("retry_at"), // When to retry failed jobs
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
}, (table) => {
  return {
    // Index for efficient job queue processing
    statusPriorityIdx: index("processing_jobs_status_priority_idx").on(table.status, table.priority, table.createdAt),
    // Index on resume ID for tracking
    resumeIdx: index("processing_jobs_resume_idx").on(table.profileResumeId),
    // Index on created by for user tracking
    createdByIdx: index("processing_jobs_created_by_idx").on(table.createdBy),
  };
});

// Batch Upload Sessions - track upload batches
export const uploadSessions = pgTable("upload_sessions", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull().unique(), // UUID for tracking
  totalFiles: integer("total_files").notNull(),
  uploadedFiles: integer("uploaded_files").notNull().default(0),
  processedFiles: integer("processed_files").notNull().default(0),
  failedFiles: integer("failed_files").notNull().default(0),
  status: text("status", { enum: ["uploading", "processing", "completed", "failed"] }).notNull().default("uploading"),
  candidateName: text("candidate_name"),
  candidateEmail: text("candidate_email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
}, (table) => {
  return {
    // Index for session tracking
    sessionIdx: index("upload_sessions_session_idx").on(table.sessionId),
    // Index on status for filtering active sessions
    statusIdx: index("upload_sessions_status_idx").on(table.status),
    // Index on created by for user sessions
    createdByIdx: index("upload_sessions_created_by_idx").on(table.createdBy),
  };
});

// Create insert schemas
export const insertProfileResumeSchema = createInsertSchema(profileResumes).omit({ id: true, uploadedAt: true });
export const insertResumeContentSchema = createInsertSchema(resumeContent).omit({ id: true, createdAt: true });
export const insertResumeMetadataSchema = createInsertSchema(resumeMetadata).omit({ id: true, extractedAt: true });
export const insertSearchCacheSchema = createInsertSchema(searchCache).omit({ id: true, createdAt: true });
export const insertProcessingJobSchema = createInsertSchema(processingJobs).omit({ id: true, createdAt: true });
export const insertUploadSessionSchema = createInsertSchema(uploadSessions).omit({ id: true, createdAt: true, updatedAt: true });

// Export types
export type ProfileResume = typeof profileResumes.$inferSelect & {
  extractedText?: string;
  rank?: number;
  highlightedText?: string;
  summaryText?: string;
  processingStatus?: string;
};
export type InsertProfileResume = z.infer<typeof insertProfileResumeSchema>;

export type ResumeContent = typeof resumeContent.$inferSelect;
export type InsertResumeContent = z.infer<typeof insertResumeContentSchema>;

export type ResumeMetadata = typeof resumeMetadata.$inferSelect;
export type InsertResumeMetadata = z.infer<typeof insertResumeMetadataSchema>;

export type SearchCache = typeof searchCache.$inferSelect;
export type InsertSearchCache = z.infer<typeof insertSearchCacheSchema>;

export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = z.infer<typeof insertProcessingJobSchema>;

export type UploadSession = typeof uploadSessions.$inferSelect;
export type InsertUploadSession = z.infer<typeof insertUploadSessionSchema>;
