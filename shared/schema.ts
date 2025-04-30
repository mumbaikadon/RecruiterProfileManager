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
    enum: ["new", "reviewing", "interview", "offer", "hired", "rejected"] 
  }).notNull().default("new"),
  matchScore: integer("match_score"),
  agreedRate: integer("agreed_rate"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  notes: text("notes"),
}, (table) => {
  return {
    // Ensure each candidate is only submitted once per job
    unique: uniqueIndex("job_candidate_unique_idx").on(table.jobId, table.candidateId),
  };
});

// Activities table (for activity feed)
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  type: text("type", { 
    enum: ["job_created", "job_closed", "candidate_submitted", "status_changed", "duplicate_detected"] 
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
