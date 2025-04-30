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
import { analyzeResumeText, matchResumeToJob } from "./openai";

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
      
      const updatedJob = await storage.updateJobStatus(id, status);
      res.json(updatedJob);
    } catch (error) {
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
      
      if (existingCandidate) {
        return res.status(409).json({ 
          message: "Candidate already exists", 
          candidateId: existingCandidate.id 
        });
      }
      
      const candidate = await storage.createCandidate(validatedData);
      
      // Create resume data if provided
      if (req.body.resumeData) {
        const resumeDataPayload = {
          candidateId: candidate.id,
          clientNames: req.body.resumeData.clientNames || [],
          jobTitles: req.body.resumeData.jobTitles || [],
          relevantDates: req.body.resumeData.relevantDates || [],
          skills: req.body.resumeData.skills || [],
          education: req.body.resumeData.education || [],
          extractedText: req.body.resumeData.extractedText
        };
        
        await storage.createResumeData(resumeDataPayload);
      }
      
      res.status(201).json(candidate);
    } catch (error) {
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
          } : undefined
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
      
      res.json({
        ...submission,
        job,
        candidate,
        recruiter
      });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });
  
  app.post("/api/submissions", async (req: Request, res: Response) => {
    try {
      const submissionData = req.body;
      let candidateId: number;
      
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
        
        if (existingCandidate) {
          // Use the existing candidate
          candidateId = existingCandidate.id;
        } else {
          // Create a new candidate
          const newCandidate = await storage.createCandidate(validatedCandidateData);
          candidateId = newCandidate.id;
          
          // Create resume data if provided
          if (submissionData.resumeData) {
            const resumeDataPayload = {
              candidateId: newCandidate.id,
              clientNames: submissionData.resumeData.clientNames || [],
              jobTitles: submissionData.resumeData.jobTitles || [],
              relevantDates: submissionData.resumeData.relevantDates || [],
              skills: submissionData.resumeData.skills || [],
              education: submissionData.resumeData.education || [],
              extractedText: submissionData.resumeData.extractedText
            };
            
            await storage.createResumeData(resumeDataPayload);
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
        notes: submissionData.notes || ""
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
          message: "Candidate has already been submitted for this job",
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
      
      const { status } = req.body;
      if (!status || typeof status !== "string") {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const updatedSubmission = await storage.updateSubmissionStatus(id, status);
      
      // Create an activity for the status change
      const submission = await storage.getSubmission(id);
      if (submission) {
        await storage.createActivity({
          type: "status_changed",
          submissionId: id,
          jobId: submission.jobId,
          candidateId: submission.candidateId,
          message: `Submission status changed to ${status}`
        });
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
      const { sanitizeHtml } = await import('./utils');
      
      // Sanitize the text before passing to OpenAI
      const sanitizedText = sanitizeHtml(text);
      
      const analysis = await analyzeResumeText(sanitizedText);
      res.json(analysis);
    } catch (error) {
      console.error("Resume analysis error:", error);
      res.status(500).json({ message: (error as Error).message });
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
        suggestions: Array.isArray(matchResult.suggestions) ? matchResult.suggestions : []
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
        suggestions: ["Try a different resume format or contact support"]
      });
    }
  });
  
  // Initialize the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
