import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertJobSchema, 
  insertCandidateSchema, 
  insertSubmissionSchema, 
  insertResumeDataSchema,
  insertActivitySchema
} from "@shared/schema";
import { z } from "zod";
import { 
  analyzeResumeText, 
  analyzeResumeWithAI, 
  matchResumeToJob 
} from "./openai";
import { syncCandidateToTalentStreamline } from "./talentStreamline";
import fs from "fs";

export async function registerRoutes(app: Express): Promise<Server> {
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
      const { sanitizeHtml } = await import('./utils');
      
      // Sanitize the job description to prevent HTML parsing issues
      if (job.description) {
        job.description = sanitizeHtml(job.description);
      }
      
      // Get assigned recruiters
      const assignments = await storage.getJobAssignments(job.id);
      const assignedUserIds = assignments.map(a => a.userId);
      const recruiters = await Promise.all(
        assignedUserIds.map(id => storage.getUser(id))
      );
      
      // Get submissions for this job
      const submissions = await storage.getSubmissions({ jobId: job.id });
      
      res.json({
        ...job,
        assignedRecruiters: recruiters.filter(Boolean),
        submissions
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post("/api/jobs", async (req: Request, res: Response) => {
    try {
      // Import sanitization utility
      const { sanitizeHtml } = await import('./utils');
      
      // Sanitize job description if it exists
      if (req.body.description) {
        req.body.description = sanitizeHtml(req.body.description);
      }
      
      const validatedData = insertJobSchema.parse(req.body);
      const job = await storage.createJob(validatedData);
      
      // Assign recruiters if provided
      if (req.body.recruiterIds && Array.isArray(req.body.recruiterIds)) {
        await storage.assignRecruitersToJob(job.id, req.body.recruiterIds);
      }
      
      // Create an activity
      await storage.createActivity({
        type: "job_created",
        userId: job.createdBy,
        jobId: job.id,
        message: `Job ${job.title} (${job.jobId}) was created`
      });
      
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
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
      if (prevStatus.toLowerCase() === 'active' && status.toLowerCase() === 'closed') {
        console.log(`Job ${job.jobId} (${job.title}) is being closed. Updating candidate resume data...`);
        
        // Get all submissions for this job
        const submissions = await storage.getSubmissions({ jobId: id });
        
        // Create an activity for the job status change
        await storage.createActivity({
          type: "job_closed",
          jobId: id,
          message: `Job ${job.title} (${job.jobId}) status changed from ${prevStatus} to ${status}. ${submissions.length} candidate submissions affected.`
        });
        
        // Process each submission to ensure resume data is preserved
        for (const submission of submissions) {
          console.log(`Processing submission ID ${submission.id} for candidate ID ${submission.candidateId}`);
          
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
      const validRecruiterIds = recruiterIds.filter(id => !isNaN(Number(id))).map(Number);
      
      if (validRecruiterIds.length === 0) {
        return res.status(400).json({ message: "No valid recruiter IDs provided" });
      }
      
      const assignments = await storage.assignRecruitersToJob(id, validRecruiterIds);
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
      res.json(candidates);
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
      const submissions = await storage.getSubmissions({ candidateId: candidate.id });
      
      // Enhance submissions with job and recruiter details
      const enhancedSubmissions = await Promise.all(submissions.map(async (submission) => {
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
          recruiter: recruiter ? {
            id: recruiter.id,
            name: recruiter.username,
          } : null
        };
      }));
      
      res.json({
        ...candidate,
        resumeData,
        submissions: enhancedSubmissions
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
        validatedData.ssn4
      );
      
      // Only count as duplicate if already submitted to the same job
      if (existingCandidate && req.body.jobId) {
        try {
          // Check if candidate is already submitted to this job
          const existingSubmission = await storage.getSubmissionByJobAndCandidate(
            parseInt(req.body.jobId),
            existingCandidate.id
          );
          
          if (existingSubmission) {
            return res.status(409).json({ 
              message: "This candidate is already in our past submitted list for this job", 
              candidateId: existingCandidate.id,
              submissionId: existingSubmission.id
            });
          }
        } catch (error) {
          console.error("Error checking for duplicate submission:", error);
        }
        
        // Candidate exists but has not been submitted to this job
        return res.status(409).json({ 
          message: "Existing candidate found, proceed with submission to this job", 
          candidateId: existingCandidate.id 
        });
      }
      
      const candidate = await storage.createCandidate(validatedData);
      
      // Import the sanitization utility
      const { sanitizeHtml } = await import('./utils');
      
      // Create resume data if provided
      if (req.body.resumeData) {
        try {
          // Sanitize all resume data to prevent encoding issues
          const resumeDataPayload = {
            candidateId: candidate.id,
            clientNames: Array.isArray(req.body.resumeData.clientNames) 
              ? req.body.resumeData.clientNames.map((name: string) => sanitizeHtml(name)) 
              : [],
            jobTitles: Array.isArray(req.body.resumeData.jobTitles) 
              ? req.body.resumeData.jobTitles.map((title: string) => sanitizeHtml(title)) 
              : [],
            relevantDates: Array.isArray(req.body.resumeData.relevantDates) 
              ? req.body.resumeData.relevantDates.map((date: string) => sanitizeHtml(date)) 
              : [],
            skills: Array.isArray(req.body.resumeData.skills) 
              ? req.body.resumeData.skills.map((skill: string) => sanitizeHtml(skill)) 
              : [],
            education: Array.isArray(req.body.resumeData.education) 
              ? req.body.resumeData.education.map((edu: string) => sanitizeHtml(edu)) 
              : [],
            extractedText: req.body.resumeData.extractedText 
              ? sanitizeHtml(req.body.resumeData.extractedText).substring(0, 4000) 
              : ""
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
      
      const filters: { jobId?: number; candidateId?: number; recruiterId?: number } = {};
      
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
      const enhancedSubmissions = await Promise.all(submissions.map(async (submission) => {
        const job = await storage.getJob(submission.jobId);
        const candidate = await storage.getCandidate(submission.candidateId);
        const recruiter = await storage.getUser(submission.recruiterId);
        
        // Get resume data only if job is active
        let resumeData = null;
        if (job && job.status.toLowerCase() === 'active' && candidate) {
          resumeData = await storage.getResumeData(candidate.id);
        }
        
        return {
          ...submission,
          job: job ? {
            id: job.id,
            jobId: job.jobId,
            title: job.title,
            status: job.status
          } : undefined,
          candidate: candidate ? {
            id: candidate.id,
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            location: candidate.location,
            workAuthorization: candidate.workAuthorization
          } : undefined,
          recruiter: recruiter ? {
            id: recruiter.id,
            name: recruiter.name
          } : undefined,
          // Always include resume data, but add a flag to indicate if file access is restricted
          resumeData: resumeData ? {
            ...resumeData,
            fileAccessRestricted: !(job && job.status.toLowerCase() === 'active')
          } : null
        };
      }));
      
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
      
      // Always get resume data for display, but mark it as readonly if job is closed
      let resumeData = null;
      if (candidate) {
        resumeData = await storage.getResumeData(candidate.id);
      }
      
      // Determine if the file should be accessible based on job status
      const isJobActive = job && job.status.toLowerCase() === 'active';
      
      res.json({
        ...submission,
        job,
        candidate,
        recruiter,
        // Always include resume data, but add a flag to indicate if file access is restricted
        resumeData: resumeData ? {
          ...resumeData,
          fileAccessRestricted: !isJobActive
        } : null
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post("/api/submissions", async (req: Request, res: Response) => {
    try {
      const submissionData = req.body;
      let candidateId: number;
      const jobId = submissionData.jobId;
      
      if (!jobId) {
        return res.status(400).json({ message: "Job ID is required" });
      }
      
      // Handle case where this is a new candidate (has candidateData)
      if (submissionData.candidateData) {
        // First validate the candidate data
        const validatedCandidateData = insertCandidateSchema.parse(submissionData.candidateData);
        
        // Check if candidate already exists
        const existingCandidate = await storage.getCandidateByIdentity(
          validatedCandidateData.dobMonth,
          validatedCandidateData.dobDay,
          validatedCandidateData.ssn4
        );
        
        // Check if this candidate has already been submitted for this specific job
        if (existingCandidate) {
          // Check if this candidate is already submitted for this job
          const existingSubmission = await storage.getSubmissionByJobAndCandidate(
            jobId,
            existingCandidate.id
          );
          
          if (existingSubmission) {
            return res.status(409).json({ 
              message: "This candidate is already in our past submitted list for this job", 
              candidateId: existingCandidate.id,
              submissionId: existingSubmission.id
            });
          }
          
          // Use the existing candidate if they haven't been submitted for this job yet
          candidateId = existingCandidate.id;
        } else {
          // Create a new candidate
          const newCandidate = await storage.createCandidate(validatedCandidateData);
          candidateId = newCandidate.id;
          
          // Create resume data if provided
          if (submissionData.resumeData) {
            try {
              // Import the sanitization utility
              const { sanitizeHtml } = await import('./utils');
              
              // Sanitize all resume data to prevent encoding issues
              const resumeDataPayload = {
                candidateId: newCandidate.id,
                clientNames: Array.isArray(submissionData.resumeData.clientNames) 
                  ? submissionData.resumeData.clientNames.map((name: string) => sanitizeHtml(name)) 
                  : [],
                jobTitles: Array.isArray(submissionData.resumeData.jobTitles) 
                  ? submissionData.resumeData.jobTitles.map((title: string) => sanitizeHtml(title)) 
                  : [],
                relevantDates: Array.isArray(submissionData.resumeData.relevantDates) 
                  ? submissionData.resumeData.relevantDates.map((date: string) => sanitizeHtml(date)) 
                  : [],
                skills: Array.isArray(submissionData.resumeData.skills) 
                  ? submissionData.resumeData.skills.map((skill: string) => sanitizeHtml(skill)) 
                  : [],
                education: Array.isArray(submissionData.resumeData.education) 
                  ? submissionData.resumeData.education.map((edu: string) => sanitizeHtml(edu)) 
                  : [],
                extractedText: submissionData.resumeData.extractedText 
                  ? sanitizeHtml(submissionData.resumeData.extractedText).substring(0, 4000) 
                  : "",
                fileName: submissionData.resumeData.fileName || "",
                // Store any quality metrics from AI analysis if they exist
                qualityScore: submissionData.resumeData.qualityScore,
                contentSuggestions: Array.isArray(submissionData.resumeData.contentSuggestions)
                  ? submissionData.resumeData.contentSuggestions.map((suggestion: string) => sanitizeHtml(suggestion))
                  : [],
                formattingSuggestions: Array.isArray(submissionData.resumeData.formattingSuggestions)
                  ? submissionData.resumeData.formattingSuggestions.map((suggestion: string) => sanitizeHtml(suggestion))
                  : [],
                languageSuggestions: Array.isArray(submissionData.resumeData.languageSuggestions)
                  ? submissionData.resumeData.languageSuggestions.map((suggestion: string) => sanitizeHtml(suggestion))
                  : [],
                keywordScore: submissionData.resumeData.keywordScore,
                readabilityScore: submissionData.resumeData.readabilityScore
              };
              
              await storage.createResumeData(resumeDataPayload);
              console.log("Resume data successfully saved during submission");
            } catch (resumeError) {
              console.error("Failed to save resume data during submission:", resumeError);
              // Continue with candidate creation even if resume data fails
            }
          }
        }
      } else {
        // For existing candidate, just use the candidateId provided
        candidateId = submissionData.candidateId;
        if (!candidateId) {
          return res.status(400).json({ message: "Either candidateData or candidateId must be provided" });
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
        // Additional analysis fields needed for detailed view
        strengths: submissionData.strengths || [],
        weaknesses: submissionData.weaknesses || [],
        suggestions: submissionData.suggestions || [],
        technicalGaps: submissionData.technicalGaps || [],
        matchingSkills: submissionData.matchingSkills || [],
        missingSkills: submissionData.missingSkills || [],
        clientExperience: submissionData.clientExperience || "",
        confidence: submissionData.confidence || 0
      };
      
      const validatedData = insertSubmissionSchema.parse(submissionPayload);
      
      // Check if the candidate has already been submitted for this job
      const existingSubmission = await storage.getSubmissionByJobAndCandidate(
        validatedData.jobId,
        validatedData.candidateId
      );
      
      if (existingSubmission) {
        // Create an activity for duplicate submission attempt
        await storage.createActivity({
          type: "duplicate_detected",
          userId: validatedData.recruiterId,
          jobId: validatedData.jobId,
          candidateId: validatedData.candidateId,
          message: `Duplicate submission detected for job ID ${validatedData.jobId}`
        });
        
        return res.status(409).json({ 
          message: "This candidate is already in our past submitted list for this job",
          submissionId: existingSubmission.id
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
          message: `Candidate ${candidate.firstName} ${candidate.lastName} was submitted for ${job.title} (${job.jobId})`
        });
      }
      
      res.status(201).json({
        submission,
        candidate
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors });
      }
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.put("/api/submissions/:id/status", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid submission ID" });
      }
      
      const { status, feedback } = req.body;
      if (!status || typeof status !== "string") {
        return res.status(400).json({ message: "Status is required" });
      }
      
      // For now, we don't have authentication implemented, so use a default value
      // Later this can be updated when auth is implemented
      const userId = 1; // Default to admin user
      
      // Update submission with status, feedback, and last updated by
      const updatedSubmission = await storage.updateSubmissionStatus(id, status, feedback, userId);
      
      // Create an activity for the status change
      const submission = await storage.getSubmission(id);
      if (submission) {
        await storage.createActivity({
          type: "submission_status_changed",
          submissionId: id,
          jobId: submission.jobId,
          candidateId: submission.candidateId,
          userId: userId,
          message: `Submission status changed to ${status}${feedback ? " with feedback" : ""}`
        });
        
        // If status is "Offer Accepted", sync candidate data to TalentStreamline microservice
        if (status === "Offer Accepted") {
          console.log(`Offer accepted for submission #${id}. Syncing to TalentStreamline...`);
          try {
            const syncResult = await syncCandidateToTalentStreamline(id);
            if (syncResult) {
              console.log(`Successfully synced submission #${id} to TalentStreamline`);
              // Create an activity to log the sync
              await storage.createActivity({
                type: "system_integration",
                submissionId: id,
                jobId: submission.jobId,
                candidateId: submission.candidateId,
                message: `Candidate information synced to TalentStreamline`
              });
            } else {
              console.error(`Failed to sync submission #${id} to TalentStreamline`);
            }
          } catch (syncError) {
            console.error(`Error syncing to TalentStreamline: ${syncError.message}`);
            // We don't want to fail the status update if the sync fails,
            // so we just log the error and continue
          }
        }
      }
      
      res.json(updatedSubmission);
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  // Activities routes
  app.get("/api/activities", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
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
            enriched.candidate = await storage.getCandidate(activity.candidateId);
          }
          
          return enriched;
        })
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
  
  // OpenAI integration routes
  app.post("/api/openai/analyze-resume", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;
      
      if (!text || typeof text !== "string") {
        return res.status(400).json({ message: "Resume text is required" });
      }
      
      // Import the sanitization utility
      const { sanitizeHtml, isValidJson } = await import('./utils');
      
      // Check if text contains XML/HTML-like content that might cause issues
      if (text.includes('<!DOCTYPE') || text.includes('<?xml') || text.includes('<html')) {
        console.log("Detected potentially problematic document format with XML/HTML tags");
        
        // Special handling for Word documents or HTML content
        // Remove all XML/HTML tags and normalize whitespace
        let cleanedText = text.replace(/<[^>]*>?/g, ' ')
                              .replace(/\s+/g, ' ')
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
            message: "Unable to extract meaningful text from this document format. Please convert to plain text or a simpler format."
          });
        }
        
        // Use the cleaned text instead
        console.log("Using cleaned text from structured document, length:", cleanedText.length);
        
        // Proceed with analyzing the cleaned text
        try {
          const analysis = await analyzeResumeText(cleanedText);
          
          // Additional safety sanitization for extracted values
          const safeAnalysis = {
            clientNames: analysis.clientNames.map(client => sanitizeHtml(client)),
            jobTitles: analysis.jobTitles.map(title => sanitizeHtml(title)),
            relevantDates: analysis.relevantDates.map(date => sanitizeHtml(date)),
            skills: analysis.skills.map(skill => sanitizeHtml(skill)), 
            education: analysis.education.map(edu => sanitizeHtml(edu)),
            // Truncate extractedText to ensure it doesn't exceed DB limits
            extractedText: cleanedText.substring(0, 4000)
          };
          
          return res.json(safeAnalysis);
        } catch (innerError) {
          console.error("Failed to analyze cleaned document text:", innerError);
          return res.status(200).json({
            clientNames: [],
            jobTitles: [],
            relevantDates: [],
            skills: [],
            education: [],
            extractedText: cleanedText.substring(0, 1000),
            message: "Document was processed but couldn't be fully analyzed. Try a different format."
          });
        }
      }
      
      // For regular text content, proceed as normal
      // Sanitize the text before passing to OpenAI
      const sanitizedText = sanitizeHtml(text);
      
      console.log("Sanitized text length:", sanitizedText.length);
      
      // Try to use AI-enhanced analysis first, fall back to basic NLP
      let analysis;
      try {
        console.log("Trying AI-enhanced resume analysis...");
        analysis = await analyzeResumeWithAI(sanitizedText);
        console.log("AI-enhanced analysis successful");
      } catch (aiError) {
        console.warn("AI-enhanced analysis failed, falling back to basic NLP:", aiError);
        analysis = await analyzeResumeText(sanitizedText);
      }
      
      // Additional safety sanitization for extracted values
      const baseAnalysis = {
        clientNames: analysis.clientNames.map(client => sanitizeHtml(client)),
        jobTitles: analysis.jobTitles.map(title => sanitizeHtml(title)),
        relevantDates: analysis.relevantDates.map(date => sanitizeHtml(date)),
        skills: analysis.skills.map(skill => sanitizeHtml(skill)), 
        education: analysis.education.map(edu => sanitizeHtml(edu)),
        // Truncate extractedText to ensure it doesn't exceed DB limits
        extractedText: sanitizeHtml(analysis.extractedText).substring(0, 4000)
      };
      
      // Cast to access enhanced properties if they exist
      const enhancedAnalysis = analysis as any;
      
      // Combine base analysis with any enhanced metrics that may be available
      const safeAnalysis = {
        ...baseAnalysis,
        // Include enhanced quality metrics if available
        qualityScore: enhancedAnalysis.qualityScore,
        contentSuggestions: enhancedAnalysis.contentSuggestions,
        formattingSuggestions: enhancedAnalysis.formattingSuggestions,
        languageSuggestions: enhancedAnalysis.languageSuggestions,
        keywordScore: enhancedAnalysis.keywordScore,
        readabilityScore: enhancedAnalysis.readabilityScore,
        aiEnhanced: enhancedAnalysis.aiEnhanced || false
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
        message: "Failed to analyze resume due to encoding issues. Please try a different file format."
      });
    }
  });
  
  app.post("/api/openai/match-resume", async (req: Request, res: Response) => {
    try {
      const { resumeText, jobDescription } = req.body;
      
      if (!resumeText || typeof resumeText !== "string") {
        return res.status(200).json({ 
          message: "Resume text is required",
          score: 0,
          strengths: [],
          weaknesses: ["Missing resume text"],
          suggestions: ["Upload a resume to get a match score"]
        });
      }
      
      if (!jobDescription || typeof jobDescription !== "string") {
        return res.status(200).json({ 
          message: "Job description is required",
          score: 0,
          strengths: [],
          weaknesses: ["Missing job description"],
          suggestions: ["Provide a job description to match against"]
        });
      }
      
      // Import the sanitization utility
      const { sanitizeHtml } = await import('./utils');
      
      // Sanitize both the resume text and job description
      const sanitizedResumeText = sanitizeHtml(resumeText);
      const sanitizedJobDescription = sanitizeHtml(jobDescription);
      
      console.log("Match resume request received:");
      console.log("- Resume text length:", sanitizedResumeText.length);
      console.log("- Job description length:", sanitizedJobDescription.length);
      
      const matchResult = await matchResumeToJob(sanitizedResumeText, sanitizedJobDescription);
      
      // Ensure we return a properly structured response even if the matching service fails
      const response = {
        score: typeof matchResult.score === 'number' ? matchResult.score : 0,
        strengths: Array.isArray(matchResult.strengths) ? matchResult.strengths : [],
        weaknesses: Array.isArray(matchResult.weaknesses) ? matchResult.weaknesses : [],
        suggestions: Array.isArray(matchResult.suggestions) ? matchResult.suggestions : [],
        technicalGaps: Array.isArray(matchResult.technicalGaps) ? matchResult.technicalGaps : [],
        matchingSkills: Array.isArray(matchResult.matchingSkills) ? matchResult.matchingSkills : [],
        missingSkills: Array.isArray(matchResult.missingSkills) ? matchResult.missingSkills : [],
        clientExperience: matchResult.clientExperience || "",
        confidence: typeof matchResult.confidence === 'number' ? matchResult.confidence : 0
      };
      
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
        technicalGaps: [],
        matchingSkills: [],
        missingSkills: [],
        clientExperience: "",
        confidence: 0
      });
    }
  });
  
  // Resume file download endpoint
  app.get("/api/candidates/:id/resume", async (req: Request, res: Response) => {
    try {
      const candidateId = parseInt(req.params.id);
      if (isNaN(candidateId)) {
        return res.status(400).json({ error: "Invalid candidate ID" });
      }
      
      // Get the resume data
      const resumeData = await storage.getResumeData(candidateId);
      if (!resumeData) {
        return res.status(404).json({ error: "Resume not found" });
      }
      
      // Check if file exists in the resume data
      if (!resumeData.fileName) {
        return res.status(404).json({ error: "Resume file not available" });
      }
      
      // Check if this resume is for a closed job
      // If so, we shouldn't provide access to the actual file
      const submissions = await storage.getSubmissions({ candidateId });
      if (submissions.length > 0) {
        // Get unique job IDs without using Set
        const jobIds: number[] = [];
        submissions.forEach(s => {
          if (!jobIds.includes(s.jobId)) {
            jobIds.push(s.jobId);
          }
        });
        
        // Check if all jobs are closed
        let allJobsClosed = true;
        for (const jobId of jobIds) {
          const job = await storage.getJob(jobId);
          if (job && job.status.toLowerCase() === 'active') {
            allJobsClosed = false;
            break;
          }
        }
        
        // If all jobs are closed, don't allow resume download
        if (allJobsClosed) {
          return res.status(403).json({ 
            error: "Resume file not available", 
            message: "Resume files are not available for candidates with only closed jobs" 
          });
        }
      }
      
      // For a simplified test, return a PDF or DOCX file directly
      const fileName = resumeData.fileName;
      
      // Set appropriate content type based on file name
      let contentType = "application/octet-stream";
      if (fileName.endsWith(".pdf")) {
        contentType = "application/pdf";
      } else if (fileName.endsWith(".docx") || fileName.endsWith(".doc")) {
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      
      // Get the actual resume file (in a real system, this would be read from storage)
      // Here we're just sending the attached resume from the assets folder
      const filePath = `./attached_assets/${fileName}`;
      
      // Check if the file exists
      if (!fs.existsSync(filePath)) {
        // Fall back to the first DOCX resume in the assets folder
        const assetFiles = fs.readdirSync('./attached_assets');
        const docxFiles = assetFiles.filter(file => file.endsWith('.docx'));
        
        if (docxFiles.length === 0) {
          return res.status(404).json({ error: "Resume file not found" });
        }
        
        // Use the first available DOCX file
        return res.download(`./attached_assets/${docxFiles[0]}`, fileName);
      }
      
      // Send file
      return res.download(filePath);
    } catch (error) {
      console.error("Error downloading resume:", error);
      return res.status(500).json({ 
        error: "Failed to download resume file",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Initialize the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
