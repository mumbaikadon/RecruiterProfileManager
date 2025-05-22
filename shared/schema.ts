import { pgTable, text, serial, integer, date, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (recruiters and leads)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["recruiter", "lead", "admin"] }).notNull().default("recruiter"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Jobs table
export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().unique(), // External job ID (e.g., JOB-2023-001)
  title: text("title").notNull(),
  description: text("description").notNull(),
  clientFocus: text("client_focus"), // Key skills/areas that client is focusing on
  city: text("city"), // City for job location
  state: text("state"), // State for job location
  jobType: text("job_type", { enum: ["onsite", "remote", "hybrid"] }), // Job type (onsite, remote, hybrid)
  status: text("status", { enum: ["active", "reviewing", "closed"] }).notNull().default("active"),
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
  dobMonth: integer("dob_month").notNull(),
  dobDay: integer("dob_day").notNull(),
  ssn4: text("ssn_last_four").notNull(),
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
}, (table) => {
  return {
    // Create a unique index to identify candidates by DOB and last 4 SSN
    uniqueIdx: uniqueIndex("candidate_identity_idx").on(
      table.dobMonth, table.dobDay, table.ssn4
    ),
  };
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

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertJobSchema = createInsertSchema(jobs).omit({ id: true, createdAt: true });
export const insertJobAssignmentSchema = createInsertSchema(jobAssignments).omit({ id: true, assignedAt: true });
export const insertCandidateSchema = createInsertSchema(candidates).omit({ id: true, createdAt: true });
export const insertResumeDataSchema = createInsertSchema(resumeData).omit({ id: true, uploadedAt: true });
export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true, submittedAt: true, updatedAt: true });
export const insertActivitySchema = createInsertSchema(activities).omit({ id: true, createdAt: true });
export const insertCandidateValidationSchema = createInsertSchema(candidateValidations).omit({ id: true, validatedAt: true });

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
