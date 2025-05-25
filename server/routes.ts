import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertJobSchema,
  insertCandidateSchema,
  insertSubmissionSchema,
  insertResumeDataSchema,
  insertActivitySchema,
  insertJobApplicationSchema,
} from "@shared/schema";
import { z } from "zod";
import { analyzeResumeText, matchResumeToJob } from "./openai";
import { findRecommendedCandidates } from "./recommendation-engine";
import fs from "fs";
import multer from "multer";
import { transformCandidateResumeData, transformCandidatesResumeData } from "./transformMiddleware";

// Configure multer for file uploads 
const multerStorage = multer.memoryStorage();
const fileUpload = multer({ storage: multerStorage });

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files statically
  app.use('/uploads', (req: Request, res: Response, next: NextFunction) => {
    const filePath = `./uploads${req.path}`;
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath, { root: '.' });
    } else {
      next();
    }
  });
  // Jobs routes
  app.get("/api/jobs", async (req: Request, res: Response) => {
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

  app.get("/api/jobs/:id", async (req: Request, res: Response) => {
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
  
  // API endpoint to get recommended candidates for a job
  app.get("/api/jobs/:id/recommended-candidates", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid job ID" });
      }
      
      // Get job to verify it exists
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      // Get limit from query params, default to 10
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Find recommended candidates
      const recommendations = await findRecommendedCandidates(id, limit);
      
      res.json(recommendations);
    } catch (error) {
      console.error("Error finding recommended candidates:", error);
      res.status(500).json({ 
        message: "Failed to find recommended candidates",
        error: (error as Error).message 
      });
    }
  });

  app.post("/api/jobs", async (req: Request, res: Response) => {
    try {
      // Import sanitization utility
      const { sanitizeHtml } = await import("./utils");

      // Sanitize job description if it exists
      if (req.body.description) {
        req.body.description = sanitizeHtml(req.body.description);
      }
      
      // Ensure createdBy is properly set to a valid user ID
      if (!req.body.createdBy) {
        // Get a valid recruiter ID to assign as the creator
        try {
          const recruiters = await storage.getRecruiters();
          if (recruiters && recruiters.length > 0) {
            req.body.createdBy = recruiters[0].id;
          } else {
            return res.status(400).json({ message: "No valid recruiters found to assign as job creator" });
          }
        } catch (err) {
          console.error("Error finding recruiters:", err);
          return res.status(400).json({ message: "Unable to assign a valid creator to this job" });
        }
      }

      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validatedData);
      
      // After job creation, we'll find suitable candidates in the background
      // This won't block the response to the client
      findRecommendedCandidates(job.id, 10).catch(error => {
        console.error("Error finding recommended candidates:", error);
      });

      // Assign recruiters if provided
      if (req.body.recruiterIds && Array.isArray(req.body.recruiterIds)) {
        await storage.assignRecruitersToJob(job.id, req.body.recruiterIds);
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

  app.put("/api/jobs/:id/description", async (req: Request, res: Response) => {
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

  app.put("/api/jobs/:id/status", async (req: Request, res: Response) => {
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
          message: `Job ${job.title} (${job.jobId}) status changed from ${prevStatus} to ${status}. ${submissions.length} candidate submissions affected.`,
        });

        // Process each submission to ensure resume data is preserved
        for (const submission of submissions) {
          console.log(
            `Processing submission ID ${submission.id} for candidate ID ${submission.candidateId}`,
          );

          // We don't need to do anything special here since the data model
          // already preserves candidate resume data independently of job status
          // The API will automatically filter out the actual resume file when
          // responding to requests for closed jobs
        }
      }

      res.json(updatedJob);
    } catch (error) {
      console.error("Error updating job status:", error);
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/jobs/:id/assign", async (req: Request, res: Response) => {
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

  // Candidates routes
  app.get("/api/candidates", async (_req: Request, res: Response) => {
    try {
      const candidates = await storage.getCandidates();
      
      // For each candidate, get their resume data
      const candidatesWithResumeData = await Promise.all(
        candidates.map(async (candidate) => {
          const resumeData = await storage.getResumeData(candidate.id);
          return {
            ...candidate,
            resumeData
          };
        })
      );

      // Transform all candidates' resume data to structured format
      const transformedCandidates = candidatesWithResumeData.map(candidate => 
        transformCandidateResumeData(candidate)
      );
      
      res.json(transformedCandidates);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.get("/api/candidates/:id", async (req: Request, res: Response) => {
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

      // Add resume data to the candidate object
      const candidateWithResumeData = {
        ...candidate,
        resumeData: resumeData || {
          id: 0,
          candidateId: candidate.id,
          clientNames: [],
          jobTitles: [],
          relevantDates: [],
          skills: [],
          education: [],
          extractedText: null,
          fileName: null,
          uploadedAt: new Date()
        }
      };

      // Transform the resume data from flat arrays to structured format
      const transformedCandidate = transformCandidateResumeData(candidateWithResumeData);

      res.json({
        ...transformedCandidate,
        submissions: enhancedSubmissions,
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/candidates", async (req: Request, res: Response) => {
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
        const hasNewResumeData = req.body.resumeData && 
          (req.body.resumeData.clientNames?.length > 0 || req.body.resumeData.jobTitles?.length > 0);
        
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
        
        if (existingResumeData && hasNewResumeData) {
          // This candidate exists and has both existing and new resume data - needs validation
          console.log("Candidate requires employment history validation, returning 202");
          
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

      const candidate = await storage.createCandidate(validatedData);

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
  app.get("/api/submissions", async (req: Request, res: Response) => {
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

  app.get("/api/submissions/:id", async (req: Request, res: Response) => {
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

  app.post("/api/submissions", async (req: Request, res: Response) => {
    try {
      const submissionData = req.body;
      let candidateId: number;
      
      // Ensure jobId is converted to a number
      const jobId = typeof submissionData.jobId === 'string' 
        ? parseInt(submissionData.jobId, 10) 
        : submissionData.jobId;

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
      }

      // Now prepare the submission data
      const submissionPayload = {
        jobId: submissionData.jobId,
        candidateId: candidateId,
        recruiterId: submissionData.recruiterId,
        status: submissionData.status || "submitted",
        matchScore: submissionData.matchScore,
        agreedRate: submissionData.agreedRate,
        notes: submissionData.notes || "",
        isSuspicious: !!submissionData.isSuspicious,
        suspiciousReason: submissionData.suspiciousReason || null,
        suspiciousSeverity: submissionData.suspiciousSeverity || null,
      };

      const validatedData = insertSubmissionSchema.parse(submissionPayload);

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
  app.get("/api/activities", async (req: Request, res: Response) => {
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

  app.post("/api/activities", async (req: Request, res: Response) => {
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

  // Users/recruiters routes
  app.get("/api/recruiters", async (_req: Request, res: Response) => {
    try {
      const recruiters = await storage.getRecruiters();
      res.json(recruiters);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (_req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Candidate validation endpoint
  // Add endpoint to check for similar employment histories
  app.post("/api/candidates/check-similar-employment", async (req: Request, res: Response) => {
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
              agreedRate: req.body.hourlyRate ? parseFloat(req.body.hourlyRate) : 0,
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
  
  app.post("/api/parse-document", fileUpload.single('file'), async (req: Request, res: Response) => {
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

  app.post("/api/openai/match-resume", async (req: Request, res: Response) => {
    try {
      const { resumeText, jobDescription, jobId, clientFocus } = req.body;

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

      // Sanitize inputs
      const sanitizedResumeText = sanitizeHtml(resumeText);
      const sanitizedJobDescription = sanitizeHtml(jobDescription);
      
      // Get client focus from database if jobId provided but clientFocus not directly provided
      let sanitizedClientFocus = clientFocus ? sanitizeHtml(clientFocus) : "";
      
      if (jobId && !clientFocus) {
        try {
          const job = await storage.getJob(parseInt(jobId.toString()));
          if (job && job.clientFocus) {
            sanitizedClientFocus = sanitizeHtml(job.clientFocus);
            console.log(`Retrieved client focus for job ${jobId}: ${sanitizedClientFocus.substring(0, 100)}...`);
          }
        } catch (error) {
          console.warn(`Failed to get client focus from job ${jobId}:`, error);
        }
      }

      console.log("Match resume request received:");
      console.log("- Resume text length:", sanitizedResumeText.length);
      console.log("- Job description length:", sanitizedJobDescription.length);
      console.log("- Client focus provided:", sanitizedClientFocus ? "Yes" : "No");
      
      if (sanitizedClientFocus) {
        console.log("- Client focus length:", sanitizedClientFocus.length);
      }

      console.log("Analyzing resume match...");
      
      // Use OpenAI directly to extract employment history and analyze match
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
        
        // Build client focus section to include in prompt if available
        const clientFocusSection = sanitizedClientFocus 
          ? `\nClient Focus Areas (PRIORITIZE THESE SKILLS/EXPERIENCES):\n${sanitizedClientFocus}`
          : "";
        
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
                "Be precise, accurate, and only use information actually present in the resume. " +
                "When evaluating matches, prioritize the client focus areas when provided - these are the most important skills/experiences for this particular role."
            },
            {
              role: "user",
              content: 
                `I need you to analyze this resume for compatibility with the following job description.
                
                Resume:
                ${sanitizedResumeText}
                
                Job Description:
                ${sanitizedJobDescription}${clientFocusSection}
                
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
                ${sanitizedClientFocus ? "   - IMPORTANT: Give extra weight to the client focus areas when calculating the score. These are top priorities." : ""}
                
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
                ${sanitizedClientFocus ? '- clientFocusMatch: { score (number 0-100), matchingAreas (array), missingAreas (array) }' : ''}
                
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
          
          // Client focus match data - if available
          clientFocusScore: analysisResult.clientFocusMatch?.score || 0,
          clientFocusMatches: analysisResult.clientFocusMatch?.matchingAreas || [],
          clientFocusMissing: analysisResult.clientFocusMatch?.missingAreas || [],
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
      
      // Extra debugging for education data
      console.log("EDUCATION DATA CHECK:");
      console.log("1. Education data from OpenAI:", matchResult.education);
      console.log("2. Education data type:", typeof matchResult.education);
      console.log("3. Is education an array?", Array.isArray(matchResult.education));
      console.log("4. Education data length:", matchResult.education?.length || 0);
      
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
          
        // Include client focus match data if available
        clientFocusScore: typeof matchResult.clientFocusScore === "number" 
          ? matchResult.clientFocusScore 
          : 0,
        clientFocusMatches: Array.isArray(matchResult.clientFocusMatches)
          ? matchResult.clientFocusMatches
          : [],
        clientFocusMissing: Array.isArray(matchResult.clientFocusMissing)
          ? matchResult.clientFocusMissing
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
  app.post("/api/validate-resume", async (req: Request, res: Response) => {
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

  // Test route for gap analysis
  app.get("/api/test-gap-analysis", async (_req: Request, res: Response) => {
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
  
  // Job Applications routes
  app.get("/api/applications", async (req: Request, res: Response) => {
    try {
      const { jobId, status } = req.query;
      
      const filters: { jobId?: number; status?: string } = {};
      
      if (jobId && typeof jobId === "string") {
        filters.jobId = parseInt(jobId);
      }
      
      if (status && typeof status === "string") {
        filters.status = status;
      }
      
      const applications = await storage.getJobApplications(filters);
      
      // For each application, get job details
      const applicationsWithJobDetails = await Promise.all(
        applications.map(async (application) => {
          const job = await storage.getJob(application.jobId);
          return {
            ...application,
            job: job ? {
              id: job.id,
              title: job.title,
              clientName: job.clientName,
              jobType: job.jobType
            } : null
          };
        })
      );
      
      res.json(applicationsWithJobDetails);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.get("/api/applications/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      
      const application = await storage.getJobApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Get job details
      const job = await storage.getJob(application.jobId);
      
      res.json({
        ...application,
        job: job ? {
          id: job.id,
          title: job.title,
          clientName: job.clientName,
          jobType: job.jobType
        } : null
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Handle public job applications 
  app.post("/api/public/applications", fileUpload.single('resume'), async (req: Request, res: Response) => {
    try {
      const { jobId, firstName, lastName, email, phone, workAuthorization, coverLetter } = req.body;
      
      if (!jobId || !firstName || !lastName || !email || !phone) {
        return res.status(400).json({ message: "Missing required application details" });
      }
      
      // Convert jobId to number
      const numericJobId = parseInt(jobId);
      
      // Verify the job exists and is active
      const job = await storage.getJob(numericJobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }
      
      if (job.status !== 'active') {
        return res.status(400).json({ message: "This job is no longer accepting applications" });
      }
      
      // Handle resume file
      let resumeFileName = null;
      if (req.file) {
        // Save the file
        const fileExt = req.file.originalname.split('.').pop();
        resumeFileName = `${Date.now()}_${firstName}_${lastName}.${fileExt}`;
        
        // Create uploads directory if it doesn't exist
        const uploadsDir = './uploads';
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        // Write the file
        fs.writeFileSync(`${uploadsDir}/${resumeFileName}`, req.file.buffer);
      }
      
      // Create application
      const newApplication = await storage.createJobApplication({
        jobId: numericJobId,
        firstName,
        lastName,
        email,
        phone,
        workAuthorization,
        coverLetter,
        resumeFileName,
        status: 'pending'
      });
      
      // Create activity
      await storage.createActivity({
        type: 'application_received',
        jobId: numericJobId,
        applicationId: newApplication.id,
        message: `${firstName} ${lastName} applied for ${job.title}`
      });
      
      res.status(201).json({
        message: "Application submitted successfully",
        applicationId: newApplication.id
      });
    } catch (error) {
      console.error("Error processing application:", error);
      res.status(500).json({ message: "Failed to process your application" });
    }
  });
  
  // Update application status
  app.patch("/api/applications/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid application ID" });
      }
      
      const { status, notes } = req.body;
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      // Get the application to ensure it exists
      const application = await storage.getJobApplication(id);
      if (!application) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      // Use 1 as the reviewer ID for now (in a real app, this would be the current user)
      const reviewerId = 1;
      
      // Update application status
      const updatedApplication = await storage.updateJobApplicationStatus(id, status, notes, reviewerId);
      
      // Get job details for the activity
      const job = await storage.getJob(application.jobId);
      
      // Create activity for the status change
      await storage.createActivity({
        type: 'application_processed',
        userId: reviewerId,
        jobId: application.jobId,
        applicationId: id,
        message: `Application from ${application.firstName} ${application.lastName} for ${job?.title || 'job'} has been ${status}`
      });
      
      res.json(updatedApplication);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  // Initialize the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}

// Resume file download endpoint
