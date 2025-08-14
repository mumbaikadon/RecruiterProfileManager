import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth } from "./auth";
import {
  insertJobSchema,
  insertCandidateSchema,
  insertSubmissionSchema,
  insertResumeDataSchema,
  insertActivitySchema,
  insertPublicApplicationSchema,
  insertUserSchema,
  insertCandidateValidationSchema,
  type InsertResumeData,
  resumeData,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { analyzeResumeText, matchResumeToJob } from "./openai";
import { parseJobRequirements } from "./job-parser";
import fs from "fs";
import multer from "multer";

// Configure multer for file uploads 
const multerStorage = multer.memoryStorage();
const fileUpload = multer({ storage: multerStorage });

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);

  // Jobs routes (protected)
  app.get("/api/jobs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { status, date, search } = req.query;

      const filters: { status?: string; date?: Date; searchTerm?: string } = {};

      if (status && typeof status === "string") {
        filters.status = status;
      }

      if (date && typeof date === "string") {
        filters.date = new Date(date);
      }

      if (search && typeof search === "string") {
        filters.searchTerm = search;
      }

      const jobs = await storage.getJobs(filters);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/jobs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Import the sanitization utility
      const { sanitizeHtml } = await import("./utils");

      // Sanitize the job description to prevent HTML parsing issues
      if (job.description) {
        job.description = sanitizeHtml(job.description);
      }

      // Get assigned recruiters
      const assignments = await storage.getJobAssignments(job.id);
      const assignedUserIds = assignments.map((a) => a.userId);
      const recruiters = await Promise.all(
        assignedUserIds.map((id) => storage.getUser(id)),
      );

      // Get submissions for this job
      const submissions = await storage.getSubmissions({ jobId: job.id });

      res.json({
        ...job,
        assignedRecruiters: recruiters.filter(Boolean),
        submissions,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Helper function to generate auto Job ID
  async function generateJobId(): Promise<string> {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `${month}/${day}`;
    
    // Get all jobs created today
    const allJobs = await storage.getJobs({});
    const todayJobs = allJobs.filter(job => {
      if (!job.jobId || !job.jobId.startsWith(`JOB-${datePrefix}`)) return false;
      return true;
    });
    
    const nextIncrement = String(todayJobs.length + 1).padStart(3, '0');
    return `JOB-${datePrefix}-${nextIncrement}`;
  }

  app.post("/api/jobs", requireAuth, async (req: Request, res: Response) => {
    try {
      // Import sanitization utility
      const { sanitizeHtml } = await import("./utils");

      // Sanitize job description if it exists
      if (req.body.description) {
        req.body.description = sanitizeHtml(req.body.description);
      }
      
      // Auto-generate Job ID if not provided
      if (!req.body.jobId || req.body.jobId.trim() === '') {
        req.body.jobId = await generateJobId();
      }
      
      // Make sure createdBy is either a valid user ID or null
      if (req.body.createdBy && typeof req.body.createdBy === 'number') {
        // Check if the user exists
        try {
          const user = await storage.getUser(req.body.createdBy);
          if (!user) {
            // If user doesn't exist, set createdBy to null
            req.body.createdBy = null;
          }
        } catch (error) {
          // If error occurs when checking user, set createdBy to null
          req.body.createdBy = null;
        }
      } else {
        // If createdBy is not provided or not a number, set to null
        req.body.createdBy = null;
      }

      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validatedData);

      // Assign recruiters if provided, otherwise assign all recruiters with "recruiter" role
      try {
        // Check if recruiterIds is provided and not empty
        if (req.body.recruiterIds && Array.isArray(req.body.recruiterIds) && req.body.recruiterIds.length > 0) {
          await storage.assignRecruitersToJob(job.id, req.body.recruiterIds);
        } else {
          // Auto-assign all users with recruiter role
          const allUsers = await storage.getUsers();
          const recruiters = allUsers.filter(user => user.role === 'recruiter');
          
          if (recruiters.length > 0) {
            const recruiterIds = recruiters.map(recruiter => recruiter.id);
            await storage.assignRecruitersToJob(job.id, recruiterIds);
          } else {
            // If no recruiters found, assign to a default user (usually admin)
            const adminUser = allUsers.find(user => user.role === 'admin');
            if (adminUser) {
              await storage.assignRecruitersToJob(job.id, [adminUser.id]);
            }
            // If no admin or recruiter, job will have no assignments, which is acceptable
          }
        }
      } catch (assignError) {
        console.error('Failed to assign recruiters:', assignError);
        // Continue with job creation even if assignment fails
      }

      // Create an activity
      await storage.createActivity({
        type: "job_created",
        userId: job.createdBy,
        jobId: job.id,
        message: `Job ${job.title} (${job.jobId}) was created`,
      });

      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/jobs/:id/description", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      const { description } = req.body;
      if (typeof description !== "string") {
        return res.status(400).json({ message: "Description is required" });
      }

      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const updatedJob = await storage.updateJobDescription(id, description);
      
      // Create an activity for the description update
      await storage.createActivity({
        type: "job_updated",
        jobId: id,
        message: `Job description for ${job.title} (${job.jobId}) was updated.`,
      });

      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job description:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Job requirements parser endpoint
  app.post("/api/jobs/parse-requirements", requireAuth, async (req: Request, res: Response) => {
    try {
      const { requirementText } = req.body;
      
      if (!requirementText || typeof requirementText !== "string") {
        return res.status(400).json({ message: "Requirement text is required" });
      }

      const parsedData = await parseJobRequirements(requirementText);
      res.json(parsedData);
    } catch (error) {
      console.error("Error parsing job requirements:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/jobs/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      // Verify the job exists
      const existingJob = await storage.getJob(id);
      if (!existingJob) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Validate the request body using the insert schema
      const validateResult = insertJobSchema.safeParse(req.body);
      if (!validateResult.success) {
        return res.status(400).json({ 
          message: "Invalid job data", 
          errors: validateResult.error.errors 
        });
      }

      const updatedJob = await storage.updateJob(id, validateResult.data);
      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/jobs/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      const { status } = req.body;
      if (!status || typeof status !== "string") {
        return res.status(400).json({ message: "Status is required" });
      }

      // Get job's previous status before updating
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const prevStatus = job.status;
      const updatedJob = await storage.updateJobStatus(id, status);

      // If job is being closed (status changing from active to closed)
      if (
        prevStatus.toLowerCase() === "active" &&
        status.toLowerCase() === "closed"
      ) {
        console.log(
          `Job ${job.jobId} (${job.title}) is being closed. Updating candidate resume data...`,
        );

        // Get all submissions for this job
        const submissions = await storage.getSubmissions({ jobId: id });

        // Create an activity for the job status change
        await storage.createActivity({
          type: "job_closed",
          jobId: id,
          message: `Job ${job.title} (${job.jobId}) status changed from ${prevStatus} to ${status}. ${submissions.length} candidate submissions affected. Resume files deleted.`,
        });

        // Delete resume files for all candidates submitted to this job
        if (submissions.length > 0) {
          const candidateIds = submissions.map(submission => submission.candidateId);
          await storage.deleteResumeFiles(candidateIds);
          console.log(`Deleted resume files for ${candidateIds.length} candidates submitted to closed job ${job.jobId}`);
        }
      }

      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/jobs/:id/assign", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }

      // Verify the job exists
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Validate the recruiterIds
      const { recruiterIds } = req.body;
      if (!recruiterIds || !Array.isArray(recruiterIds)) {
        return res.status(400).json({ message: "Recruiter IDs are required" });
      }

      // Filter out any non-numeric values to ensure data integrity
      const validRecruiterIds = recruiterIds
        .filter((id) => !isNaN(Number(id)))
        .map(Number);

      if (validRecruiterIds.length === 0) {
        return res
          .status(400)
          .json({ message: "No valid recruiter IDs provided" });
      }

      const assignments = await storage.assignRecruitersToJob(
        id,
        validRecruiterIds,
      );
      res.status(201).json(assignments);
    } catch (error) {
      console.error("Error assigning recruiters:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Job requirement parsing endpoint
  app.post("/api/jobs/parse-requirements", requireAuth, async (req: Request, res: Response) => {
    try {
      const { requirementText } = req.body;
      
      if (!requirementText || typeof requirementText !== 'string') {
        return res.status(400).json({ message: "Requirement text is required" });
      }

      if (requirementText.trim().length === 0) {
        return res.status(400).json({ message: "Requirement text cannot be empty" });
      }

      const parsedData = await parseJobRequirements(requirementText);
      res.json(parsedData);
    } catch (error) {
      console.error("Error parsing job requirements:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Candidates routes
  app.get("/api/candidates", requireAuth, async (_req: Request, res: Response) => {
    try {
      const candidates = await storage.getCandidates();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/candidates/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      const candidate = await storage.getCandidate(id);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Get resume data if available
      const resumeData = await storage.getResumeData(candidate.id);

      // Get submissions for this candidate
      const submissions = await storage.getSubmissions({
        candidateId: candidate.id,
      });

      // Enhance submissions with job and recruiter details
      const enhancedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          // Get job details
          let job = null;
          if (submission.jobId) {
            job = await storage.getJob(submission.jobId);
          }

          // Get recruiter details
          let recruiter = null;
          if (submission.recruiterId) {
            recruiter = await storage.getUser(submission.recruiterId);
          }

          return {
            ...submission,
            job,
            recruiter: recruiter
              ? {
                  id: recruiter.id,
                  name: recruiter.username,
                }
              : null,
          };
        }),
      );

      res.json({
        ...candidate,
        resumeData,
        submissions: enhancedSubmissions,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/candidates", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertCandidateSchema.parse(req.body);

      // Check if candidate already exists
      const existingCandidate = await storage.getCandidateByIdentity(
        validatedData.dobMonth,
        validatedData.dobDay,
        validatedData.ssn4,
      );

      // If candidate exists, check for validation requirements
      if (existingCandidate) {
        console.log(`Candidate exists: ID ${existingCandidate.id}, checking for validation needs`);
        
        // Check if candidate is already submitted to this job (if jobId provided)
        if (req.body.jobId) {
          try {
            const existingSubmission = await storage.getSubmissionByJobAndCandidate(
              parseInt(req.body.jobId),
              existingCandidate.id,
            );

            if (existingSubmission) {
              console.log(`Candidate already submitted to job ${req.body.jobId}, returning 409 error`);
              return res.status(409).json({
                message: "This candidate is already in our past submitted list for this job",
                candidateId: existingCandidate.id,
                submissionId: existingSubmission.id,
              });
            }
          } catch (error) {
            console.error("Error checking for duplicate submission:", error);
          }
        }
        
        // If the candidate exists but is marked as "unreal", we should notify the user
        if (existingCandidate.isUnreal) {
          console.log(`Candidate is marked as "unreal", returning validation requirement`);
          return res.status(202).json({
            message: "This candidate has been marked as unreal (potentially fraudulent). Review required before submission.",
            candidateId: existingCandidate.id,
            isUnreal: true,
            unrealReason: existingCandidate.unrealReason,
            requiresValidation: true,
          });
        }
        
        // Check for resume data differences requiring validation
        const existingResumeData = await storage.getResumeData(existingCandidate.id);
        console.log("=== DETAILED RESUME DATA CHECK ===");
        console.log("Existing candidate ID:", existingCandidate.id);
        console.log("Raw req.body.resumeData:", JSON.stringify(req.body.resumeData, null, 2));
        
        const hasNewResumeData = req.body.resumeData && 
          (req.body.resumeData.clientNames?.length > 0 || req.body.resumeData.jobTitles?.length > 0);
        
        console.log("hasNewResumeData calculation:");
        console.log("- req.body.resumeData exists:", !!req.body.resumeData);
        console.log("- clientNames length:", req.body.resumeData?.clientNames?.length || 0);
        console.log("- jobTitles length:", req.body.resumeData?.jobTitles?.length || 0);
        console.log("- Final hasNewResumeData:", hasNewResumeData);
        
        console.log(`Validation check: hasExistingData=${!!existingResumeData}, hasNewData=${hasNewResumeData}`);
        console.log("Existing resume data:", existingResumeData ? {
          id: existingResumeData.id,
          clientNames: existingResumeData.clientNames?.length || 0,
          jobTitles: existingResumeData.jobTitles?.length || 0,
          relevantDates: existingResumeData.relevantDates?.length || 0
        } : "None");
        
        console.log("New resume data:", req.body.resumeData ? {
          clientNames: req.body.resumeData.clientNames?.length || 0,
          jobTitles: req.body.resumeData.jobTitles?.length || 0,
          relevantDates: req.body.resumeData.relevantDates?.length || 0
        } : "None");
          
        // First check if we have any resume data at all - create empty arrays to avoid null/undefined issues
        const safeExistingResumeData = {
          id: existingResumeData?.id || 0,
          clientNames: existingResumeData?.clientNames || [],
          jobTitles: existingResumeData?.jobTitles || [],
          relevantDates: existingResumeData?.relevantDates || []
        };
        
        const safeNewResumeData = {
          clientNames: req.body.resumeData?.clientNames || [],
          jobTitles: req.body.resumeData?.jobTitles || [],
          relevantDates: req.body.resumeData?.relevantDates || []
        };
        
        console.log("=== VALIDATION CHECK DEBUG ===");
        console.log("existingResumeData exists:", !!existingResumeData);
        console.log("hasNewResumeData:", hasNewResumeData);
        console.log("Condition result:", !!(existingResumeData && hasNewResumeData));
        
        if (existingResumeData && hasNewResumeData) {
          // This candidate exists and has both existing and new resume data - needs validation
          console.log("✅ Candidate requires employment history validation, returning 202");
          
          const validationResponse = {
            message: "This candidate exists in our system. Employment history validation required.",
            candidateId: existingCandidate.id,
            existingResumeData: safeExistingResumeData,
            newResumeData: safeNewResumeData,
            requiresValidation: true,
            validationType: "resubmission"
          };
          
          console.log("Sending validation response:", {
            status: 202,
            candidateId: validationResponse.candidateId,
            existingResumeData: {
              clientNames: validationResponse.existingResumeData.clientNames.length,
              jobTitles: validationResponse.existingResumeData.jobTitles.length
            },
            newResumeData: {
              clientNames: validationResponse.newResumeData.clientNames.length,
              jobTitles: validationResponse.newResumeData.jobTitles.length
            }
          });
          
          return res.status(202).json(validationResponse);
        }
        
        // Candidate exists but doesn't need validation
        console.log("Candidate exists but doesn't need validation, returning 409");
        return res.status(409).json({
          message: "Existing candidate found, proceed with submission to this job",
          candidateId: existingCandidate.id,
        });
      }

      // Import the removeQuotes utility
      const { removeQuotes } = await import("./utils");
      
      // Clean the location data to remove quotes
      const cleanedData = {
        ...validatedData,
        location: removeQuotes(validatedData.location)
      };

      const candidate = await storage.createCandidate(cleanedData);

      // Import the sanitization utility
      const { sanitizeHtml } = await import("./utils");

      // Create resume data if provided
      if (req.body.resumeData) {
        try {
          // Sanitize all resume data to prevent encoding issues
          const resumeDataPayload = {
            candidateId: candidate.id,
            clientNames: Array.isArray(req.body.resumeData.clientNames)
              ? req.body.resumeData.clientNames.map((name: string) =>
                  sanitizeHtml(name),
                )
              : [],
            jobTitles: Array.isArray(req.body.resumeData.jobTitles)
              ? req.body.resumeData.jobTitles.map((title: string) =>
                  sanitizeHtml(title),
                )
              : [],
            relevantDates: Array.isArray(req.body.resumeData.relevantDates)
              ? req.body.resumeData.relevantDates.map((date: string) =>
                  sanitizeHtml(date),
                )
              : [],
            skills: Array.isArray(req.body.resumeData.skills)
              ? req.body.resumeData.skills.map((skill: string) =>
                  sanitizeHtml(skill),
                )
              : [],
            education: Array.isArray(req.body.resumeData.education)
              ? req.body.resumeData.education.map((edu: string) =>
                  sanitizeHtml(edu),
                )
              : [],
            extractedText: req.body.resumeData.extractedText
              ? sanitizeHtml(req.body.resumeData.extractedText).substring(
                  0,
                  30000,
                )
              : "",
          };

          await storage.createResumeData(resumeDataPayload);
          console.log("Resume data successfully saved");
        } catch (resumeError) {
          console.error("Failed to save resume data:", resumeError);
          // Continue with candidate creation even if resume data fails
          // This ensures the candidate is created even if there's an issue with resume data
        }
      }

      res.status(201).json(candidate);
    } catch (error) {
      console.error("Candidate creation error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Submission routes
  app.get("/api/submissions", requireAuth, async (req: Request, res: Response) => {
    try {
      const { jobId, candidateId, recruiterId } = req.query;

      const filters: {
        jobId?: number;
        candidateId?: number;
        recruiterId?: number;
      } = {};

      if (jobId && typeof jobId === "string") {
        filters.jobId = parseInt(jobId);
      }

      if (candidateId && typeof candidateId === "string") {
        filters.candidateId = parseInt(candidateId);
      }

      if (recruiterId && typeof recruiterId === "string") {
        filters.recruiterId = parseInt(recruiterId);
      }

      const submissions = await storage.getSubmissions(filters);

      // Enhance submissions with related data
      const enhancedSubmissions = await Promise.all(
        submissions.map(async (submission) => {
          const job = await storage.getJob(submission.jobId);
          const candidate = await storage.getCandidate(submission.candidateId);
          const recruiter = await storage.getUser(submission.recruiterId);

          // Get resume data only if job is active
          let resumeData = null;
          if (job && job.status.toLowerCase() === "active" && candidate) {
            resumeData = await storage.getResumeData(candidate.id);
          }

          return {
            ...submission,
            job: job
              ? {
                  id: job.id,
                  jobId: job.jobId,
                  title: job.title,
                  status: job.status,
                }
              : undefined,
            candidate: candidate
              ? {
                  id: candidate.id,
                  firstName: candidate.firstName,
                  middleName: candidate.middleName,
                  lastName: candidate.lastName,
                  location: candidate.location || "Unknown Location",
                  workAuthorization: candidate.workAuthorization,
                  isUnreal: candidate.isUnreal,
                  unrealReason: candidate.unrealReason,
                  isSuspicious: candidate.isSuspicious,
                  suspiciousReason: candidate.suspiciousReason,
                  suspiciousSeverity: candidate.suspiciousSeverity,
                }
              : undefined,
            recruiter: recruiter
              ? {
                  id: recruiter.id,
                  name: recruiter.name || recruiter.username,
                  username: recruiter.username
                }
              : undefined,
            // Include resume data in response if job is active
            resumeData:
              job && job.status.toLowerCase() === "active" ? resumeData : null,
          };
        }),
      );

      res.json(enhancedSubmissions);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/submissions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }

      const submission = await storage.getSubmission(id);
      if (!submission) {
        return res.status(404).json({ message: "Submission not found" });
      }

      // Get related job
      const job = await storage.getJob(submission.jobId);

      // Get related candidate
      const candidate = await storage.getCandidate(submission.candidateId);

      // Get recruiter
      const recruiter = await storage.getUser(submission.recruiterId);

      // Get resume data only if job is active, otherwise provide null
      let resumeData = null;
      if (job && job.status.toLowerCase() === "active" && candidate) {
        resumeData = await storage.getResumeData(candidate.id);
      }

      // Format candidate and recruiter data with proper details
      const formattedCandidate = candidate ? {
        id: candidate.id,
        firstName: candidate.firstName,
        middleName: candidate.middleName,
        lastName: candidate.lastName,
        location: candidate.location || "Unknown Location",
        workAuthorization: candidate.workAuthorization,
        isUnreal: candidate.isUnreal,
        unrealReason: candidate.unrealReason,
        isSuspicious: candidate.isSuspicious,
        suspiciousReason: candidate.suspiciousReason,
        suspiciousSeverity: candidate.suspiciousSeverity,
      } : undefined;

      const formattedRecruiter = recruiter ? {
        id: recruiter.id,
        name: recruiter.name,
        username: recruiter.username,
      } : undefined;

      res.json({
        ...submission,
        job,
        candidate: formattedCandidate,
        recruiter: formattedRecruiter,
        // Include resume data in response if job is active
        resumeData:
          job && job.status.toLowerCase() === "active" ? resumeData : null,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/submissions", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("\n=== SUBMISSION DEBUG START ===");
      const submissionData = req.body;
      console.log("Full request body received:", JSON.stringify(submissionData, null, 2));
      console.log("Request body keys:", Object.keys(submissionData));
      console.log("Request body types:", Object.keys(submissionData).map(key => `${key}: ${typeof submissionData[key]}`));
      
      let candidateId: number;
      const jobId = submissionData.jobId;
      console.log("Extracted jobId:", jobId, "type:", typeof jobId);

      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }

      // Handle case where this is a new candidate (has candidateData)
      if (submissionData.candidateData) {
        // First validate the candidate data
        const validatedCandidateData = insertCandidateSchema.parse(
          submissionData.candidateData,
        );

        // Check if candidate already exists
        const existingCandidate = await storage.getCandidateByIdentity(
          validatedCandidateData.dobMonth,
          validatedCandidateData.dobDay,
          validatedCandidateData.ssn4,
        );

        // Check if this candidate has already been submitted for this specific job
        if (existingCandidate) {
          // Check if this candidate is already submitted for this job
          const existingSubmission =
            await storage.getSubmissionByJobAndCandidate(
              jobId,
              existingCandidate.id,
            );

          if (existingSubmission) {
            return res.status(409).json({
              message:
                "This candidate is already in our past submitted list for this job",
              candidateId: existingCandidate.id,
              submissionId: existingSubmission.id,
            });
          }

          // If the candidate exists but is marked as "unreal", we should notify the user
          if (existingCandidate.isUnreal) {
            return res.status(400).json({
              message: "This candidate has been marked as unreal (potentially fraudulent). Review required before submission.",
              candidateId: existingCandidate.id,
              isUnreal: true,
              unrealReason: existingCandidate.unrealReason,
              requiresValidation: true,
            });
          }

          // If candidate exists but hasn't been submitted to this job,
          // they need validation if they have resume data that needs comparison
          const existingResumeData = await storage.getResumeData(existingCandidate.id);
          const hasNewResumeData = submissionData.resumeData && 
            (submissionData.resumeData.clientNames?.length > 0 || submissionData.resumeData.jobTitles?.length > 0);
          
          if (existingResumeData && hasNewResumeData) {
            // This candidate exists and has both existing and new resume data - needs validation
            return res.status(202).json({
              message: "This candidate exists in our system. Employment history validation required.",
              candidateId: existingCandidate.id,
              existingResumeData: {
                id: existingResumeData.id,
                clientNames: existingResumeData.clientNames || [],
                jobTitles: existingResumeData.jobTitles || [],
                relevantDates: existingResumeData.relevantDates || [],
              },
              newResumeData: {
                clientNames: submissionData.resumeData.clientNames || [],
                jobTitles: submissionData.resumeData.jobTitles || [],
                relevantDates: submissionData.resumeData.relevantDates || [],
              },
              requiresValidation: true,
              validationType: "resubmission"
            });
          }

          // Use the existing candidate if they haven't been submitted for this job yet
          candidateId = existingCandidate.id;
        } else {
          // Before creating a new candidate, check for similar employment histories
          // This catches the case where different candidates submit identical resumes
          if (submissionData.resumeData?.clientNames?.length > 0) {
            console.log("Checking for employment history duplicates before creating new candidate");
            
            try {
              // Check for similar employment histories in the database
              const similarHistories = await storage.findSimilarEmploymentHistories(
                submissionData.resumeData.clientNames || [],
                submissionData.resumeData.relevantDates || []
              );
              
              // Filter for high similarity matches (80% or more)
              const highSimilarityMatches = similarHistories.filter(match => match.similarityScore >= 80);
              
              // Create a more specific message if matches found
              if (highSimilarityMatches.length > 0) {
                console.log(`Found ${highSimilarityMatches.length} candidates with high similarity employment histories`);
                
                // Get candidate details for at least the first match
                const matchCandidate = await storage.getCandidate(highSimilarityMatches[0].candidateId);
                
                if (matchCandidate) {
                  const matchName = `${matchCandidate.firstName} ${matchCandidate.lastName}`;
                  console.log(`Employment history appears to be a duplicate of candidate: ${matchName}`);
                  
                  return res.status(409).json({
                    message: "The submitted resume has employment history that matches an existing candidate.",
                    matchedWithCandidateId: matchCandidate.id,
                    matchedWithCandidateName: matchName,
                    similarityScore: highSimilarityMatches[0].similarityScore
                  });
                }
              }
            } catch (error) {
              console.error("Error checking for employment history duplicates:", error);
              // Continue with candidate creation even if check fails
            }
          }
          
          // Create a new candidate
          const newCandidate = await storage.createCandidate(
            validatedCandidateData,
          );
          candidateId = newCandidate.id;

          // Create resume data if provided
          if (submissionData.resumeData) {
            try {
              // Import the sanitization utility
              const { sanitizeHtml } = await import("./utils");

              // Sanitize all resume data to prevent encoding issues
              const resumeDataPayload = {
                candidateId: newCandidate.id,
                clientNames: Array.isArray(
                  submissionData.resumeData.clientNames,
                )
                  ? submissionData.resumeData.clientNames.map((name: string) =>
                      sanitizeHtml(name),
                    )
                  : [],
                jobTitles: Array.isArray(submissionData.resumeData.jobTitles)
                  ? submissionData.resumeData.jobTitles.map((title: string) =>
                      sanitizeHtml(title),
                    )
                  : [],
                relevantDates: Array.isArray(
                  submissionData.resumeData.relevantDates,
                )
                  ? submissionData.resumeData.relevantDates.map(
                      (date: string) => sanitizeHtml(date),
                    )
                  : [],
                skills: Array.isArray(submissionData.resumeData.skills)
                  ? submissionData.resumeData.skills.map((skill: string) =>
                      sanitizeHtml(skill),
                    )
                  : [],
                education: Array.isArray(submissionData.resumeData.education)
                  ? submissionData.resumeData.education.map((edu: string) =>
                      sanitizeHtml(edu),
                    )
                  : [],
                extractedText: submissionData.resumeData.extractedText
                  ? sanitizeHtml(
                      submissionData.resumeData.extractedText,
                    ).substring(0, 30000)
                  : "",
              };

              await storage.createResumeData(resumeDataPayload);
              console.log("Resume data successfully saved during submission");
            } catch (resumeError) {
              console.error(
                "Failed to save resume data during submission:",
                resumeError,
              );
              // Continue with candidate creation even if resume data fails
            }
          }
        }
      } else {
        // For existing candidate, just use the candidateId provided
        candidateId = submissionData.candidateId;
        if (!candidateId) {
          return res
            .status(400)
            .json({
              message: "Either candidateData or candidateId must be provided",
            });
        }

        // Check if this is a quick submit - bypass resume processing
        if (submissionData.quickSubmit) {
          console.log("🚀 QUICK SUBMIT detected - bypassing resume validation and AI processing");
          
          // Just check for duplicate submission
          const existingSubmission = await storage.getSubmissionByJobAndCandidate(
            jobId,
            candidateId
          );

          if (existingSubmission) {
            return res.status(409).json({
              message: "This candidate is already in our past submitted list for this job",
              candidateId: candidateId,
              submissionId: existingSubmission.id,
            });
          }

          // Skip all resume processing and validation - go directly to submission creation
          console.log("✅ Quick submit validation passed - proceeding directly to submission");
        }
      }

      // Handle resume data update if provided (for existing candidates)
      // Skip resume processing for quick submit
      if (submissionData.resumeData && candidateId && !submissionData.quickSubmit) {
        try {
          console.log(`Updating resume data for existing candidate ${candidateId}`);
          
          // Check if resume data already exists
          const existingResumeData = await storage.getResumeData(candidateId);
          
          // === RESUME VALIDATION LOGIC ===
          // If candidate has existing resume data AND new resume data, validate changes
          // BUT skip validation if skipComparison flag is set (user has already approved changes)
          if (existingResumeData && 
              (submissionData.resumeData.clientNames?.length > 0 || 
               submissionData.resumeData.jobTitles?.length > 0) &&
              !submissionData.skipComparison) {
            
            console.log("🔍 RESUME COMPARISON TRIGGERED");
            console.log("Existing resume data:", {
              clientNames: existingResumeData.clientNames?.length || 0,
              jobTitles: existingResumeData.jobTitles?.length || 0,
              relevantDates: existingResumeData.relevantDates?.length || 0
            });
            console.log("New resume data:", {
              clientNames: submissionData.resumeData.clientNames?.length || 0,
              jobTitles: submissionData.resumeData.jobTitles?.length || 0,
              relevantDates: submissionData.resumeData.relevantDates?.length || 0
            });
            
            // Resume comparison logic (server-side version)
            const compareResumeData = (existing: any, newData: any) => {
              const changes: string[] = [];
              let significantChanges = false;
              
              // Compare client names
              const addedClients = newData.clientNames.filter((client: string) => 
                !existing.clientNames.includes(client));
              const removedClients = existing.clientNames.filter((client: string) => 
                !newData.clientNames.includes(client));
              
              if (addedClients.length > 0) {
                changes.push(`Added companies: ${addedClients.join(", ")}`);
                significantChanges = true;
              }
              if (removedClients.length > 0) {
                changes.push(`Removed companies: ${removedClients.join(", ")}`);
                significantChanges = true;
              }
              
              // Compare job titles
              const addedTitles = newData.jobTitles.filter((title: string) => 
                !existing.jobTitles.includes(title));
              const removedTitles = existing.jobTitles.filter((title: string) => 
                !newData.jobTitles.includes(title));
              
              if (addedTitles.length > 0) {
                changes.push(`Added job titles: ${addedTitles.join(", ")}`);
                significantChanges = true;
              }
              if (removedTitles.length > 0) {
                changes.push(`Removed job titles: ${removedTitles.join(", ")}`);
                significantChanges = true;
              }
              
              return {
                hasChanges: changes.length > 0,
                significantChanges,
                changes
              };
            };
            
            const existingData = {
              clientNames: existingResumeData.clientNames || [],
              jobTitles: existingResumeData.jobTitles || [],
              relevantDates: existingResumeData.relevantDates || [],
              skills: existingResumeData.skills || [],
              education: existingResumeData.education || []
            };
            
            const newData = {
              clientNames: submissionData.resumeData.clientNames || [],
              jobTitles: submissionData.resumeData.jobTitles || [],
              relevantDates: submissionData.resumeData.relevantDates || [],
              skills: submissionData.resumeData.skills || [],
              education: submissionData.resumeData.education || []
            };
            
            const comparison = compareResumeData(existingData, newData);
            console.log("Resume comparison result:", comparison);
            
            if (comparison.hasChanges && comparison.significantChanges) {
              console.log("⚠️  SIGNIFICANT RESUME CHANGES DETECTED - Requiring validation");
              console.log("🔒 NOT updating resume data yet - waiting for recruiter approval");
              
              // Return 202 status to trigger frontend validation dialog
              // DON'T UPDATE RESUME DATA YET - keep original data intact for comparison
              return res.status(202).json({
                message: "Resume changes detected - validation required",
                candidateId: candidateId,
                existingResumeData: {
                  id: existingResumeData.id,
                  clientNames: existingResumeData.clientNames || [],
                  jobTitles: existingResumeData.jobTitles || [],
                  relevantDates: existingResumeData.relevantDates || []
                },
                newResumeData: {
                  clientNames: submissionData.resumeData.clientNames || [],
                  jobTitles: submissionData.resumeData.jobTitles || [],
                  relevantDates: submissionData.resumeData.relevantDates || []
                },
                changes: comparison.changes,
                requiresValidation: true,
                validationType: "resubmission_with_changes"
              });
            } else {
              console.log("✅ Resume changes are minor - proceeding with submission");
            }
          }
          
          // Only update resume data if validation is skipped OR no significant changes detected
          console.log(`📝 Updating resume data for candidate ${candidateId} (validation passed or skipped)`);
          
          const resumeDataPayload: InsertResumeData = {
            candidateId: candidateId,
            clientNames: submissionData.resumeData.clientNames || [],
            jobTitles: submissionData.resumeData.jobTitles || [],
            relevantDates: submissionData.resumeData.relevantDates || [],
            skills: submissionData.resumeData.skills || [],
            education: submissionData.resumeData.education || [],
            extractedText: submissionData.resumeData.extractedText || "",
          };

          if (existingResumeData) {
            // Update existing resume data
            await db
              .update(resumeData)
              .set(resumeDataPayload)
              .where(eq(resumeData.candidateId, candidateId));
            console.log(`✅ Resume data updated for candidate ${candidateId}`);
          } else {
            // Create new resume data
            await storage.createResumeData(resumeDataPayload);
            console.log(`✅ New resume data created for candidate ${candidateId}`);
          }
        } catch (resumeError) {
          console.error(`Failed to update resume data for candidate ${candidateId}:`, resumeError);
          // Continue with submission even if resume data update fails
        }
      }

      // Prepare ONLY submission-related fields (exclude resume data)
      console.log("\n=== CREATING SUBMISSION PAYLOAD ===");
      console.log("candidateId for submission:", candidateId, "type:", typeof candidateId);
      console.log("Raw submission data fields:");
      console.log("- jobId:", submissionData.jobId, "type:", typeof submissionData.jobId);
      console.log("- candidateId:", submissionData.candidateId, "type:", typeof submissionData.candidateId);
      console.log("- recruiterId:", submissionData.recruiterId, "type:", typeof submissionData.recruiterId);
      console.log("- status:", submissionData.status, "type:", typeof submissionData.status);
      console.log("- matchScore:", submissionData.matchScore, "type:", typeof submissionData.matchScore);
      console.log("- agreedRate:", submissionData.agreedRate, "type:", typeof submissionData.agreedRate);
      console.log("- notes:", submissionData.notes, "type:", typeof submissionData.notes);
      console.log("- isSuspicious:", submissionData.isSuspicious, "type:", typeof submissionData.isSuspicious);
      console.log("- suspiciousReason:", submissionData.suspiciousReason, "type:", typeof submissionData.suspiciousReason);
      console.log("- suspiciousSeverity:", submissionData.suspiciousSeverity, "type:", typeof submissionData.suspiciousSeverity);
      
      // Check for unexpected fields that might cause validation issues
      const expectedFields = ['jobId', 'candidateId', 'candidateData', 'recruiterId', 'status', 'matchScore', 'agreedRate', 'notes', 'isSuspicious', 'suspiciousReason', 'suspiciousSeverity', 'resumeData'];
      const unexpectedFields = Object.keys(submissionData).filter(key => !expectedFields.includes(key));
      if (unexpectedFields.length > 0) {
        console.log("⚠️  UNEXPECTED FIELDS DETECTED:", unexpectedFields);
        unexpectedFields.forEach(field => {
          console.log(`   - ${field}:`, JSON.stringify(submissionData[field]), "type:", typeof submissionData[field]);
        });
      }

      // Ensure recruiterId is always valid
      let recruiterId = submissionData.recruiterId;
      if (!recruiterId || isNaN(Number(recruiterId))) {
        console.log(`⚠️  Invalid recruiterId received: ${recruiterId}, using fallback recruiter ID: 1`);
        recruiterId = 1; // Fallback to admin user
      }

      const submissionPayload = {
        jobId: submissionData.jobId,
        candidateId: candidateId,
        recruiterId: Number(recruiterId), // Ensure it's a number
        status: submissionData.status || "New",  // Use proper default status
        matchScore: submissionData.matchScore || 65,  // Default match score
        agreedRate: submissionData.agreedRate || 0,   // Default agreed rate
        notes: submissionData.notes || "",
        isSuspicious: Boolean(submissionData.isSuspicious),
        suspiciousReason: submissionData.suspiciousReason || null,
        suspiciousSeverity: submissionData.suspiciousSeverity || null,
      };

      console.log("\n=== FINAL SUBMISSION PAYLOAD ===");
      console.log("Submission payload:", JSON.stringify(submissionPayload, null, 2));
      console.log("Submission payload keys:", Object.keys(submissionPayload));
      console.log("Submission payload field types:", Object.keys(submissionPayload).map(key => `${key}: ${typeof submissionPayload[key]}`));

      // Validate only submission data (without resume fields)
      console.log("\n=== STARTING VALIDATION ===");
      console.log("About to validate with insertSubmissionSchema...");
      
      let validatedData;
      try {
        validatedData = insertSubmissionSchema.parse(submissionPayload);
        console.log("✅ Validation successful!", "Validated data keys:", Object.keys(validatedData));
      } catch (validationError) {
        console.log("❌ VALIDATION FAILED!");
        console.log("Validation error:", validationError);
        if (validationError instanceof z.ZodError) {
          console.log("Zod validation issues:");
          validationError.issues.forEach((issue, index) => {
            console.log(`  ${index + 1}. Path: [${issue.path.join(', ')}], Code: ${issue.code}, Message: ${issue.message}`);
            if (issue.received !== undefined) console.log(`     Received: ${JSON.stringify(issue.received)}`);
            if (issue.expected !== undefined) console.log(`     Expected: ${issue.expected}`);
          });
        }
        
        // Return detailed error response for debugging
        return res.status(400).json({ 
          message: validationError instanceof z.ZodError ? validationError.issues : validationError.message,
          debugInfo: {
            receivedPayload: submissionPayload,
            payloadKeys: Object.keys(submissionPayload),
            payloadTypes: Object.keys(submissionPayload).map(key => `${key}: ${typeof submissionPayload[key]}`)
          }
        });
      }

      // Check if the candidate has already been submitted for this job
      const existingSubmission = await storage.getSubmissionByJobAndCandidate(
        validatedData.jobId,
        validatedData.candidateId,
      );

      if (existingSubmission) {
        // Create an activity for duplicate submission attempt
        await storage.createActivity({
          type: "duplicate_detected",
          userId: validatedData.recruiterId,
          jobId: validatedData.jobId,
          candidateId: validatedData.candidateId,
          message: `Duplicate submission detected for job ID ${validatedData.jobId}`,
        });

        return res.status(409).json({
          message:
            "This candidate is already in our past submitted list for this job",
          submissionId: existingSubmission.id,
        });
      }

      const submission = await storage.createSubmission(validatedData);

      // Get job and candidate details for the activity message
      const job = await storage.getJob(submission.jobId);
      const candidate = await storage.getCandidate(submission.candidateId);

      // Create an activity for the submission
      if (job && candidate) {
        await storage.createActivity({
          type: "candidate_submitted",
          userId: submission.recruiterId,
          jobId: submission.jobId,
          candidateId: submission.candidateId,
          submissionId: submission.id,
          message: `Candidate ${candidate.firstName} ${candidate.lastName} was submitted for ${job.title} (${job.jobId})`,
        });
      }

      res.status(201).json({
        submission,
        candidate,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put(
    "/api/submissions/:id/status",
    async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
          return res.status(400).json({ message: "Invalid submission ID" });
        }

        const { status } = req.body;
        if (!status || typeof status !== "string") {
          return res.status(400).json({ message: "Status is required" });
        }

        const updatedSubmission = await storage.updateSubmissionStatus(
          id,
          status,
        );

        // Create an activity for the status change
        const submission = await storage.getSubmission(id);
        if (submission) {
          await storage.createActivity({
            type: "status_changed",
            submissionId: id,
            jobId: submission.jobId,
            candidateId: submission.candidateId,
            message: `Submission status changed to ${status}`,
          });
        }

        res.json(updatedSubmission);
      } catch (error) {
        res.status(500).json({ message: (error as Error).message });
      }
    },
  );

  // Activities routes
  app.get("/api/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const activities = await storage.getActivities(limit);

      // Enrich activities with related data
      const enrichedActivities = await Promise.all(
        activities.map(async (activity) => {
          const enriched: any = { ...activity };

          if (activity.userId) {
            enriched.user = await storage.getUser(activity.userId);
          }

          if (activity.jobId) {
            enriched.job = await storage.getJob(activity.jobId);
          }

          if (activity.candidateId) {
            enriched.candidate = await storage.getCandidate(
              activity.candidateId,
            );
          }

          return enriched;
        }),
      );

      res.json(enrichedActivities);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/activities", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertActivitySchema.parse(req.body);
      const activity = await storage.createActivity(validatedData);
      res.status(201).json(activity);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Candidate validations routes
  app.post("/api/candidate-validations", requireAuth, async (req: Request, res: Response) => {
    try {
      const validatedData = insertCandidateValidationSchema.parse(req.body);
      
      // Add the validating user (from session)
      const validationData = {
        ...validatedData,
        validatedBy: (req as any).user.id
      };
      
      const validation = await storage.createCandidateValidation(validationData);
      
      // Create an activity for the validation
      await storage.createActivity({
        type: "candidate_validated",
        userId: (req as any).user.id,
        candidateId: validatedData.candidateId,
        jobId: validatedData.jobId || null,
        message: `Candidate profile changes validated: ${validatedData.validationResult}`
      });
      
      res.status(201).json(validation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/candidate-validations/:candidateId", requireAuth, async (req: Request, res: Response) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }
      
      const validations = await storage.getCandidateValidations(candidateId);
      res.json(validations);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Users/recruiters routes
  app.get("/api/recruiters", requireAuth, async (_req: Request, res: Response) => {
    try {
      const recruiters = await storage.getRecruiters();
      res.json(recruiters);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Resume download endpoint
  app.get("/api/candidates/:id/resume/download", requireAuth, async (req: Request, res: Response) => {
    try {
      const candidateId = parseInt(req.params.id);
      console.log(`🔽 DOWNLOAD REQUEST for candidate ${candidateId}`);
      
      if (isNaN(candidateId)) {
        console.log(`❌ Invalid candidate ID: ${req.params.id}`);
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      console.log(`🔍 Looking for resume file for candidate ${candidateId}...`);
      
      // Get the resume file data
      const resumeFile = await storage.getResumeFile(candidateId);
      
      if (!resumeFile) {
        console.log(`❌ No resume file found for candidate ${candidateId}`);
        
        // Also check if resume data exists at all
        const resumeData = await storage.getResumeData(candidateId);
        if (resumeData) {
          console.log(`ℹ️ Resume data exists but no file content: ID ${resumeData.id}, hasFileContent: ${!!resumeData.fileContent}, fileName: ${resumeData.fileName}`);
        } else {
          console.log(`ℹ️ No resume data found at all for candidate ${candidateId}`);
        }
        
        return res.status(404).json({ message: "Resume file not found for this candidate" });
      }

      console.log(`✅ Resume file found! Filename: ${resumeFile.fileName}, Size: ${resumeFile.fileContent.length} bytes`);
      console.log(`✅ MIME type: ${resumeFile.mimeType}`);

      // Set headers for file download
      res.setHeader('Content-Type', resumeFile.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${resumeFile.fileName}"`);
      res.setHeader('Content-Length', resumeFile.fileContent.length);

      // Send the file content
      res.send(resumeFile.fileContent);
    } catch (error) {
      console.error("❌ Resume download error:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Candidate validation endpoint
  // Add endpoint to check for similar employment histories
  app.post("/api/candidates/check-similar-employment", requireAuth, async (req: Request, res: Response) => {
    try {
      const { candidateId, clientNames, relevantDates } = req.body;
      
      console.log("======= CHECK SIMILAR EMPLOYMENT HISTORIES ========");
      console.log("Received request to check for similar employment histories");
      console.log(`Candidate ID: ${candidateId}`);
      console.log(`Client Names (${clientNames?.length || 0}): ${JSON.stringify(clientNames)}`);
      console.log(`Relevant Dates (${relevantDates?.length || 0}): ${JSON.stringify(relevantDates)}`);
      
      if (!clientNames || !Array.isArray(clientNames) || clientNames.length === 0) {
        console.log("ERROR: Missing clientNames in request");
        return res.status(400).json({ 
          message: "Required fields missing: clientNames must be a non-empty array" 
        });
      }
      
      // Find similar employment histories
      const similarHistories = await storage.findSimilarEmploymentHistories(
        clientNames,
        relevantDates || [],
        candidateId // Exclude this candidate from the results
      );
      
      console.log(`Found ${similarHistories.length} candidates with ANY similarity in employment history`);
      
      // Filter for high similarity (80% or more)
      const highSimilarityMatches = similarHistories.filter(match => match.similarityScore >= 80);
      console.log(`Found ${highSimilarityMatches.length} candidates with >80% similar employment history`);
      
      if (highSimilarityMatches.length > 0) {
        console.log("High similarity matches:");
        highSimilarityMatches.forEach((match, idx) => {
          console.log(`Match #${idx+1}: Candidate ID ${match.candidateId}, Score: ${match.similarityScore}%`);
          console.log(`- Companies: ${JSON.stringify(match.clientNames)}`);
        });
      }
      
      // Identify identical job chronology (same companies and dates)
      const identicalChronologyMatches = similarHistories.filter(match => {
        // Extract just the main company name for better matching
        const inputCompanyNames = clientNames.map(name => {
          // First split by commas and take first part
          const withoutLocation = name.split(',')[0].toLowerCase().trim();
          // Then extract just the main company name (first word)
          return withoutLocation.split(/\s+/)[0];
        });
        
        const matchCompanyNames = match.clientNames.map(name => {
          // First split by commas and take first part
          const withoutLocation = name.split(',')[0].toLowerCase().trim();
          // Then extract just the main company name (first word)
          return withoutLocation.split(/\s+/)[0];
        });
        
        // Check if normalized companies match with some flexibility
        // We require most companies to match, but allow for some variation
        const matchingCompanies = inputCompanyNames.filter(name => 
          matchCompanyNames.some(matchName => matchName === name)
        );
        
        const companyMatchPercentage = (matchingCompanies.length / Math.max(inputCompanyNames.length, 1)) * 100;
        const allCompaniesMatch = companyMatchPercentage >= 90; // Allow for minor variations (90% match)
        
        console.log(`Checking identical chronology for candidate ${match.candidateId}:`);
        console.log(`Input companies (normalized): ${JSON.stringify(inputCompanyNames)}`);
        console.log(`Match companies (normalized): ${JSON.stringify(matchCompanyNames)}`);
        console.log(`Matching companies: ${matchingCompanies.length} of ${inputCompanyNames.length} (${companyMatchPercentage.toFixed(1)}%)`);
        console.log(`All companies match: ${allCompaniesMatch}`);
        
        // Check if all dates match (if dates are provided)
        let allDatesMatch = true;
        if (relevantDates && relevantDates.length > 0 && match.relevantDates && match.relevantDates.length > 0) {
          // Normalize dates by extracting key parts (months/years)
          const extractDateParts = (date) => date.toLowerCase().replace(/[^a-z0-9]/gi, ' ').split(/\s+/).filter(Boolean);
          
          const inputDateParts = relevantDates.map(extractDateParts);
          const matchDateParts = match.relevantDates.map(extractDateParts);
          
          // Improved date matching with better calculation
          // This fixes the >100% match percentage issue by comparing each date entry directly
          let matchingDateComponents = 0;
          let totalDateComponents = 0;
          
          // For each input date, find the best matching date from the comparison set
          inputDateParts.forEach((parts) => {
            totalDateComponents += 1; // Count each date entry as 1 instead of counting parts
            
            // Find best matching date by comparing parts
            let bestMatchCount = 0;
            matchDateParts.forEach((matchParts) => {
              const matchingPartCount = parts.filter((part) => 
                matchParts.some((mPart) => mPart === part)
              ).length;
              
              // Keep track of best match
              bestMatchCount = Math.max(bestMatchCount, matchingPartCount);
            });
            
            // Calculate score for this date (0-1 range)
            const dateScore = parts.length > 0 ? bestMatchCount / parts.length : 0;
            
            // If more than 80% of parts match, consider it a matching date
            if (dateScore >= 0.8) {
              matchingDateComponents += 1;
            }
            
            console.log(`Date parts: ${JSON.stringify(parts)}, Best match count: ${bestMatchCount}, Score: ${dateScore}`);
          });
          
          // Calculate final percentage based on number of matching dates
          const dateMatchPercentage = totalDateComponents > 0 
            ? (matchingDateComponents / totalDateComponents) * 100 
            : 0;
            
          allDatesMatch = dateMatchPercentage >= 80; // Allow for some variation in date formats
          
          console.log(`Input dates: ${JSON.stringify(relevantDates)}`);
          console.log(`Match dates: ${JSON.stringify(match.relevantDates)}`);
          console.log(`Date match percentage: ${dateMatchPercentage.toFixed(1)}%`);
          console.log(`All dates match: ${allDatesMatch}`);
        }
        
        return allCompaniesMatch && allDatesMatch;
      });
      
      console.log(`Found ${identicalChronologyMatches.length} candidates with identical job chronology`);
      
      if (identicalChronologyMatches.length > 0) {
        console.log("Identical chronology matches:");
        identicalChronologyMatches.forEach((match, idx) => {
          console.log(`Match #${idx+1}: Candidate ID ${match.candidateId}, Score: ${match.similarityScore}%`);
          console.log(`- Companies: ${JSON.stringify(match.clientNames)}`);
        });
      }
      
      // Get associated candidate info for the matches
      const highSimilarityDetails = await Promise.all(
        highSimilarityMatches.map(async match => {
          const candidate = await storage.getCandidate(match.candidateId);
          return {
            ...match,
            candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : `Unknown (ID: ${match.candidateId})`,
            candidateEmail: candidate?.email || 'Unknown',
          };
        })
      );
      
      const identicalChronologyDetails = await Promise.all(
        identicalChronologyMatches.map(async match => {
          const candidate = await storage.getCandidate(match.candidateId);
          return {
            ...match,
            candidateName: candidate ? `${candidate.firstName} ${candidate.lastName}` : `Unknown (ID: ${match.candidateId})`,
            candidateEmail: candidate?.email || 'Unknown',
          };
        })
      );
      
      // Create descriptive warning messages
      let warningMessage = "";
      if (identicalChronologyMatches.length > 0) {
        warningMessage = `⚠️ CRITICAL: Found ${identicalChronologyMatches.length} candidates with identical job chronology. This is a high fraud risk pattern.`;
      } else if (highSimilarityMatches.length > 0) {
        warningMessage = `⚠️ WARNING: Found ${highSimilarityMatches.length} candidates with >80% similar employment history. Review carefully.`;
      }

      // Create detailed explanations and next step recommendations
      const suspiciousPatterns = [];
      
      if (identicalChronologyDetails.length > 0) {
        // Get candidate names for detailed message
        const matchedCandidateNames = identicalChronologyDetails
          .filter(Boolean)
          .map(match => match.candidateName)
          .join(', ');
        
        suspiciousPatterns.push({
          type: "IDENTICAL_CHRONOLOGY",
          severity: "HIGH",
          message: `${identicalChronologyDetails.length} other candidate(s) have identical employer sequence and dates: ${matchedCandidateNames}`,
          detail: "Same companies in same order with matching employment dates strongly suggests resume fraud. Consider rejecting this candidate or requiring additional verification.",
          matchedCandidates: identicalChronologyDetails.filter(Boolean).map(match => ({
            id: match.candidateId,
            name: match.candidateName,
            similarityScore: match.similarityScore
          }))
        });
      }
      
      if (highSimilarityDetails.length > 0) {
        // Get candidate names for detailed message
        const matchedCandidateNames = highSimilarityDetails
          .filter(Boolean)
          .map(match => match.candidateName)
          .join(', ');
          
        suspiciousPatterns.push({
          type: "HIGH_SIMILARITY",
          severity: "MEDIUM",
          message: `${highSimilarityDetails.length} other candidate(s) have >80% matching employment histories: ${matchedCandidateNames}`,
          detail: "Extremely similar work histories may indicate resume fraud, template usage, or legitimate similar career paths. Review carefully and compare specific details.",
          matchedCandidates: highSimilarityDetails.filter(Boolean).map(match => ({
            id: match.candidateId,
            name: match.candidateName,
            similarityScore: match.similarityScore
          }))
        });
      }
      
      const response = {
        message: warningMessage || "Employment history validation complete",
        hasSimilarHistories: highSimilarityMatches.length > 0,
        hasIdenticalChronology: identicalChronologyMatches.length > 0,
        highSimilarityMatches: highSimilarityDetails,
        identicalChronologyMatches: identicalChronologyDetails,
        totalCandidatesChecked: similarHistories.length,
        suspiciousPatterns: suspiciousPatterns
      };
      
      console.log("Sending validation response with status:");
      console.log(`- Has similar histories: ${response.hasSimilarHistories}`);
      console.log(`- Has identical chronology: ${response.hasIdenticalChronology}`);
      console.log(`- High similarity matches: ${response.highSimilarityMatches.length}`);
      console.log(`- Identical chronology matches: ${response.identicalChronologyMatches.length}`);
      console.log(`- Suspicious patterns: ${response.suspiciousPatterns.length}`);
      
      return res.status(200).json(response);
    } catch (error) {
      console.error("Error checking similar employment histories:", error);
      return res.status(500).json({ 
        message: "Failed to check employment history similarity",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post(
    "/api/candidates/validate", 
    async (req: Request, res: Response) => {
      try {
        console.log("Candidate validation API called with data:", { 
          candidateId: req.body.candidateId,
          jobId: req.body.jobId,
          validationType: req.body.validationType,
          validationResult: req.body.validationResult,
          hasNewData: req.body.newClientNames?.length > 0 || req.body.newJobTitles?.length > 0,
        });
        
        const { 
          candidateId, 
          jobId,
          validationType, 
          validationResult, 
          previousClientNames,
          previousJobTitles,
          previousDates,
          newClientNames,
          newJobTitles, 
          newDates,
          resumeFileName,
          reason,
          validatedBy 
        } = req.body;
        
        if (!candidateId || !validatedBy) {
          console.log("Validation error: missing candidateId or validatedBy");
          return res.status(400).json({ 
            message: "Candidate ID and validator ID are required" 
          });
        }
        
        // Get the candidate
        const candidate = await storage.getCandidate(candidateId);
        if (!candidate) {
          console.log(`Validation error: Candidate ${candidateId} not found`);
          return res.status(404).json({ message: "Candidate not found" });
        }
        
        console.log(`Processing validation for candidate ${candidateId} (${candidate.firstName} ${candidate.lastName}), result: ${validationResult}`);
        
        // Create validation record
        const validationData = {
          candidateId,
          jobId: jobId || null,
          validationType: validationType || "resubmission",
          validationResult,
          previousClientNames: previousClientNames || [],
          previousJobTitles: previousJobTitles || [],
          previousDates: previousDates || [],
          newClientNames: newClientNames || [],
          newJobTitles: newJobTitles || [],
          newDates: newDates || [],
          resumeFileName: resumeFileName || null,
          reason: reason || null,
          validatedBy
        };
        
        const validation = await storage.createCandidateValidation(validationData);
        console.log(`Validation record created with ID: ${validation.id}`);
        
        // If the candidate is marked as unreal, update the candidate record
        if (validationResult === "unreal") {
          console.log(`Marking candidate ${candidateId} as unreal with reason: ${reason || "Employment history discrepancy"}`);
          await storage.updateCandidateValidation(
            candidateId, 
            true, 
            reason || "Employment history discrepancy", 
            validatedBy
          );
          
          // Create activity for marking candidate as unreal
          await storage.createActivity({
            type: "candidate_validated",
            userId: validatedBy,
            candidateId: candidateId,
            jobId: jobId || null,
            message: `Candidate was marked as unreal: ${reason || "Employment history discrepancy"}`
          });
          console.log("Activity record created for unreal validation");
        } else if (validationResult === "matching") {
          console.log(`Validating candidate ${candidateId} as matching`);
          
          // If candidate was previously marked unreal but is now valid, update the record
          if (candidate.isUnreal) {
            console.log(`Clearing unreal flag for previously flagged candidate ${candidateId}`);
            await storage.updateCandidateValidation(
              candidateId,
              false, // not unreal
              "", // Use empty string instead of null to avoid SQL issues
              validatedBy
            );
          }
          
          // If there's new resume data, update it
          if (newClientNames?.length > 0 || newJobTitles?.length > 0) {
            console.log(`Updating resume data for candidate ${candidateId}`);
            const existingResumeData = await storage.getResumeData(candidateId);
            if (existingResumeData) {
              await storage.updateResumeData(existingResumeData.id, {
                clientNames: newClientNames || existingResumeData.clientNames,
                jobTitles: newJobTitles || existingResumeData.jobTitles,
                relevantDates: newDates || existingResumeData.relevantDates
              });
              console.log(`Resume data updated for candidate ${candidateId}`);
            } else {
              console.log(`No existing resume data found for candidate ${candidateId}`);
            }
          } else {
            console.log(`No new resume data to update for candidate ${candidateId}`);
          }
          
          // Create activity for validating candidate
          await storage.createActivity({
            type: "candidate_validated",
            userId: validatedBy,
            candidateId: candidateId,
            jobId: jobId || null,
            message: `Candidate employment history was validated as matching`
          });
          console.log("Activity record created for matching validation");
          
          // Create submission if jobId is provided and validation is successful
          let submission = null;
          if (jobId && validationResult === "matching") {
            // Extract suspicious data from request
            const isSuspicious = req.body.isSuspicious === true;
            const suspiciousReason = req.body.suspiciousReason;
            const suspiciousSeverity = req.body.suspiciousSeverity;
            
            console.log(`Creating submission for candidate ${candidateId} to job ${jobId} with suspicious flags:`, {
              isSuspicious,
              suspiciousReason: suspiciousReason || null,
              suspiciousSeverity: suspiciousSeverity || null
            });
            
            // Prepare submission data
            const submissionData = {
              jobId: jobId,
              candidateId: candidateId,
              recruiterId: validatedBy,
              status: "New",
              isSuspicious: isSuspicious,
              suspiciousReason: suspiciousReason || null,
              suspiciousSeverity: suspiciousSeverity || null,
              notes: isSuspicious ? `Flagged during validation: ${suspiciousReason || 'Similar employment history'}` : null
            };
            
            try {
              // Create submission
              submission = await storage.createSubmission(submissionData);
              console.log(`Submission created with ID: ${submission.id}`);
              
              // Create activity for submission
              await storage.createActivity({
                type: "candidate_submitted",
                userId: validatedBy,
                candidateId: candidateId,
                jobId: jobId,
                submissionId: submission.id,
                message: `Candidate was submitted to job ID ${jobId}${isSuspicious ? ' (flagged as suspicious)' : ''}`
              });
            } catch (submissionError) {
              console.error("Error creating submission:", submissionError);
              // Continue even if submission creation fails
            }
          }
        }
        
        const updatedCandidate = await storage.getCandidate(candidateId);
        
        console.log(`Validation completed for candidate ${candidateId}, returning success response`);
        const response: any = {
          validation,
          candidate: updatedCandidate,
          message: `Candidate ${validationResult === "unreal" ? "marked as unreal" : "validated successfully"}`
        };
        
        // Only include submission in the response if it exists
        if (typeof submission !== 'undefined') {
          response.submission = submission;
        }
        
        res.status(200).json(response);
      } catch (error) {
        console.error("Candidate validation error:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: error.errors });
        }
        res.status(500).json({ message: (error as Error).message });
      }
    }
  );
  
  // OpenAI integration routes
  app.post(
    "/api/openai/analyze-resume",
    async (req: Request, res: Response) => {
      try {
        const { text } = req.body;

        if (!text || typeof text !== "string") {
          return res.status(400).json({ message: "Resume text is required" });
        }

        // Import the sanitization utility
        const { sanitizeHtml, isValidJson } = await import("./utils");

        // Check if text contains XML/HTML-like content that might cause issues
        if (
          text.includes("<!DOCTYPE") ||
          text.includes("<?xml") ||
          text.includes("<html")
        ) {
          console.log(
            "Detected potentially problematic document format with XML/HTML tags",
          );

          // Special handling for Word documents or HTML content
          // Remove all XML/HTML tags and normalize whitespace
          let cleanedText = text
            .replace(/<[^>]*>?/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          // If text is still problematic, respond with a more specific error
          if (cleanedText.length < 100) {
            return res.status(200).json({
              clientNames: [],
              jobTitles: [],
              relevantDates: [],
              skills: [],
              education: [],
              extractedText: "",
              message:
                "Unable to extract meaningful text from this document format. Please convert to plain text or a simpler format.",
            });
          }

          // Use the cleaned text instead
          console.log(
            "Using cleaned text from structured document, length:",
            cleanedText.length,
          );

          // Proceed with analyzing the cleaned text
          try {
            const analysis = await analyzeResumeText(cleanedText);

            // Additional safety sanitization for extracted values
            const safeAnalysis = {
              clientNames: analysis.clientNames.map((client) =>
                sanitizeHtml(client),
              ),
              jobTitles: analysis.jobTitles.map((title) => sanitizeHtml(title)),
              relevantDates: analysis.relevantDates.map((date) =>
                sanitizeHtml(date),
              ),
              skills: analysis.skills.map((skill) => sanitizeHtml(skill)),
              education: analysis.education.map((edu) => sanitizeHtml(edu)),
              // Truncate extractedText to ensure it doesn't exceed DB limits
              extractedText: cleanedText.substring(0, 30000),
            };

            return res.json(safeAnalysis);
          } catch (innerError) {
            console.error(
              "Failed to analyze cleaned document text:",
              innerError,
            );
            return res.status(200).json({
              clientNames: [],
              jobTitles: [],
              relevantDates: [],
              skills: [],
              education: [],
              extractedText: cleanedText.substring(0, 1000),
              message:
                "Document was processed but couldn't be fully analyzed. Try a different format.",
            });
          }
        }

        // For regular text content, proceed as normal
        // Sanitize the text before passing to OpenAI
        const sanitizedText = sanitizeHtml(text);

        console.log("Sanitized text length:", sanitizedText.length);

        const analysis = await analyzeResumeText(sanitizedText);

        // Additional safety sanitization for extracted values
        const safeAnalysis = {
          clientNames: analysis.clientNames.map((client) =>
            sanitizeHtml(client),
          ),
          jobTitles: analysis.jobTitles.map((title) => sanitizeHtml(title)),
          relevantDates: analysis.relevantDates.map((date) =>
            sanitizeHtml(date),
          ),
          skills: analysis.skills.map((skill) => sanitizeHtml(skill)),
          education: analysis.education.map((edu) => sanitizeHtml(edu)),
          // Truncate extractedText to ensure it doesn't exceed DB limits
          extractedText: sanitizeHtml(analysis.extractedText).substring(
            0,
            30000,
          ),
        };

        res.json(safeAnalysis);
      } catch (error) {
        console.error("Resume analysis error:", error);
        // Return a safe fallback response
        res.status(200).json({
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: [],
          extractedText: "",
          message:
            "Failed to analyze resume due to encoding issues. Please try a different file format.",
        });
      }
    },
  );

  // Fixed document parsing endpoint using reusable multer setup
  const multerStorage = multer.memoryStorage();
  const fileUpload = multer({ storage: multerStorage });
  
  app.post("/api/parse-document", requireAuth, fileUpload.single('file'), async (req: Request, res: Response) => {
    console.log("Document parsing request received");
    
    try {
      if (!req.file) {
        console.error("No file in the request");
        return res.status(400).json({ 
          success: false, 
          error: "No file uploaded",
          message: "Please attach a file with the key 'file'"
        });
      }

      console.log(`File received: ${req.file.originalname}, ${Math.round(req.file.size / 1024)}KB`);
      
      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname.toLowerCase();
      const fileType = fileName.endsWith('.pdf') ? 'pdf' : 
                     fileName.endsWith('.docx') ? 'docx' : 
                     fileName.endsWith('.txt') ? 'txt' : 'unknown';
      
      console.log(`Processing ${fileType.toUpperCase()} document: ${req.file.originalname} (${fileBuffer.length} bytes)`);
      
      // Use our document parser utility for text extraction
      let extractedText = '';
      
      try {
        // Import the document parser
        const { extractTextFromDocument } = await import('./document-parser');
        
        // Extract text based on file type
        console.log(`Processing ${fileType.toUpperCase()} document using document-parser`);
        extractedText = await extractTextFromDocument(fileBuffer, fileType);
      } catch (extractionError) {
        console.error(`${fileType.toUpperCase()} extraction error:`, extractionError);
        return res.status(500).json({
          success: false,
          error: `${fileType.toUpperCase()} parsing failed`,
          message: extractionError instanceof Error ? extractionError.message : "Unknown error"
        });
      }
      
      // Check if extraction was successful
      if (!extractedText || extractedText.length === 0) {
        console.error("Extraction resulted in empty text");
        return res.status(500).json({
          success: false,
          error: "Empty content", 
          message: "Extracted text is empty. The file may be corrupted or password-protected."
        });
      }
      
      // Log the extraction results
      console.log(`Successfully extracted ${extractedText.length} characters from ${fileType.toUpperCase()}`);
      console.log("Text preview:", extractedText.substring(0, 200) + "...");
      
      // Store resume file in database if candidateId is provided
      const candidateId = req.body.candidateId ? parseInt(req.body.candidateId) : null;
      console.log(`🔍 DEBUG: candidateId from request body: "${req.body.candidateId}" (parsed: ${candidateId})`);
      console.log(`🔍 DEBUG: candidateId check: ${candidateId && !isNaN(candidateId)}`);
      
      if (candidateId && !isNaN(candidateId)) {
        try {
          console.log(`🔄 STORING resume file for candidate ${candidateId}`);
          console.log(`🔄 File details: ${req.file.originalname}, size: ${fileBuffer.length} bytes`);
          
          // Determine MIME type based on file extension
          let mimeType = 'application/octet-stream';
          if (fileType === 'pdf') {
            mimeType = 'application/pdf';
          } else if (fileType === 'docx') {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (fileType === 'txt') {
            mimeType = 'text/plain';
          }
          
          console.log(`🔄 Storing with mimeType: ${mimeType}`);
          
          // Store the resume file in the database
          const storedData = await storage.storeResumeFile(candidateId, req.file.originalname, fileBuffer, mimeType);
          console.log(`✅ Resume file successfully stored for candidate ${candidateId}!`);
          console.log(`✅ Stored data ID: ${storedData.id}, filename: ${storedData.fileName}`);
          
        } catch (storageError) {
          console.error(`❌ Failed to store resume file for candidate ${candidateId}:`, storageError);
          // Don't fail the whole request if file storage fails, just log it
        }
      } else {
        console.log(`⚠️ SKIPPING file storage - candidateId not provided or invalid`);
      }

      // Return success response
      return res.json({
        success: true,
        text: extractedText,
        fileType,
        fileName: req.file.originalname,
        textLength: extractedText.length
      });
      
    } catch (error) {
      // Handle any unexpected errors
      console.error("Document parsing error:", error);
      return res.status(500).json({ 
        success: false,
        error: "Document parsing failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.post("/api/openai/match-resume", requireAuth, async (req: Request, res: Response) => {
    try {
      const { resumeText, jobDescription } = req.body;

      if (!resumeText || typeof resumeText !== "string") {
        return res.status(200).json({
          message: "Resume text is required",
          score: 0,
          strengths: [],
          weaknesses: ["Missing resume text"],
          suggestions: ["Upload a resume to get a match score"],
        });
      }

      if (!jobDescription || typeof jobDescription !== "string") {
        return res.status(200).json({
          message: "Job description is required",
          score: 0,
          strengths: [],
          weaknesses: ["Missing job description"],
          suggestions: ["Provide a job description to match against"],
        });
      }

      // Import the sanitization utility
      const { sanitizeHtml } = await import("./utils");

      // Sanitize both the resume text and job description
      const sanitizedResumeText = sanitizeHtml(resumeText);
      const sanitizedJobDescription = sanitizeHtml(jobDescription);

      console.log("Match resume request received:");
      console.log("- Resume text length:", sanitizedResumeText.length);
      console.log("- Job description length:", sanitizedJobDescription.length);

      console.log("Analyzing resume match...");
      
      // Use OpenAI directly to extract employment history
      let matchResult;
      
      try {
        // Import and initialize OpenAI
        const OpenAI = await import("openai");
        const openai = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
        
        console.log("Starting resume analysis with OpenAI...");
        console.log(`Sending OpenAI request with resume length: ${sanitizedResumeText.length} and job description length: ${sanitizedJobDescription.length}`);
        
        // Log first 300 chars of resume for debugging
        const resumePreview = sanitizedResumeText.substring(0, 300);
        console.log("Resume text preview for analysis:", resumePreview);
        
        // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: 
                "You are an expert resume analyzer specializing in extracting accurate employment history from resumes. " +
                "Your primary task is to extract REAL employment data from the resume - never generate fake or generic data. " +
                "If you cannot find clear employment history, respond with empty arrays rather than making up placeholder data. " +
                "Extract exact company names, job titles, and employment dates directly from the resume text. " +
                "Be precise, accurate, and only use information actually present in the resume."
            },
            {
              role: "user",
              content: 
                `I need you to analyze this resume for compatibility with the following job description.
                
                Resume:
                ${sanitizedResumeText}
                
                Job Description:
                ${sanitizedJobDescription}
                
                IMPORTANT - EMPLOYMENT HISTORY EXTRACTION INSTRUCTIONS:
                1. Carefully read the entire resume text
                2. Search for sections labeled "Experience", "Work Experience", "Professional Experience", "Employment History", etc.
                3. Extract the following from these sections EXACTLY as they appear in the resume - do not generate or fabricate data:
                   - clientNames: Array of company/employer names the candidate worked for (most recent first)
                   - jobTitles: Array of job titles/positions held by the candidate (most recent first)
                   - relevantDates: Array of employment periods (most recent first)
                   
                4. EDUCATION:
                   - Search for sections labeled "Education", "Academic Background", "Qualifications", etc.
                   - Extract education details including degrees, institutions, and graduation years
                
                5. Then analyze the fit between this resume and job description. Calculate an overall match percentage score (0-100).
                
                Return your analysis in a structured JSON format with the following fields:
                - clientNames (array of strings: extract EXACT company names from the resume)
                - jobTitles (array of strings: extract EXACT job titles from the resume)
                - relevantDates (array of strings: extract EXACT date ranges from the resume)
                - education (array of strings: extract EXACT education details from the resume)
                - skillsGapAnalysis: { missingSkills (array), matchingSkills (array), suggestedTraining (array) }
                - relevantExperience (array of relevant experiences from the resume)
                - improvements: { content (array), formatting (array), language (array) }
                - overallScore (number 0-100)
                - confidenceScore (number 0-1)
                
                NOTICE: It is critical that you extract only actual employment data from the resume. NEVER invent company names, job titles, or dates. If you cannot find employment history, return empty arrays.`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.5,
          max_tokens: 2000,
        });
        
        console.log("OpenAI analysis completed");
        
        // Parse the response
        const analysisResult = JSON.parse(response.choices[0].message.content);
        
        // Create a match result with the extracted information
        matchResult = {
          score: analysisResult.overallScore || 0,
          strengths: analysisResult.relevantExperience || [],
          weaknesses: (analysisResult.skillsGapAnalysis?.missingSkills || []),
          suggestions: (analysisResult.improvements?.content || []),
          
          // Employment history data - directly from OpenAI
          clientNames: analysisResult.clientNames || [],
          jobTitles: analysisResult.jobTitles || [],
          relevantDates: analysisResult.relevantDates || [],
          
          // Education data - directly from OpenAI
          education: analysisResult.education || [],
        };
      } 
      catch (openaiError) {
        console.error("Error with OpenAI analysis:", openaiError);
        
        // Fallback to basic matching
        matchResult = await matchResumeToJob(
          sanitizedResumeText,
          sanitizedJobDescription,
        );
      }
      
      // Log the employment history data
      console.log("OpenAI extracted employment history data:");
      console.log("- clientNames:", JSON.stringify(matchResult.clientNames || []));
      console.log("- jobTitles:", JSON.stringify(matchResult.jobTitles || []));
      console.log("- relevantDates:", JSON.stringify(matchResult.relevantDates || []));
      console.log("- education:", JSON.stringify(matchResult.education || []));
      
      // If we have a valid candidateId in the request, save the employment history to the database
      if (req.body.candidateId) {
        try {
          const candidateId = parseInt(req.body.candidateId);
          if (!isNaN(candidateId)) {
            // First check if this candidate exists
            const candidate = await storage.getCandidate(candidateId);
            
            if (candidate) {
              console.log(`Saving extracted employment history data for candidate ID ${candidateId}`);
              
              // Prepare resume data payload with employment history
              const resumeDataPayload = {
                candidateId,
                clientNames: matchResult.clientNames || [],
                jobTitles: matchResult.jobTitles || [],
                relevantDates: matchResult.relevantDates || [],
                // Include education data
                education: matchResult.education || [],
                // Maintain any existing skills or other resume data fields
                skills: matchResult.skillsGapAnalysis?.matchingSkills || [],
              };
              
              // Save the resume data to the database
              const existingResumeData = await storage.getResumeData(candidateId);
              
              if (existingResumeData) {
                // Update existing resume data
                console.log(`Updating existing resume data for candidate ID ${candidateId}`);
                await storage.updateResumeData(candidateId, resumeDataPayload);
              } else {
                // Create new resume data record
                console.log(`Creating new resume data for candidate ID ${candidateId}`);
                await storage.createResumeData(resumeDataPayload);
              }
              
              console.log(`Successfully saved employment history data for candidate ID ${candidateId}`);
            } else {
              console.warn(`Cannot save resume data: Candidate ID ${candidateId} not found`);
            }
          } else {
            console.warn(`Cannot save resume data: Invalid candidate ID format ${req.body.candidateId}`);
          }
        } catch (dbError) {
          console.error("Error saving employment history to database:", dbError);
          // Continue with the API response even if database update fails
        }
      }
      
      // Ensure we return a properly structured response even if the matching service fails
      const response = {
        score: typeof matchResult.score === "number" ? matchResult.score : 0,
        strengths: Array.isArray(matchResult.strengths)
          ? matchResult.strengths
          : [],
        weaknesses: Array.isArray(matchResult.weaknesses)
          ? matchResult.weaknesses
          : [],
        suggestions: Array.isArray(matchResult.suggestions)
          ? matchResult.suggestions
          : [],

        // Include employment history data
        clientNames: Array.isArray(matchResult.clientNames)
          ? matchResult.clientNames
          : [],
        jobTitles: Array.isArray(matchResult.jobTitles)
          ? matchResult.jobTitles
          : [],
        relevantDates: Array.isArray(matchResult.relevantDates)
          ? matchResult.relevantDates
          : [],
          
        // Include education data
        education: Array.isArray(matchResult.education)
          ? matchResult.education
          : [],
      };

      console.log("Resume analysis completed successfully");
      console.log(
        "Final response including employment history data:",
        JSON.stringify(response, null, 2),
      );

      res.json(response);
    } catch (error) {
      console.error("Resume matching error:", error);
      // Return a structured error response with 0 score
      res.status(200).json({
        message: (error as Error).message,
        score: 0,
        strengths: [],
        weaknesses: ["Error occurred during matching"],
        suggestions: ["Try a different resume format or contact support"],
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        education: [],
      });
    }
  });

  // New endpoint to validate a resume for duplicate/suspicious patterns before candidate creation
  app.post("/api/validate-resume", requireAuth, async (req: Request, res: Response) => {
    try {
      const { clientNames, relevantDates } = req.body;
      
      if (!clientNames || !Array.isArray(clientNames) || clientNames.length === 0) {
        return res.status(400).json({ 
          message: "Required fields missing: clientNames must be a non-empty array",
          isValid: true // Return true so the form submission can continue
        });
      }
      
      console.log("======= EARLY RESUME VALIDATION ========");
      
      // Performance improvement: Start with a quick check to see if there's enough data
      if (clientNames.length < 2) {
        console.log("Not enough company data for meaningful validation, skipping check");
        return res.json({
          isValid: true,
          message: "Resume passed validation checks (insufficient data for detailed validation)",
          hasSimilarHistories: false,
          hasIdenticalChronology: false,
          totalCandidatesChecked: 0,
          suspiciousPatterns: []
        });
      }
      
      // Find similar employment histories - using our optimized algorithm
      const similarHistories = await storage.findSimilarEmploymentHistories(
        clientNames,
        relevantDates || []
      );
      
      // If no similar histories found, return early
      if (!similarHistories.length) {
        return res.json({
          isValid: true,
          message: "Resume passed validation checks",
          hasSimilarHistories: false,
          hasIdenticalChronology: false,
          totalCandidatesChecked: 0,
          suspiciousPatterns: []
        });
      }

      // Filter for high similarity and identical chronology matches 
      // (now directly using the flags from our optimized algorithm)
      const highSimilarityMatches = similarHistories.filter(match => 
        match.isHighSimilarity || match.similarityScore >= 80
      );
      
      const identicalChronologyMatches = similarHistories.filter(match => 
        match.hasIdenticalChronology || 
        (match.companyMatchPercentage >= 90 && match.dateMatchPercentage >= 80)
      );
      
      // Batch fetch candidate details for efficiency (only one DB call)
      const candidateIds = [...new Set([
        ...highSimilarityMatches.map(m => m.candidateId),
        ...identicalChronologyMatches.map(m => m.candidateId)
      ])];
      
      // Early exit if no candidates to check
      if (candidateIds.length === 0) {
        return res.json({
          isValid: true,
          message: "Resume passed validation checks",
          hasSimilarHistories: false,
          hasIdenticalChronology: false,
          totalCandidatesChecked: similarHistories.length,
          suspiciousPatterns: []
        });
      }
      
      // Get candidate details in one batch
      const candidateDetailsMap = {};
      const candidates = await Promise.all(
        candidateIds.map(id => storage.getCandidate(id))
      );
      
      candidates.filter(Boolean).forEach(candidate => {
        candidateDetailsMap[candidate.id] = {
          id: candidate.id,
          name: `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim(),
          email: candidate.email || ""
        };
      });
      
      // Create enriched match objects
      const enrichMatch = (match) => {
        const candidateDetails = candidateDetailsMap[match.candidateId];
        if (!candidateDetails) return null;
        
        return {
          ...match,
          candidateName: candidateDetails.name,
          candidateEmail: candidateDetails.email
        };
      };
      
      // Efficiently enrich matches
      const highSimilarityDetails = highSimilarityMatches
        .map(enrichMatch)
        .filter(Boolean);
        
      const identicalChronologyDetails = identicalChronologyMatches
        .map(enrichMatch)
        .filter(Boolean);
      
      // Create detailed explanations and recommendations
      const suspiciousPatterns = [];
      
      if (identicalChronologyDetails.length > 0) {
        // Get candidate names for detailed message (limit length to avoid too long messages)
        const matchedCandidateNames = identicalChronologyDetails
          .slice(0, 3) // Show max 3 names
          .map(match => match.candidateName)
          .join(', ');
        
        const extraCount = identicalChronologyDetails.length > 3 ? 
          ` and ${identicalChronologyDetails.length - 3} more` : '';
        
        suspiciousPatterns.push({
          type: "IDENTICAL_CHRONOLOGY",
          severity: "HIGH",
          title: "Identical Employment Pattern Detected",
          message: `${identicalChronologyDetails.length} candidate(s) have identical employer sequence and dates: ${matchedCandidateNames}${extraCount}`,
          detail: "Same companies in same order with matching employment dates strongly suggests resume fraud. Consider rejecting this candidate or requiring additional verification.",
          matchedCandidates: identicalChronologyDetails.map(match => ({
            id: match.candidateId,
            name: match.candidateName,
            similarityScore: match.similarityScore
          }))
        });
      }
      
      if (highSimilarityDetails.length > 0 && identicalChronologyDetails.length === 0) {
        // Get candidate names for detailed message (limit length to avoid too long messages)
        const matchedCandidateNames = highSimilarityDetails
          .slice(0, 3) // Show max 3 names
          .map(match => match.candidateName)
          .join(', ');
          
        const extraCount = highSimilarityDetails.length > 3 ? 
          ` and ${highSimilarityDetails.length - 3} more` : '';
          
        suspiciousPatterns.push({
          type: "HIGH_SIMILARITY",
          severity: "MEDIUM",
          title: "High Similarity Resume Detected",
          message: `${highSimilarityDetails.length} candidate(s) have >80% matching employment histories: ${matchedCandidateNames}${extraCount}`,
          detail: "Extremely similar work histories may indicate resume fraud, template usage, or legitimate similar career paths. Review carefully and compare specific details.",
          matchedCandidates: highSimilarityDetails.map(match => ({
            id: match.candidateId,
            name: match.candidateName,
            similarityScore: match.similarityScore
          }))
        });
      }
      
      // Return validation results
      const response = {
        isValid: suspiciousPatterns.length === 0,
        message: suspiciousPatterns.length > 0 
          ? "Suspicious patterns detected in resume" 
          : "Resume passed validation checks",
        hasSimilarHistories: highSimilarityMatches.length > 0,
        hasIdenticalChronology: identicalChronologyMatches.length > 0,
        highSimilarityMatches: highSimilarityDetails,
        identicalChronologyMatches: identicalChronologyDetails,
        totalCandidatesChecked: similarHistories.length,
        suspiciousPatterns: suspiciousPatterns
      };
      
      console.log("Resume validation completed with status:");
      console.log(`- Is valid: ${response.isValid}`);
      console.log(`- Has similar histories: ${response.hasSimilarHistories}`);
      console.log(`- Has identical chronology: ${response.hasIdenticalChronology}`);
      console.log(`- Suspicious patterns: ${response.suspiciousPatterns.length}`);
      
      return res.status(200).json(response);
    } catch (error) {
      console.error("Error validating resume:", error);
      return res.status(500).json({
        isValid: true, // Let the submission continue on server errors 
        message: "Failed to validate resume, but allowing submission to continue",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Analytics endpoint for recruiter performance
  app.get("/api/analytics/recruiters", requireAuth, async (req: Request, res: Response) => {
    try {
      const { dateFrom, dateTo, recruiterId } = req.query;
      
      // Validate dates
      const fromDate = dateFrom ? new Date(dateFrom as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const toDate = dateTo ? new Date(dateTo as string) : new Date();
      
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      // Get all recruiters
      const recruiters = await storage.getRecruiters();
      
      // Get submissions in the date range
      const submissions = await storage.getSubmissions();
      
      // Filter submissions by date range and recruiter if specified
      const filteredSubmissions = submissions.filter(submission => {
        const submissionDate = new Date(submission.submittedAt);
        const inDateRange = submissionDate >= fromDate && submissionDate <= toDate;
        const matchesRecruiter = !recruiterId || submission.recruiterId === parseInt(recruiterId as string);
        return inDateRange && matchesRecruiter;
      });

      // Calculate recruiter stats
      const recruiterStats = recruiters.map(recruiter => {
        const recruiterSubmissions = filteredSubmissions.filter(s => s.recruiterId === recruiter.id);
        
        const totalSubmissions = recruiterSubmissions.length;
        const activeSubmissions = recruiterSubmissions.filter(s => 
          ['New', 'Submitted To Vendor', 'Submitted To Client', 'Interview Scheduled', 'Interview Completed'].includes(s.status)
        ).length;
        const approvedSubmissions = recruiterSubmissions.filter(s => 
          ['Offer Extended', 'Offer Accepted'].includes(s.status)
        ).length;
        const rejectedSubmissions = recruiterSubmissions.filter(s => 
          ['Rejected By Vendor', 'Offer Declined', 'Rejected'].includes(s.status)
        ).length;
        
        const successRate = totalSubmissions > 0 ? (approvedSubmissions / totalSubmissions) * 100 : 0;
        const rejectedRate = totalSubmissions > 0 ? (rejectedSubmissions / totalSubmissions) * 100 : 0;
        
        // Get unique jobs worked on
        const jobsWorked = new Set(recruiterSubmissions.map(s => s.jobId)).size;

        return {
          recruiterId: recruiter.id,
          recruiterName: recruiter.name,
          totalSubmissions,
          activeSubmissions,
          approvedSubmissions,
          rejectedSubmissions,
          successRate,
          rejectedRate,
          avgTimeToSubmit: 0, // Could calculate this if we track job assignment dates
          jobsWorked
        };
      });

      // Sort by total submissions descending
      recruiterStats.sort((a, b) => b.totalSubmissions - a.totalSubmissions);
      
      const topPerformers = recruiterStats.slice(0, 3);
      const totalSubmissions = await storage.getSubmissions().then(all => all.length);
      const periodSubmissions = filteredSubmissions.length;

      // Basic submission trends (could be enhanced with daily/weekly breakdown)
      const submissionTrends: Array<{
        date: string;
        submissions: number;
        recruiterId?: number;
      }> = [];
      
      const analyticsData = {
        recruiters: recruiterStats,
        totalSubmissions,
        periodSubmissions,
        topPerformers,
        submissionTrends
      };

      return res.status(200).json(analyticsData);
    } catch (error) {
      console.error("Error fetching analytics data:", error);
      return res.status(500).json({ message: "Failed to fetch analytics data" });
    }
  });

  // Store resume file for existing candidate
  app.post("/api/submissions/store-resume", requireAuth, fileUpload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate file size on the route level as well
      const maxFileSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxFileSize) {
        return res.status(413).json({ 
          message: `File size ${Math.round(req.file.size / 1024 / 1024)}MB exceeds maximum allowed size of ${maxFileSize / 1024 / 1024}MB` 
        });
      }

      // Validate file type
      const allowedExtensions = ['.pdf', '.docx', '.doc', '.txt'];
      const fileName = req.file.originalname.toLowerCase();
      const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasValidExtension) {
        return res.status(400).json({ 
          message: `File type not supported. Allowed types: ${allowedExtensions.join(', ')}` 
        });
      }

      const candidateId = parseInt(req.body.candidateId);
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      // Verify candidate exists
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Determine MIME type based on file extension
      let mimeType = 'application/octet-stream';
      if (fileName.endsWith('.pdf')) {
        mimeType = 'application/pdf';
      } else if (fileName.endsWith('.docx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileName.endsWith('.doc')) {
        mimeType = 'application/msword';
      } else if (fileName.endsWith('.txt')) {
        mimeType = 'text/plain';
      }

      // Store the resume file in the database
      await storage.storeResumeFile(candidateId, req.file.originalname, req.file.buffer, mimeType);

      console.log(`Resume file successfully stored for candidate ${candidateId}: ${req.file.originalname}`);

      res.json({ 
        message: "Resume file stored successfully",
        fileName: req.file.originalname,
        candidateId,
        fileSize: req.file.size
      });

    } catch (error) {
      console.error("Error storing resume file:", error);
      
      // Handle specific error types
      if (error instanceof Error && error.message.includes('exceeds maximum allowed size')) {
        return res.status(413).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Failed to store resume file" });
    }
  });

  // Download resume file
  app.get("/api/candidates/resume/:candidateId", requireAuth, async (req: Request, res: Response) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      // Get candidate and resume file from database
      const candidate = await storage.getCandidate(candidateId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Get resume file from database storage
      const resumeFile = await storage.getResumeFile(candidateId);
      if (!resumeFile) {
        return res.status(404).json({ message: "Resume file not found" });
      }

      // Set headers for file download
      res.setHeader('Content-Type', resumeFile.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${resumeFile.fileName}"`);
      res.setHeader('Content-Length', resumeFile.fileContent.length);
      
      // Send the file content directly from database
      res.send(resumeFile.fileContent);
      
    } catch (error) {
      console.error("Error downloading resume:", error);
      return res.status(500).json({ message: "Failed to download resume" });
    }
  });

  // Test route for gap analysis
  app.get("/api/test-gap-analysis", requireAuth, async (_req: Request, res: Response) => {
    try {
      console.log("Running gap analysis test...");
      
      // Import and run the test function
      const { testAnalyze } = await import('./test-gap-analysis');
      const results = await testAnalyze();
      
      return res.status(200).json(results);
    } catch (error) {
      console.error("Error during gap analysis test:", error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error during gap analysis test"
      });
    }
  });

  // Public API routes for job applications (no authentication required)
  
  // Get all active jobs for public viewing
  app.get("/api/public/jobs", async (_req: Request, res: Response) => {
    try {
      const jobs = await storage.getPublicJobs();
      // Return only necessary job information for public viewing
      const publicJobs = jobs.map(job => ({
        id: job.id,
        jobId: job.jobId,
        title: job.title,
        description: job.description,
        city: job.city,
        state: job.state,
        jobType: job.jobType,
        createdAt: job.createdAt
      }));
      res.json(publicJobs);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Submit a public job application (with automatic candidate creation)
  app.post("/api/public/apply", fileUpload.single('resume'), async (req: Request, res: Response) => {
    try {
      const applicationData = req.body;
      const resumeFile = req.file;

      // Validate required fields
      const validatedApplication = insertPublicApplicationSchema.parse(applicationData);

      // Extract resume content if file is provided
      let resumeContent = "";
      let resumeFileName = "";
      
      if (resumeFile) {
        resumeFileName = resumeFile.originalname;
        
        // Extract text from resume file
        try {
          const { extractTextFromBuffer } = await import("./document-parser");
          resumeContent = await extractTextFromBuffer(resumeFile.buffer, resumeFile.mimetype);
        } catch (extractError) {
          console.error("Resume extraction failed:", extractError);
          // Continue without resume content
        }
      }

      // Create the public application
      const application = await storage.createPublicApplication({
        ...validatedApplication,
        resumeFileName,
        resumeContent
      });

      // Automatically create a candidate record for auditing
      try {
        // Generate unique identifiers for the candidate
        // Use application date and email hash for unique identification
        const emailHash = Buffer.from(application.email).toString('base64').slice(0, 4);
        const dateHash = application.appliedAt.getMonth() + 1; // Month as number
        const dayHash = application.appliedAt.getDate();

        const candidateData = {
          firstName: application.firstName,
          lastName: application.lastName,
          email: application.email,
          phone: application.phone,
          dobMonth: dateHash, // Use application month
          dobDay: dayHash, // Use application day
          ssn4: emailHash, // Use email hash as unique identifier
          source: "public_application",
          notes: `Auto-created from public application #${application.id}`
        };

        const candidate = await storage.createCandidate(candidateData);

        // Create resume data if we have content
        if (resumeContent) {
          try {
            // Analyze resume content for structured data
            const { analyzeResumeText } = await import("./openai");
            const resumeAnalysis = await analyzeResumeText(resumeContent);

            const resumeDataPayload = {
              candidateId: candidate.id,
              clientNames: resumeAnalysis.clientNames || [],
              jobTitles: resumeAnalysis.jobTitles || [],
              relevantDates: resumeAnalysis.relevantDates || [],
              skills: resumeAnalysis.skills || [],
              education: resumeAnalysis.education || [],
              extractedText: resumeContent.substring(0, 30000),
              fileName: resumeFileName
            };

            await storage.createResumeData(resumeDataPayload);
          } catch (resumeError) {
            console.error("Failed to analyze resume:", resumeError);
            // Create basic resume data without analysis
            await storage.createResumeData({
              candidateId: candidate.id,
              clientNames: [],
              jobTitles: [],
              relevantDates: [],
              skills: [],
              education: [],
              extractedText: resumeContent.substring(0, 30000),
              fileName: resumeFileName
            });
          }
        }

        // Log activity for audit trail
        await storage.createActivity({
          type: "public_application_submitted",
          userId: null, // No user ID for public applications
          jobId: application.jobId,
          candidateId: candidate.id,
          message: `Public application submitted for ${application.firstName} ${application.lastName} to job ${validatedApplication.jobId}`
        });

        res.status(201).json({
          message: "Application submitted successfully",
          applicationId: application.id,
          candidateId: candidate.id
        });

      } catch (candidateError) {
        console.error("Failed to create candidate record:", candidateError);
        // Return success for application even if candidate creation fails
        res.status(201).json({
          message: "Application submitted successfully",
          applicationId: application.id,
          note: "Application recorded, candidate profile pending"
        });
      }

    } catch (error) {
      console.error("Public application error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid application data", errors: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Get public applications (admin only - would need auth middleware in production)
  app.get("/api/admin/public-applications", requireAuth, async (req: Request, res: Response) => {
    try {
      const { jobId, status } = req.query;
      const filters: { jobId?: number; status?: string } = {};

      if (jobId && typeof jobId === "string") {
        filters.jobId = parseInt(jobId);
      }

      if (status && typeof status === "string") {
        filters.status = status;
      }

      const applications = await storage.getPublicApplications(filters);
      res.json(applications);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Update public application status (admin only)
  app.put("/api/admin/public-applications/:id/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { status, notes, reviewedBy } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }

      const application = await storage.updatePublicApplicationStatus(id, status, reviewedBy, notes);
      res.json(application);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Initialize the HTTP server
  // User registration endpoint (public)
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { username, password, name, email, role } = req.body;
      
      // Validate required fields
      if (!username || !password || !name || !email) {
        return res.status(400).json({ 
          message: "Username, password, name, and email are required" 
        });
      }

      // Check if username or email already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ message: "Email already exists" });
      }

      // Hash password
      const bcrypt = await import("bcrypt");
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with pending status
      const userData = {
        username,
        password: hashedPassword,
        name,
        email,
        role: role || "recruiter",
        status: "pending"
      };

      const validatedData = insertUserSchema.parse(userData);
      const newUser = await storage.createUser(validatedData);

      // Create activity for new user registration
      await storage.createActivity({
        type: "system_integration",
        userId: newUser.id,
        message: `New user ${name} (${username}) registered and pending approval`
      });

      res.status(201).json({ 
        message: "Registration successful. Account pending admin approval.",
        userId: newUser.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Organization management routes (admin only)
  app.get("/api/organization/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      
      // Check if user is admin
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { status } = req.query;
      let users;
      
      if (status === "pending") {
        users = await storage.getPendingUsers();
      } else {
        users = await storage.getAllUsers();
      }
      
      // Remove password from response
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });

      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching organization users:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/organization/users/:id/approve", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      
      // Check if user is admin
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const updatedUser = await storage.updateUserStatus(userId, "approved", currentUser.id);
      
      // Create activity for approval
      await storage.createActivity({
        type: "system_integration",
        userId: currentUser.id,
        message: `User ${updatedUser.name} (${updatedUser.username}) was approved by admin`
      });

      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error approving user:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/organization/users/:id/reject", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      
      // Check if user is admin
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const updatedUser = await storage.updateUserStatus(userId, "rejected", currentUser.id);
      
      // Create activity for rejection
      await storage.createActivity({
        type: "system_integration",
        userId: currentUser.id,
        message: `User ${updatedUser.name} (${updatedUser.username}) was rejected by admin`
      });

      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error rejecting user:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.put("/api/organization/users/:id/role", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUser = (req as any).user;
      
      // Check if user is admin
      if (currentUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }

      const { role } = req.body;
      const validRoles = ["recruiter", "lead", "admin", "sub-admin", "manager"];
      
      if (!role || !validRoles.includes(role)) {
        return res.status(400).json({ 
          message: "Valid role is required", 
          validRoles 
        });
      }

      const updatedUser = await storage.updateUserRole(userId, role, currentUser.id);
      
      // Create activity for role change
      await storage.createActivity({
        type: "system_integration",
        userId: currentUser.id,
        message: `User ${updatedUser.name} (${updatedUser.username}) role changed to ${role} by admin`
      });

      const { password, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Resume file download endpoint
