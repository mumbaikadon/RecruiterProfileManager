import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth, requireApprovedUser, checkOrganizationAccess } from "./auth";
import { storage } from "./storage";
import {
  insertCandidateSchema,
  insertJobSchema,
  insertApplicationSchema,
  insertMarketingPersonSchema,
  insertScrapingConfigSchema,
  updateUserProfileSchema,
  profileImageSchema,
  insertPotentialConsultantSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  insertInterviewSlotSchema,
  User,
  PotentialConsultant,
  InterviewSlot
} from "@shared/schema";
import { ZodError } from "zod";
import multer from "multer";
import path from 'path';
import fs from 'fs';
import { sendInterestLink, sendPasswordResetLink } from "./services/email-service";
import { parse } from "csv-parse";
import { stringify } from "csv-stringify";
import { sql } from "drizzle-orm";
import { parseResume } from './utils/resumeParser';
import { ScrapingService } from './services/scraping/scraping-service';
import { analyzeJobDescription } from './services/openai';
import { generateOfferLetterPreview, sendOfferLetter } from './utils/email';
import { analyzeResume, generateImprovedContent } from './services/resumeAnalyzer';
import { registerServiceRoutes } from './routes-services';

// Ensure uploads directory exists with proper permissions
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'resume' || file.fieldname === 'resumeFile') {
      const allowedTypes = ['.pdf', '.doc', '.docx'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedTypes.includes(ext)) {
        return cb(new Error('Only PDF and Word documents are allowed'));
      }
      cb(null, true);
    } else if (file.fieldname === 'file') {
      cb(null, file.mimetype === 'text/csv');
    } else if (file.fieldname === 'profileImage') {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.mimetype)) {
        return cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
      }
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});


function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  
  const user = req.user as User;
  if (user.role !== 'admin') {
    res.status(403).json({ message: "Admin access required" });
    return;
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Interview Slots API Endpoints
  app.get("/api/interview-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const organizationId = user.organizationId;
      
      console.log(`[API] Fetching interview slots for organizationId: ${organizationId}`);
      
      // Parse query parameters
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Parse filters
      const filters: any = {};
      if (req.query.candidateId) filters.candidateId = parseInt(req.query.candidateId as string);
      if (req.query.marketingPersonId) filters.marketingPersonId = parseInt(req.query.marketingPersonId as string);
      if (req.query.techStack) filters.techStack = req.query.techStack as string;
      if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
      if (req.query.toDate) filters.toDate = new Date(req.query.toDate as string);
      
      console.log(`[API] Applied filters:`, JSON.stringify(filters));
      
      const result = await storage.listInterviewSlots(organizationId, filters, page, limit);
      console.log(`[API] Found ${result.slots.length} interview slots out of ${result.total} total`);
      
      // Log the organization IDs of returned slots to verify filtering
      const returnedOrgIds = result.slots.map(slot => slot.organizationId);
      const uniqueOrgIds = Array.from(new Set(returnedOrgIds));
      console.log(`[API] Organization IDs in returned slots: ${JSON.stringify(uniqueOrgIds)} (should only be ${organizationId})`);
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching interview slots:", error);
      res.status(500).json({ error: "Failed to fetch interview slots" });
    }
  });
  
  app.get("/api/interview-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const organizationId = user.organizationId;
      const id = parseInt(req.params.id);
      
      const slot = await storage.getInterviewSlot(id, organizationId);
      if (!slot) {
        return res.status(404).json({ error: "Interview slot not found" });
      }
      
      res.json(slot);
    } catch (error) {
      console.error("Error fetching interview slot:", error);
      res.status(500).json({ error: "Failed to fetch interview slot" });
    }
  });
  
  app.post("/api/interview-slots", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const organizationId = user.organizationId;
      
      // Validate request body
      const interviewSlotData = insertInterviewSlotSchema.parse({
        ...req.body,
        organizationId,
      });
      
      const newSlot = await storage.createInterviewSlot(interviewSlotData);
      res.status(201).json(newSlot);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      console.error("Error creating interview slot:", error);
      res.status(500).json({ error: "Failed to create interview slot" });
    }
  });
  
  app.put("/api/interview-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const organizationId = user.organizationId;
      const id = parseInt(req.params.id);
      
      // Check if the slot exists and belongs to the user's organization
      const existingSlot = await storage.getInterviewSlot(id, organizationId);
      if (!existingSlot) {
        return res.status(404).json({ error: "Interview slot not found" });
      }
      
      // Validate and update
      const updates = req.body;
      const updatedSlot = await storage.updateInterviewSlot(id, updates, organizationId);
      res.json(updatedSlot);
    } catch (error) {
      console.error("Error updating interview slot:", error);
      res.status(500).json({ error: "Failed to update interview slot" });
    }
  });
  
  app.delete("/api/interview-slots/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const organizationId = user.organizationId;
      const id = parseInt(req.params.id);
      
      // Check if the slot exists and belongs to the user's organization
      const existingSlot = await storage.getInterviewSlot(id, organizationId);
      if (!existingSlot) {
        return res.status(404).json({ error: "Interview slot not found" });
      }
      
      await storage.deleteInterviewSlot(id, organizationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting interview slot:", error);
      res.status(500).json({ error: "Failed to delete interview slot" });
    }
  });
  
  // Endpoint to schedule a meeting for an interview slot
  app.post("/api/interview-slots/:id/schedule-meeting", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as User;
      const organizationId = user.organizationId;
      const id = parseInt(req.params.id);
      
      // Check if the slot exists and belongs to the user's organization
      const existingSlot = await storage.getInterviewSlot(id, organizationId);
      if (!existingSlot) {
        return res.status(404).json({ error: "Interview slot not found" });
      }
      
      // Get candidate and marketing person details if they exist
      let candidateName = "Candidate";
      let candidateEmail = "";
      let marketerName = "";
      let marketerEmail = "";
      
      if (existingSlot.candidateId) {
        const candidate = await storage.getCandidate(existingSlot.candidateId, organizationId);
        if (candidate) {
          candidateName = candidate.name;
          candidateEmail = candidate.email || "";
        }
      }
      
      if (existingSlot.marketingPersonId) {
        const marketer = await storage.getMarketingPerson(existingSlot.marketingPersonId, organizationId);
        if (marketer) {
          marketerName = marketer.name;
          marketerEmail = marketer.email || "";
        }
      }
      
      // Prepare meeting details
      const meetingDetails = {
        subject: `Interview: ${existingSlot.pvName} - ${candidateName} - ${existingSlot.techStack}`,
        body: `
          <p><strong>Interview Details:</strong></p>
          <p>PV Name: ${existingSlot.pvName}</p>
          <p>Vendor: ${existingSlot.vendorName}</p>
          <p>Tech Stack: ${existingSlot.techStack}${existingSlot.otherStack ? ` (${existingSlot.otherStack})` : ''}</p>
          ${existingSlot.otherComment ? `<p>Comments: ${existingSlot.otherComment}</p>` : ''}
        `,
        startTime: new Date(existingSlot.timeFrom),
        endTime: new Date(existingSlot.timeTo),
        attendees: [
          existingSlot.panelEmailId,
          ...(candidateEmail ? [candidateEmail] : []),
          ...(marketerEmail ? [marketerEmail] : [])
        ],
        // In a real implementation, you might use a calendar service API here
      };
      
      // In a real implementation, you would call your calendar service API here
      // For now, we'll just simulate a successful meeting creation
      
      // Update the interview slot to mark that a calendar invite has been sent
      await storage.updateInterviewSlot(id, { calendarInvite: "Yes" }, organizationId);
      
      res.json({ 
        success: true, 
        message: "Meeting scheduled successfully",
        meetingDetails 
      });
    } catch (error) {
      console.error("Error scheduling meeting:", error);
      res.status(500).json({ error: "Failed to schedule meeting" });
    }
  });
  
  const scrapingService = new ScrapingService();
  
  // Register microservice integration routes
  registerServiceRoutes(app);

  // Job Description Analysis endpoint
  app.post("/api/analyze-job-description", requireAuth, async (req: Request, res: Response) => {
    try {
      const { jobDescription } = req.body;
      
      if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length < 50) {
        return res.status(400).json({ 
          error: "Invalid job description",
          message: "Please provide a job description with at least 50 characters for meaningful analysis"
        });
      }
      
      console.log("Analyzing job description, length:", jobDescription.length);
      const analysis = await analyzeJobDescription(jobDescription);
      console.log("Analysis completed successfully");
      
      res.json({ analysis });
    } catch (error) {
      console.error("Error analyzing job description:", error);
      res.status(500).json({ 
        error: "Analysis failed",
        message: error instanceof Error ? error.message : "Failed to analyze job description"
      });
    }
  });
  
  // Authenticated resume analysis route with daily limit
  // Public endpoint for resume analysis that redirects to authentication
  app.post("/api/public/analyze-resume", upload.single('resumeFile'), async (req, res) => {
    return res.status(401).json({
      message: "Authentication required. Please sign in to use the resume analysis feature.",
      requiresAuth: true
    });
  });
  
  // Endpoint to get user's resume analysis usage for the day
  app.get("/api/user/resume-analysis-usage", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const dailyLimit = 5;
      const analysisCount = await storage.countUserResumeAnalyses(userId, today);
      
      res.json({
        used: analysisCount,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - analysisCount)
      });
    } catch (error) {
      console.error('Error fetching resume analysis usage:', error);
      res.status(500).json({
        message: "Failed to fetch usage data",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Authenticated endpoint for resume analysis with daily limit
  app.post("/api/analyze-resume", requireAuth, upload.single('resumeFile'), async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Check if user has exceeded daily limit
      const dailyLimit = 5;
      const analysisCount = await storage.countUserResumeAnalyses(userId, today);
      
      if (analysisCount >= dailyLimit) {
        return res.status(429).json({ 
          message: `You have reached your limit of ${dailyLimit} resume analyses for today. Please try again tomorrow.`
        });
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "Resume file is required" });
      }
      
      const jobDescription = req.body.jobDescription;
      if (!jobDescription || jobDescription.trim() === '') {
        return res.status(400).json({ message: "Job description is required" });
      }
      
      const filePath = req.file.path;
      const fileType = req.file.mimetype;
      
      // Parse resume using AI
      const resumeData = await parseResume(filePath, fileType, true);
      
      // If parsing failed or resulted in empty data
      if (!resumeData || !resumeData.experience || resumeData.experience.length === 0) {
        return res.status(400).json({ message: "Unable to parse resume content" });
      }
      
      // Extract resume text from parsed data
      const resumeText = [
        ...resumeData.experience.map(exp =>
          `${exp.position} at ${exp.company}\n${exp.responsibilities.join('\n')}`
        ),
        ...resumeData.education.map(edu =>
          `${edu.degree} from ${edu.institution} (${edu.year})`
        ),
        resumeData.skills.technical.join(', '),
        resumeData.skills.soft.join(', ')
      ].join('\n\n');
      
      // Analyze resume against job description
      const analysis = await analyzeResume(resumeText, jobDescription);
      
      // Record this analysis in the database
      await storage.recordUserResumeAnalysis(userId, today);
      
      // Delete the uploaded file after processing
      fs.unlinkSync(filePath);
      
      res.json(analysis);
    } catch (error) {
      console.error('Resume analysis error:', error);
      res.status(500).json({
        message: "Failed to analyze resume",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Organization management routes
  
  // Public route for listing organizations - used during registration
  app.get("/api/public/organizations", async (req, res) => {
    try {
      const organizations = await storage.listOrganizations();
      // Only return active organizations for public view
      const activeOrganizations = organizations.filter(org => org.status === 'active');
      res.json(activeOrganizations);
    } catch (err) {
      console.log(err)
      console.error('Error fetching organizations:', err);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });
  
  // Public test endpoint for marketing metrics - FOR TESTING ONLY
  app.get("/api/public/test-marketing-metrics", async (req, res) => {
    try {
      // Default to organization ID 1 for testing
      const organizationId = 1;
      
      // Get all marketing persons for the organization
      const { marketingPersons } = await storage.listMarketingPersons(organizationId);
      
      // Initialize metrics object
      const metrics: Record<number, any> = {};
      
      // Calculate metrics for each marketing person
      for (const marketer of marketingPersons) {
        // Get count of assigned candidates
        const totalAssignments = await storage.getAssignedCandidatesCount(marketer.id, organizationId);
        
        // Get all assigned candidates to calculate the active ones
        const candidates = await storage.getAssignedCandidates(marketer.id, organizationId);
        const activeAssignments = candidates.filter(c => c.status === 'active').length;
        
        // Calculate conversion rate (mock value for testing)
        const conversionRate = totalAssignments > 0 ? (Math.floor(Math.random() * 50) + 50) / 10 : 0;
        
        // Calculate response time (mock value for testing)
        const responseTime = Math.floor(Math.random() * 48) + 24;
        
        metrics[marketer.id] = {
          totalAssignments,
          activeAssignments,
          conversionRate,
          responseTime
        };
      }
      
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching test marketing metrics:", error);
      res.status(500).json({ message: "Error fetching test marketing metrics" });
    }
  });
  
  // Public test endpoint for marketing persons - FOR TESTING ONLY
  app.get("/api/public/test-marketing-persons", async (req, res) => {
    try {
      // Default to organization ID 1 for testing
      const organizationId = 1;
      
      const marketingPersons = await storage.listMarketingPersons(organizationId);
      res.json({ marketingPersons: marketingPersons.marketingPersons });
    } catch (error) {
      console.error("Error fetching test marketing persons:", error);
      res.status(500).json({ message: "Error fetching test marketing persons" });
    }
  });
  
  // Public test endpoint for successful marketers - FOR TESTING ONLY
  app.get("/api/public/test-successful-marketers", async (req, res) => {
    try {
      // Default to organization ID 1 for testing
      const organizationId = 1;
      
      // Look back 2 days (48 hours) for status changes to "offer"
      const daysToLookBack = 2;
      
      const statusChanges = await storage.getRecentOfferStatusChanges(organizationId, daysToLookBack);
      
      if (!statusChanges || statusChanges.length === 0) {
        return res.json({ successfulMarketers: [] });
      }
      
      // Get all unique candidate IDs that have received offers
      const candidateIds = [...new Set(statusChanges.map(change => change.candidateId))];
      
      // Track successful marketers
      const successfulMarketers = new Set<number>();
      
      // For each candidate, find their marketers
      for (const candidateId of candidateIds) {
        const candidateMarketers = await storage.getCandidateMarketers(
          candidateId,
          organizationId
        );
        
        if (candidateMarketers && candidateMarketers.length > 0) {
          // Add all marketers for this candidate to our set
          candidateMarketers.forEach(marketer => {
            successfulMarketers.add(marketer.marketingPersonId);
          });
        }
      }
      
      res.json({ successfulMarketers: Array.from(successfulMarketers) });
    } catch (error) {
      console.error("Error fetching successful marketers:", error);
      res.status(500).json({ message: "Error fetching successful marketers" });
    }
  });
  
  // Route for public consultant interest submission
  app.post("/api/public/consultant-interest", async (req, res) => {
    try {
      // Check if a date string was sent and convert it to a Date object
      const formData = { ...req.body };
      
      // Convert all date fields from string to Date objects
      if (formData.availabilityDate && typeof formData.availabilityDate === 'string') {
        formData.availabilityDate = new Date(formData.availabilityDate);
      }
      
      if (formData.dob && typeof formData.dob === 'string') {
        formData.dob = new Date(formData.dob);
      }
      
      if (formData.visaExpiry && typeof formData.visaExpiry === 'string') {
        formData.visaExpiry = new Date(formData.visaExpiry);
      }
      
      const consultantData = insertPotentialConsultantSchema.parse({
        ...formData,
        // Set default values for fields not in the public form
        status: "new",
        contactAttempts: 0,
        lastContactedAt: null
      });
      
      // Check if this email already exists for this organization
      const existingConsultant = await storage.findPotentialConsultantByEmail(
        consultantData.email, 
        consultantData.organizationId
      );
      
      if (existingConsultant) {
        // Update the existing consultant record instead of creating a new one
        // Make sure availabilityDate is a Date object
        let updateData = {
          ...consultantData,
          updatedAt: new Date(),
          contactAttempts: (existingConsultant.contactAttempts || 0) + 1,
          lastContactedAt: new Date()
        };
        
        const updatedConsultant = await storage.updatePotentialConsultant(
          existingConsultant.id,
          updateData,
          consultantData.organizationId
        );
        return res.status(200).json({ 
          success: true, 
          message: "Interest updated successfully", 
          data: updatedConsultant 
        });
      }
      
      // Create a new consultant record
      const newConsultant = await storage.createPotentialConsultant(consultantData);
      res.status(201).json({ 
        success: true, 
        message: "Interest submitted successfully", 
        data: newConsultant 
      });
    } catch (error) {
      console.error("Error submitting consultant interest:", error);
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid form data", 
          errors: (error as ZodError).errors 
        });
      }
      res.status(500).json({ message: "Failed to submit interest" });
    }
  });
  
  // Authenticated route for organization management
  app.get("/api/organizations", requireAuth, async (req, res) => {
    try {
      const organizations = await storage.listOrganizations();
      res.json(organizations);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get("/api/organizations/current", requireAuth, async (req, res) => {
    try {
      const organization = await storage.getOrganization(req.user!.organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(organization);
    } catch (err) {
      console.error('Error fetching organization:', err);
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.patch("/api/organizations/current", requireAuth, requireAdmin, async (req, res) => {
    try {
      const data = req.body;
      // Only admin can update organization details
      const organization = await storage.updateOrganization(req.user!.organizationId, data);
      res.json(organization);
    } catch (err) {
      console.error('Error updating organization:', err);
      if (err instanceof ZodError) {
        res.status(400).json({ message: "Invalid data", errors: err.errors });
      } else if (err instanceof Error) {
        res.status(500).json({ message: err.message || "Internal server error" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // User management routes
  app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.listUsers(req.user!.organizationId);
      res.json(users);
    } catch (err) {
      console.error('Error fetching users:', err);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch("/api/users/:id/status", requireAuth, async (req, res) => {
    try {
      // Allow sub-admin to approve users
      const userRole = (req.user as User).role;
      if (userRole !== 'admin' && userRole !== 'sub_admin') {
        return res.status(403).json({ message: "Admin or Sub-admin access required" });
      }
      const id = parseInt(req.params.id);
      const { status, role } = req.body;
      
      if (!status || !["pending", "approved", "rejected", "inactive"].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }
      
      // Only allow role updates when the status is being set to approved
      const roleToUpdate = status === 'approved' ? role : undefined;
      
      const user = await storage.updateUserStatus(id, status, req.user!.organizationId, roleToUpdate);
      res.json(user);
    } catch (err) {
      console.error('Error updating user status:', err);
      if (err instanceof Error) {
        res.status(500).json({ message: err.message || "Internal server error" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // User profile update endpoint - allows users to update their own profile
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const { id, organizationId } = req.user!;
      
      // Get the current user data first to ensure we have all required fields
      const currentUser = await storage.getUser(id, organizationId);
      if (!currentUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // First check if the request has any data at all
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ 
          message: "No profile data provided",
          errors: [{ path: ["body"], message: "Request body cannot be empty" }]
        });
      }
      
      // Create a complete profile data object with current values as defaults
      const completeProfileData = {
        firstName: currentUser.firstName || "",
        lastName: currentUser.lastName || "",
        displayName: currentUser.displayName || "",
        phone: currentUser.phone || "",
        bio: currentUser.bio || "",
        profileImageUrl: currentUser.profileImageUrl || "",
        // Include any new values from the request
        ...req.body
      };
      
      try {
        // Validate the complete profile data
        const validatedData = updateUserProfileSchema.parse(completeProfileData);
        
        // Only pass the fields that were actually provided in the request
        const updatedFields: Record<string, any> = {};
        Object.keys(req.body).forEach(key => {
          if (key in validatedData) {
            updatedFields[key] = validatedData[key as keyof typeof validatedData];
          }
        });
        
        // Ensure we have at least one field to update
        if (Object.keys(updatedFields).length === 0) {
          return res.status(400).json({ 
            message: "No valid fields to update", 
            errors: [{ path: ["body"], message: "Request must include at least one valid field to update" }]
          });
        }
        
        // Update the user profile with only the fields that changed
        const updatedUser = await storage.updateUserProfile(id, updatedFields, organizationId);
        res.json(updatedUser);
      } catch (validationError) {
        if (validationError instanceof ZodError) {
          return res.status(400).json({ 
            message: "Invalid profile data", 
            errors: validationError.errors.map(e => ({ path: e.path, message: e.message }))
          });
        }
        throw validationError; // Re-throw unexpected errors
      }
    } catch (err) {
      console.error('Error updating user profile:', err);
      if (err instanceof Error) {
        res.status(500).json({ 
          message: "Failed to update profile", 
          error: err.message || "Internal server error"
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });
  
  // User profile image upload endpoint
  app.post("/api/user/profile-image", requireAuth, upload.single('profileImage'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ 
          message: "No profile image uploaded",
          errors: [{ path: ["profileImage"], message: "Profile image is required" }]
        });
      }
      
      // Validate file size
      const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
      if (req.file.size > MAX_FILE_SIZE) {
        // Remove the file if it's too large
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error("Failed to remove oversized file:", e);
        }
        
        return res.status(400).json({
          message: "File size too large",
          errors: [{ path: ["profileImage"], message: "Profile image must be less than 5MB" }]
        });
      }
      
      // Validate file type
      const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
        // Remove the invalid file
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error("Failed to remove invalid file:", e);
        }
        
        return res.status(400).json({
          message: "Invalid file type",
          errors: [{ path: ["profileImage"], message: "Profile image must be JPEG, PNG, or WebP" }]
        });
      }
      
      const { id, organizationId } = req.user!;
      
      // Create the profile image URL (no need to prepend the origin)
      const profileImageUrl = `/uploads/${req.file.filename}`;
      
      try {
        // Validate using the specific profile image schema
        const imageData = profileImageSchema.parse({ profileImageUrl });
        
        // Update just the profileImageUrl field
        const updatedUser = await storage.updateUserProfile(id, imageData, organizationId);
        
        res.json({ 
          success: true, 
          profileImageUrl,
          message: "Profile image uploaded successfully"
        });
      } catch (validationError) {
        // If validation fails, clean up the uploaded file
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error("Failed to remove file after validation error:", e);
        }
        
        if (validationError instanceof ZodError) {
          return res.status(400).json({ 
            message: "Invalid profile image data", 
            errors: validationError.errors.map(e => ({ path: e.path, message: e.message }))
          });
        }
        throw validationError; // Re-throw unexpected errors
      }
    } catch (err) {
      console.error('Error uploading profile image:', err);
      if (err instanceof Error) {
        res.status(500).json({ 
          message: "Failed to upload profile image", 
          error: err.message || "Internal server error"
        });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Send offer letter to candidate
  app.post("/api/candidates/:id/send-offer-letter", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const organizationId = (req.user as User).organizationId;
      const candidateId = parseInt(req.params.id, 10);
      
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }
      
      // Get candidate details
      const candidate = await storage.getCandidate(candidateId, organizationId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      
      // Check candidate has email
      if (!candidate.email) {
        return res.status(400).json({ message: "Candidate has no email address" });
      }
      
      // Check if candidate status is "offer"
      if (candidate.status !== "offer") {
        return res.status(400).json({ 
          message: "Offer letter can only be sent to candidates in 'offer' status"
        });
      }
      
      // Get form data
      const {
        jobTitle,
        jobType,
        jobMode,
        startDate,
        endDate,
        letterDate,
        responsibilities
      } = req.body;
      
      // Validate required fields
      if (!jobTitle || !jobType || !jobMode || !startDate || !endDate || !letterDate || !responsibilities) {
        return res.status(400).json({ message: "All offer letter fields are required" });
      }
      
      // Format responsibilities HTML from plain text (convert line breaks to paragraphs)
      const responsibilitiesHtml = responsibilities
        .split('\n')
        .filter((line: string) => line.trim() !== '')
        .map((line: string) => `<p>${line}</p>`)
        .join('');
      
      // Send the offer letter
      const emailSent = await sendOfferLetter({
        candidate: {
          name: candidate.name,
          email: candidate.email
        },
        jobDetails: {
          title: jobTitle,
          type: jobType,
          mode: jobMode
        },
        responsibilitiesHtml,
        letterDate,
        startDate,
        endDate
      });
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send offer letter" });
      }
      
      res.status(200).json({ 
        message: "Offer letter has been sent successfully",
        email: candidate.email
      });
    } catch (error) {
      console.error("Error sending offer letter:", error);
      res.status(500).json({ 
        message: "Failed to send offer letter",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get recent celebrations (candidates with "offer" status changes)
  app.get("/api/celebrations", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      console.log("Celebrations request from user ID:", req.user!.id, "Organization:", organizationId);
      
      // Default to looking back 1 day, but allow for configuration
      const daysToLookBack = req.query.days ? parseInt(req.query.days as string) : 1;
      console.log("Looking back days:", daysToLookBack);
      
      // Get recent status changes to "offer"
      const statusChanges = await storage.getRecentOfferStatusChanges(organizationId, daysToLookBack);
      console.log("Status changes returned:", statusChanges.length);
      
      // If no celebrations, return an empty array
      if (!statusChanges || statusChanges.length === 0) {
        console.log("No celebrations found");
        return res.json({ celebrations: [] });
      }
      
      // For each status change, get the candidate and their marketing people
      const celebrations = await Promise.all(
        statusChanges.map(async (change) => {
          console.log("Processing status change for candidate:", change.candidateId);
          const candidate = await storage.getCandidate(change.candidateId, organizationId);
          if (!candidate) {
            console.log("Candidate not found:", change.candidateId);
            return null;
          }
          
          const marketers = await storage.getCandidateMarketers(change.candidateId, organizationId);
          console.log("Found marketers for candidate:", marketers.length);
          
          return {
            candidate,
            marketers,
            statusChange: change
          };
        })
      );
      
      // Filter out null values and return
      const validCelebrations = celebrations.filter(Boolean);
      console.log("Valid celebrations to return:", validCelebrations.length);
      res.json({ celebrations: validCelebrations });
      
    } catch (error) {
      console.error("Error fetching celebrations:", error);
      res.status(500).json({ message: "Error fetching celebrations" });
    }
  });
  
  // Test endpoint to manually create a status change record for a candidate (for testing celebrations)
  app.post("/api/test/create-status-change", requireAuth, async (req, res) => {
    try {
      // Only allow this in development
      if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: "Test endpoints not available in production" });
      }
      
      const { candidateId, previousStatus, newStatus, changedAt } = req.body;
      
      if (!candidateId || !previousStatus || !newStatus) {
        return res.status(400).json({ 
          message: "Missing required fields",
          requiredFields: "candidateId, previousStatus, newStatus"
        });
      }
      
      const organizationId = req.user!.organizationId;
      const userId = req.user!.id;
      
      // Verify the candidate exists
      const candidate = await storage.getCandidate(candidateId, organizationId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      
      // Create a status change record
      const statusChange = await storage.recordCandidateStatusChange({
        candidateId,
        previousStatus,
        newStatus,
        changedAt: changedAt ? new Date(changedAt) : new Date(),
        changedBy: userId,
        organizationId
      });
      
      console.log("Test status change created:", statusChange);
      
      res.status(201).json({ 
        message: "Status change created for testing",
        statusChange
      });
      
    } catch (error) {
      console.error("Error creating test status change:", error);
      res.status(500).json({ 
        message: "Error creating test status change",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Candidate routes
  app.get("/api/candidates", requireAuth, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = req.query.search as string || '';
      const filter = req.query.filter as string || 'all';
      const sortBy = req.query.sortBy as string || 'name';
      const sortOrder = (req.query.sortOrder as string || 'asc') as 'asc' | 'desc';
      const includeMarketers = req.query.includeMarketers === 'true';
      const excludeStatus = req.query.excludeStatus as string || '';

      // Import the transformKeysToCamelCase function
      const { transformKeysToCamelCase } = await import('./utils/caseConversion');
      
      const candidatesResult = await storage.listCandidates(
        req.user!.organizationId, 
        page, 
        limit, 
        search, 
        filter, 
        sortBy, 
        sortOrder,
        excludeStatus
      );
      
      // Get the marketing persons for lookup of email addresses
      // Get all marketing persons without pagination - using a large limit to effectively get all
      const marketingResult = await storage.listMarketingPersons(req.user!.organizationId, 1, 1000);
      const marketingPersons = marketingResult?.marketingPersons || [];
    
      // Create a map for faster lookups by ID
      const marketingPersonMap = new Map();
      // Ensure marketingPersons is an array before using forEach
      if (Array.isArray(marketingPersons)) {
        marketingPersons.forEach(mp => {
          marketingPersonMap.set(mp.id, {
            id: mp.id,
            name: mp.name,
            email: mp.email
          });
        });
      }
      
      // Transform candidate data and include marketers data
      const transformedCandidates = await Promise.all(candidatesResult.candidates.map(async candidate => {
        const transformedCandidate = transformKeysToCamelCase(candidate);
        
        // Include marketers data if requested
        if (includeMarketers) {
          
          // Get candidate marketers
          const marketers = await storage.getCandidateMarketers(candidate.id, req.user!.organizationId);
          
          // Get the marketing persons for lookup of email addresses first
          //console.log('All marketing persons:', marketingPersons);
        
          // Process marketer data
          const marketersData = marketers.map(marketer => {
            // Convert keys to camelCase
            const camelCaseMarketer = transformKeysToCamelCase(marketer);
            
            // Find the marketing person details for this marketer using the map
            // The key could be marketingPersonId (camelCase) or marketing_person_id (snake_case)
            const marketerId = camelCaseMarketer.marketingPersonId || marketer.marketing_person_id;
            
            //console.log('Looking for marketer with ID:', marketerId);
            const marketingPerson = marketingPersonMap.get(marketerId);
            //console.log('Found marketing person from map:', marketingPerson);
            
            // Add the marketer details to the transformed object
            return {
              ...camelCaseMarketer,
              marketingPersonEmail: marketingPerson ? marketingPerson.email : null,
              marketingPersonName: marketingPerson ? marketingPerson.name : null
            };
          });
          
          // Add marketers data to candidate
          return {
            ...transformedCandidate,
            marketers: marketersData
          };
        }
        
        return transformedCandidate;
      }));
      
      // Transform the data to camelCase before sending to frontend
      const transformedResult = {
        candidates: transformedCandidates,
        total: candidatesResult.total
      };
      
      // Add debug logging to check candidate data
      console.log(JSON.stringify(transformedCandidates.slice(0, 2)));
      console.log("Example candidate structure:", JSON.stringify(transformedCandidates[0]));

      // Log sample candidate to check structure
      //console.log('Before transformation (sample):', JSON.stringify({candidates: candidatesResult.candidates.slice(0, 1)}));
      //console.log('After transformation (sample):', JSON.stringify({candidates: transformedCandidates.slice(0, 1)}));
      
      // Extract the first candidate with marketers for detailed inspection
      const candidateWithMarketers = transformedCandidates.find(c => c.marketers && c.marketers.length > 0);
      if (candidateWithMarketers) {
        //console.log('Example candidate with marketers:', JSON.stringify(candidateWithMarketers));
        //console.log('Marketers array structure:', JSON.stringify(candidateWithMarketers.marketers));
      }
      
      res.json(transformedResult);
    } catch (err) {
      console.error('Error fetching candidates:', err);
      res.status(500).json({ message: "Failed to fetch candidates" });
    }
  });
  
  // Get a single candidate by ID
  app.get("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const includeMarketers = req.query.includeMarketers === 'true';
      
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }
      
      const candidate = await storage.getCandidate(candidateId, req.user!.organizationId);
      
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      
      // Import the transformKeysToCamelCase function
      const { transformKeysToCamelCase } = await import('./utils/caseConversion');
      
      // Transform the candidate to camelCase
      const transformedCandidate = transformKeysToCamelCase(candidate);
      
      // If includeMarketers is true, add marketers data
      if (includeMarketers) {
        // Get all marketing persons for this organization
        const marketingResult = await storage.listMarketingPersons(req.user!.organizationId, 1, 1000);
        const marketingPersons = marketingResult?.marketingPersons || [];
        
        // Create a map for faster lookups
        const marketingPersonMap = new Map();
        marketingPersons.forEach(mp => marketingPersonMap.set(mp.id, mp));
        
        // Get candidate marketers from junction table
        const marketers = await storage.getCandidateMarketers(candidateId, req.user!.organizationId);
        
        // Process marketer data with names and emails
        const marketersData = marketers.map(marketer => {
          // Convert keys to camelCase
          const camelCaseMarketer = transformKeysToCamelCase(marketer);
          
          // Marketers should already have name/email from storage
          return camelCaseMarketer;
        });
        
        // Add marketers data to candidate
        return res.json({
          ...transformedCandidate,
          marketers: marketersData
        });
      }
      
      res.json(transformedCandidate);
    } catch (err) {
      console.error("Error getting candidate:", err);
      res.status(500).json({ message: "Failed to get candidate" });
    }
  });

  app.post("/api/candidates", requireAuth, upload.single('resume'), async (req, res) => {
    try {
      const candidateData = JSON.parse(req.body.data);
      const data = insertCandidateSchema.parse(candidateData);
      
      const existing = await storage.findCandidateByEmailOrPhone(data.email, data.phone, req.user!.organizationId);
      if (existing) {
        return res.status(409).json({
          message: "Candidate with this email or phone number already exists."
        });
      }
      if (req.file) {
        // Store basic file information
        data.resumeUrl = `/uploads/${req.file.filename}`;
        data.resumeFormat = path.extname(req.file.originalname).toLowerCase();

        try {
          // Parse resume content only once during upload
          console.log(`Processing file in POST handler: ${req.file.originalname}, MIME type: ${req.file.mimetype}, Extension: ${path.extname(req.file.originalname)}`);
          // Handle DOCX files by explicitly checking the file extension
          const fileExt = path.extname(req.file.originalname).toLowerCase();
          const mimeType = fileExt === '.docx' || fileExt === '.doc' 
            ? `application/${fileExt.substring(1)}` 
            : req.file.mimetype;
            
          const resumeData = await parseResume(req.file.path, mimeType);

          // Structure the resume data properly
          data.resumeData = {
            experience: resumeData.experience || [],
            skills: {
              technical: resumeData.skills?.technical || [],
              soft: resumeData.skills?.soft || [],
              certifications: resumeData.skills?.certifications || []
            },
            education: resumeData.education || [],
            projects: resumeData.projects || []
          };

          // Extract skills from resume if not provided
          if (!data.skills || data.skills.trim() === '') {
            const technicalSkills = resumeData.skills?.technical?.join(', ') || '';
            const softSkills = resumeData.skills?.soft?.join(', ') || '';
            data.skills = [technicalSkills, softSkills].filter(Boolean).join(', ');
          }

          // Clean up uploaded file after parsing
          // Keep the uploaded file for later download
        } catch (parseError) {
          console.error('Error parsing resume:', parseError);
          // If parsing fails, use empty resume data structure
          data.resumeData = {
            experience: [],
            skills: { technical: [], soft: [], certifications: [] },
            education: [],
            projects: []
          };
        }
      }

      const candidate = await storage.createCandidate(data, req.user!.organizationId);
      res.status(201).json(candidate);
    } catch (err) {
      console.error('Error creating candidate:', err);
      if (err instanceof ZodError) {
        res.status(400).json(err.errors);
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Bulk operations for candidates
  app.get("/api/candidates/bulk", requireAuth, async (req, res) => {
    try {
      const { candidates } = await storage.listCandidates(1, 1000, req.user!.organizationId); // Assuming a large limit for bulk operations

      // Convert candidates to CSV
      const csvData = candidates.map(candidate => ({
        name: candidate.name,
        email: candidate.email,
        phone: candidate.phone,
        skills: candidate.skills,
        status: candidate.status,
        education: JSON.stringify(candidate.education)
      }));

      stringify(csvData, { header: true }, (err, output) => {
        if (err) throw err;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=candidates.csv');
        res.send(output);
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to export candidates" });
    }
  });

  app.post("/api/candidates/bulk", requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      const candidates: any[] = [];
      fs.createReadStream(req.file.path)
        .pipe(parse({ columns: true, trim: true }))
        .on('data', (row) => {
          const candidate = {
            ...row,
            education: JSON.parse(row.education || '[]'),
            resumeData: {
              experience: [],
              skills: { technical: [], soft: [], certifications: [] },
              education: [],
              projects: []
            }
          };
          candidates.push(candidate);
        })
        .on('end', async () => {
          try {
            await storage.createCandidates(candidates, req.user!.organizationId);
            // Clean up the uploaded file
            // Keep the uploaded file for later reference
            res.status(201).json({ message: "Candidates imported successfully" });
          } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to import candidates" });
          }
        });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to process file" });
    }
  });

  //Added template endpoint
  app.get("/api/candidates/template", requireAuth, (req, res) => {
    const headers = [
      'name',
      'email',
      'phone',
      'skills',
      'education',
      'status'
    ];

    const sampleData = [{
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1 (555) 000-0000',
      skills: 'JavaScript, React, Node.js',
      education: JSON.stringify([{
        degree: 'Bachelor of Science',
        institution: 'University Name',
        graduationYear: '2020',
        grade: 'A'
      }]),
      status: 'active'
    }];

    stringify([...sampleData], {
      header: true,
      columns: headers
    }, (err, output) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Failed to generate template" });
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=candidates-template.csv');
      res.send(output);
    });
  });
  
  // Download resume file
  app.get("/api/candidates/resume/:fileName", requireAuth, async (req, res) => {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join(process.cwd(), 'uploads', fileName);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "Resume file not found" });
      }
      
      // Get file type
      const fileType = path.extname(fileName).toLowerCase();
      
      // Set appropriate content type
      let contentType = 'application/octet-stream';
      if (fileType === '.pdf') {
        contentType = 'application/pdf';
      } else if (fileType === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileType === '.doc') {
        contentType = 'application/msword';
      }
      
      // Set headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Send file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading resume:", error);
      return res.status(500).json({ message: "Error downloading resume file" });
    }
  });


  // Update the PATCH endpoint for candidates
  // PUT endpoint for updating a candidate (full update)
  app.put("/api/candidates/:id", requireAuth, upload.single('resume'), async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const { organizationId } = req.user as User;
      
      // Parse the JSON data from the form
      const candidateData = req.body.data ? JSON.parse(req.body.data) : req.body;
      
      // Validate the candidate data
      const parsedData = insertCandidateSchema.parse(candidateData);
      
      // Check if the candidate exists and belongs to the user's organization
      const existingCandidate = await storage.getCandidate(candidateId, organizationId);
      if (!existingCandidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      
      // If no new resume file is uploaded, preserve existing resume data
      if (!req.file && existingCandidate) {
        parsedData.resumeUrl = existingCandidate.resumeUrl;
        parsedData.resumeFormat = existingCandidate.resumeFormat;
        parsedData.resumeData = existingCandidate.resumeData;
      }
      
      // Update the candidate
      const updatedCandidate = await storage.updateCandidate(candidateId, parsedData, organizationId);
      
      // Process resume file if uploaded
      if (req.file) {
        let uploadedFile = req.file.path;
        try {
          // Store basic file information
          parsedData.resumeUrl = `/uploads/${req.file.filename}`;
          parsedData.resumeFormat = path.extname(req.file.originalname).toLowerCase();

          // Parse resume content
          console.log(`Processing file in PUT handler: ${req.file.originalname}, MIME type: ${req.file.mimetype}, Extension: ${path.extname(req.file.originalname)}`);
          // Handle DOCX files by explicitly checking the file extension
          const fileExt = path.extname(req.file.originalname).toLowerCase();
          const mimeType = fileExt === '.docx' || fileExt === '.doc' 
            ? `application/${fileExt.substring(1)}` 
            : req.file.mimetype;
            
          const resumeData = await parseResume(req.file.path, mimeType);
          console.log('Resume parsed successfully');

          // Structure the resume data
          parsedData.resumeData = {
            experience: resumeData.experience || [],
            skills: {
              technical: resumeData.skills?.technical || [],
              soft: resumeData.skills?.soft || [],
              certifications: resumeData.skills?.certifications || []
            },
            education: resumeData.education || [],
            projects: resumeData.projects || []
          };

          // Extract skills from resume if not provided
          if (!parsedData.skills || parsedData.skills.trim() === '') {
            const technicalSkills = resumeData.skills?.technical?.join(', ') || '';
            const softSkills = resumeData.skills?.soft?.join(', ') || '';
            parsedData.skills = [technicalSkills, softSkills].filter(Boolean).join(', ');
          }

          // Clean up uploaded file after parsing
          // Keep the uploaded file for later download
          uploadedFile = undefined;
        } catch (parseError) {
          console.error('Error parsing resume:', parseError);
          // If parsing fails, use empty resume data structure
          parsedData.resumeData = {
            experience: [],
            skills: { technical: [], soft: [], certifications: [] },
            education: [],
            projects: []
          };
          
          // Clean up uploaded file if it still exists
          if (uploadedFile && fs.existsSync(uploadedFile)) {
            try {
              // Keep the uploaded file for later download
            } catch (cleanupError) {
              console.error('Error cleaning up uploaded file:', cleanupError);
            }
          }
        }
      }
      
      // If resume was processed, update the candidate again with the parsed resume data
      if (req.file) {
        // Update the candidate with resume data
        const finalCandidate = await storage.updateCandidate(candidateId, parsedData, organizationId);
        return res.status(200).json(finalCandidate);
      } else {
        return res.status(200).json(updatedCandidate);
      }
    } catch (error) {
      console.error('Error updating candidate:', error);
      if (error instanceof ZodError) {
        return res.status(400).json(error.format());
      }
      return res.status(500).json({ message: "Failed to update candidate", error: error.message });
    }
  });

  // PATCH endpoint for partial update of a candidate
  app.patch("/api/candidates/:id", requireAuth, upload.single('resume'), async (req, res) => {
    let uploadedFile: string | undefined;

    try {
      const id = parseInt(req.params.id);
      if (!req.body.data) {
        throw new Error("No candidate data provided");
      }

      const candidateData = JSON.parse(req.body.data);
      const data = insertCandidateSchema.parse(candidateData);
      
      // If no new resume file is uploaded, preserve existing resume data
      if (!req.file) {
        const existingCandidate = await storage.getCandidate(id, req.user!.organizationId);
        if (existingCandidate) {
          data.resumeUrl = existingCandidate.resumeUrl;
          data.resumeFormat = existingCandidate.resumeFormat;
          data.resumeData = existingCandidate.resumeData;
        }
      }

      if (req.file) {
        uploadedFile = req.file.path;
        // Store basic file information
        data.resumeUrl = `/uploads/${req.file.filename}`;
        data.resumeFormat = path.extname(req.file.originalname).toLowerCase();

        try {
          // Parse resume content
          console.log(`Processing file in PATCH handler: ${req.file.originalname}, MIME type: ${req.file.mimetype}, Extension: ${path.extname(req.file.originalname)}`);
          // Handle DOCX files by explicitly checking the file extension
          const fileExt = path.extname(req.file.originalname).toLowerCase();
          const mimeType = fileExt === '.docx' || fileExt === '.doc' 
            ? `application/${fileExt.substring(1)}` 
            : req.file.mimetype;
          
          const resumeData = await parseResume(req.file.path, mimeType);

          // Structure the resume data
          data.resumeData = {
            experience: resumeData.experience || [],
            skills: {
              technical: resumeData.skills?.technical || [],
              soft: resumeData.skills?.soft || [],
              certifications: resumeData.skills?.certifications || []
            },
            education: resumeData.education || [],
            projects: resumeData.projects || []
          };

          // Extract skills from resume if not provided
          if (!data.skills || data.skills.trim() === '') {
            const technicalSkills = resumeData.skills?.technical?.join(', ') || '';
            const softSkills = resumeData.skills?.soft?.join(', ') || '';
            data.skills = [technicalSkills, softSkills].filter(Boolean).join(', ');
          }

          // Clean up uploaded file after parsing
          // Keep the uploaded file for later download
          uploadedFile = undefined;
        } catch (parseError) {
          console.error('Error parsing resume:', parseError);
          // If parsing fails, use empty resume data structure
          data.resumeData = {
            experience: [],
            skills: { technical: [], soft: [], certifications: [] },
            education: [],
            projects: []
          };
        }
      }

      // Update the candidate in the database
      // If resume was processed, update with resume data
      const candidate = await storage.updateCandidate(id, data, req.user!.organizationId);
      res.json(candidate);
    } catch (err) {
      // Clean up uploaded file if exists and there was an error
      if (uploadedFile && fs.existsSync(uploadedFile)) {
        try {
          // Keep the uploaded file for later download
        } catch (cleanupError) {
          console.error('Error cleaning up uploaded file:', cleanupError);
        }
      }

      console.error('Error updating candidate:', err);
      if (err instanceof ZodError) {
        res.status(400).json({ message: "Validation error", errors: err.errors });
      } else if (err instanceof Error) {
        res.status(500).json({ message: err.message || "Internal server error" });
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Job routes
  app.get("/api/jobs", requireAuth, async (req, res) => {
    const organizationId = req.user?.organizationId;
    if (!organizationId){
        return res.status(400).json({ message: "Organization ID is missing" });
    }
    const jobs = await storage.listJobs(organizationId);
    res.json(jobs);
  });

  app.post("/api/jobs", requireAuth, async (req, res) => {
    try {
      const data = insertJobSchema.parse(req.body);
      const job = await storage.createJob({...data, organizationId: req.user!.organizationId});
      res.status(201).json(job);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(err.errors);
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  // Add these routes near other API routes
  app.get("/api/scraping/configs", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user?.organizationId;
        if (!organizationId){
            return res.status(400).json({ message: "Organization ID is missing" });
        }
      const configs = await storage.listScrapingConfigs(organizationId);
      res.json(configs);
    } catch (err) {
      console.error('Error fetching scraping configs:', err);
      res.status(500).json({ message: "Failed to fetch scraping configurations" });
    }
  });

  app.get("/api/scraping/jobs", requireAuth, async (req, res) => {
    try {
        const organizationId = req.user?.organizationId;
        if (!organizationId){
            return res.status(400).json({ message: "Organization ID is missing" });
        }
      const jobs = await storage.listScrapingJobs(organizationId);
      res.json(jobs);
    } catch (err) {
      console.error('Error fetching scraping jobs:', err);
      res.status(500).json({ message: "Failed to fetch scraping jobs" });
    }
  });

  app.post("/api/scraping/configs", requireAuth, async (req, res) => {
    try {
      const data = insertScrapingConfigSchema.parse(req.body);
      const config = await storage.createScrapingConfig({...data, organizationId: req.user!.organizationId});
      res.status(201).json(config);
    } catch (err) {
      console.error('Error creating scraping config:', err);
      if (err instanceof ZodError) {
        res.status(400).json({ message: "Invalid data", errors: err.errors });
      } else {
        res.status(500).json({ message: "Failed to create scraping configuration" });
      }
    }
  });

  // Add this new route for job scraping
  app.post("/api/jobs/scrape/:portal", requireAuth, async (req, res) => {
    try {
      const portal = req.params.portal;
      const config = req.body;

      const result = await scrapingService.scrapeJobs(portal, {
        keywords: config.keywords,
        location: config.location,
        pageLimit: config.pageLimit || 1,
        filters: config.filters,
        organizationId: req.user!.organizationId
      });

      res.json(result);
    } catch (err) {
      console.error('Error scraping jobs:', err);
      res.status(500).json({
        message: "Failed to scrape jobs",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.post("/api/scraping/configs/:id/run", requireAuth, async (req, res) => {
    try {
      const configId = parseInt(req.params.id);

      // Get the config
      const config = await storage.getScrapingConfig(configId);
      if (!config) {
        return res.status(404).json({ message: "Scraping configuration not found" });
      }

      // Create a new scraping job
      const job = await storage.createScrapingJob({
        configId,
        status: "pending",
        totalJobs: 0,
        newJobs: 0,
        updatedJobs: 0,
        metadata: {},
        organizationId: req.user!.organizationId
      });

      // Start the scraping in the background
      scrapingService.runJob(job.id).catch(err => {
        console.error(`Error running scraping job ${job.id}:`, err);
      });

      res.status(201).json(job);
    } catch (err) {
      console.error('Error running scraping config:', err);
      res.status(500).json({ message: "Failed to run scraping configuration" });
    }
  });

  app.patch("/api/candidates/:id/assign", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Accept either snake_case or camelCase for compatibility
      const marketingPersonId = req.body.marketing_person_id !== undefined 
        ? req.body.marketing_person_id 
        : req.body.marketingPersonId;

      const candidate = await storage.assignMarketingPerson(
        id,
        marketingPersonId,
        req.user!.organizationId
      );

      res.json(candidate);
    } catch (err) {
      res.status(404).json({ message: "Failed to assign marketing person" });
    }
  });
  
  // New endpoints for candidate-marketer assignments
  app.post("/api/candidates/:id/marketers", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }
      
      const { marketingPersonId, role } = req.body;
      if (!marketingPersonId || !role) {
        return res.status(400).json({ message: "Marketing person ID and role are required" });
      }
      
      if (role !== 'primary' && role !== 'backup') {
        return res.status(400).json({ message: "Role must be either 'primary' or 'backup'" });
      }
      
      // Get the candidate to check current primary marketer
      const candidate = await storage.getCandidate(candidateId, req.user!.organizationId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Check if this marketer is already assigned in a different role
      if (role === 'primary') {
        // Check if they're already a backup marketer for this candidate
        const existingMarketers = await storage.getCandidateMarketers(candidateId, req.user!.organizationId);
        const alreadyBackup = existingMarketers.find(m => 
          m.marketingPersonId === marketingPersonId && m.role === 'backup'
        );
        
        if (alreadyBackup) {
          return res.status(400).json({ 
            message: "This person is already a backup marketer for this candidate. The same person cannot be both primary and backup marketer." 
          });
        }
      } 
      else if (role === 'backup') {
        // Check if they're already the primary marketer
        if (candidate.marketingPersonId === marketingPersonId) {
          return res.status(400).json({ 
            message: "This person is already the primary marketer for this candidate. The same person cannot be both primary and backup marketer." 
          });
        }
      }
      
      let result;
      
      // Primary marketers go into the candidates table
      if (role === 'primary') {
        result = await storage.assignMarketingPerson(
          candidateId,
          marketingPersonId,
          req.user!.organizationId
        );
      } 
      // Backup marketers go into the junction table
      else {
        result = await storage.assignCandidateMarketer(
          candidateId,
          marketingPersonId,
          'backup', // Enforce backup role for junction table
          req.user!.organizationId
        );
      }
      
      res.status(201).json(result);
    } catch (err) {
      console.error("Error assigning candidate marketer:", err);
      res.status(500).json({ message: "Failed to assign marketer to candidate" });
    }
  });
  
  app.delete("/api/candidates/:candidateId/marketers/:marketingPersonId", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.candidateId);
      const marketingPersonId = parseInt(req.params.marketingPersonId);
      
      if (isNaN(candidateId) || isNaN(marketingPersonId)) {
        return res.status(400).json({ message: "Invalid IDs" });
      }
      
      await storage.removeCandidateMarketer(
        candidateId,
        marketingPersonId,
        req.user!.organizationId
      );
      
      res.status(204).end();
    } catch (err) {
      console.error("Error removing candidate marketer:", err);
      res.status(500).json({ message: "Failed to remove marketer from candidate" });
    }
  });
  
  app.get("/api/candidates/:id/marketers", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      if (isNaN(candidateId)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }
      
      const marketers = await storage.getCandidateMarketers(
        candidateId,
        req.user!.organizationId
      );
      
      res.json(marketers);
    } catch (err) {
      console.error("Error getting candidate marketers:", err);
      res.status(500).json({ message: "Failed to get candidate marketers" });
    }
  });
  
  app.get("/api/marketing-persons/:id/candidates/:role", requireAuth, async (req, res) => {
    try {
      const marketingPersonId = parseInt(req.params.id);
      const { role } = req.params;
      
      if (isNaN(marketingPersonId)) {
        return res.status(400).json({ message: "Invalid marketing person ID" });
      }
      
      if (role !== 'primary' && role !== 'backup') {
        return res.status(400).json({ message: "Role must be either 'primary' or 'backup'" });
      }
      
      const candidates = await storage.getCandidatesByMarketer(
        marketingPersonId,
        role,
        req.user!.organizationId
      );
      
      res.json(candidates);
    } catch (err) {
      console.error("Error getting candidates by marketer role:", err);
      res.status(500).json({ message: "Failed to get candidates by marketer role" });
    }
  });

  // Update a candidate's rating
  app.patch("/api/candidates/:id/rating", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      const { rating } = req.body;
      if (typeof rating !== 'number' || rating < 0 || rating > 5) {
        return res.status(400).json({ message: "Rating must be a number between 0 and 5" });
      }
      
      const organizationId = req.user!.organizationId;
      
      // Update the candidate rating
      const updatedCandidate = await storage.updateCandidate(id, { rating }, organizationId);
      res.json(updatedCandidate);
    } catch (error) {
      console.error("Error updating candidate rating:", error);
      res.status(500).json({ message: "Error updating candidate rating" });
    }
  });

  // Update a candidate's status
  app.patch("/api/candidates/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      const { status } = req.body;
      if (typeof status !== 'string' || !["active", "inactive", "new", "contacted", "interviewing", "offer", "hired", "rejected", "on hold"].includes(status)) {
        return res.status(400).json({ 
          message: "Status must be one of: active, inactive, new, contacted, interviewing, offer, hired, rejected, on hold" 
        });
      }
      
      const organizationId = req.user!.organizationId;
      const userId = req.user!.id;
      
      console.log(`Updating candidate ${id} status to "${status}" by user ${userId} in org ${organizationId}`);
      
      // Get the current candidate to track status change
      const currentCandidate = await storage.getCandidate(id, organizationId);
      if (!currentCandidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }
      
      const previousStatus = currentCandidate.status;
      console.log(`Previous status was: "${previousStatus}"`);
      
      // Only create a status change record if the status is actually changing
      if (previousStatus !== status) {
        console.log(`Status is changing from "${previousStatus}" to "${status}"`);
        
        // Create a status change record to track the change
        await storage.recordCandidateStatusChange({
          candidateId: id,
          previousStatus: previousStatus,
          newStatus: status,
          changedAt: new Date(),
          changedBy: userId,
          organizationId
        });
        console.log("Status change record created successfully");
      }
      
      // Update the candidate status with the user ID who made the change
      const statusUpdate = { 
        status,
        changedBy: userId
      };
      
      const updatedCandidate = await storage.updateCandidate(id, statusUpdate, organizationId);
      
      // If the status was changed to "offer", return additional information for celebrating
      if (status === "offer") {
        console.log("Status changed to offer - preparing celebration data");
        
        // Check if this candidate has associated marketers
        const candidateMarketers = await storage.getCandidateMarketers(id, organizationId);
        console.log(`Found ${candidateMarketers.length} marketers for candidate ${id}`);
        
        // If the candidate has marketers, include their information in the response
        if (candidateMarketers && candidateMarketers.length > 0) {
          return res.json({
            ...updatedCandidate,
            marketers: candidateMarketers,
            celebration: true
          });
        }
      }
      
      res.json(updatedCandidate);
    } catch (error) {
      console.error("Error updating candidate status:", error);
      res.status(500).json({ message: "Error updating candidate status" });
    }
  });

  // Update candidate priority
  app.patch("/api/candidates/:id/priority", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }

      const { priority } = req.body;
      if (typeof priority !== 'string' || !["high", "medium", "low"].includes(priority)) {
        return res.status(400).json({ 
          message: "Priority must be one of: high, medium, low" 
        });
      }
      
      const organizationId = req.user!.organizationId;
      
      // Update the candidate priority
      const updatedCandidate = await storage.updateCandidate(id, { priority }, organizationId);
      res.json(updatedCandidate);
    } catch (error) {
      console.error("Error updating candidate priority:", error);
      res.status(500).json({ message: "Error updating candidate priority" });
    }
  });
  
  // Delete a candidate (admin only)
  app.delete("/api/candidates/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid candidate ID" });
      }
      
      // Check if user is an admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: "Only administrators can delete candidates" });
      }
      
      const organizationId = req.user!.organizationId;
      
      // Delete the candidate
      await storage.deleteCandidate(id, organizationId);
      
      res.status(200).json({ message: "Candidate deleted successfully" });
    } catch (error) {
      console.error("Error deleting candidate:", error);
      res.status(500).json({ message: "Failed to delete candidate" });
    }
  });

  // Application routes
  app.get("/api/applications", requireAuth, async (req, res) => {
    const { candidateId, jobId } = req.query;
    const filters = {
      ...(candidateId && { candidateId: parseInt(candidateId as string) }),
      ...(jobId && { jobId: parseInt(jobId as string) }),
      organizationId: req.user!.organizationId
    };
    const applications = await storage.listApplications(filters);
    res.json(applications);
  });

  app.post("/api/applications", requireAuth, async (req, res) => {
    try {
      const data = insertApplicationSchema.parse(req.body);
      const application = await storage.createApplication({...data, organizationId: req.user!.organizationId});
      res.status(201).json(application);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(err.errors);
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/applications/:id/status", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      const application = await storage.updateApplicationStatus(id, status, req.user!.organizationId);
      res.json(application);
    } catch (err) {
      res.status(404).json({ message: "Application not found" });
    }
  });

  // Marketing Person routes
  app.get("/api/marketing-persons", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId){
          return res.status(400).json({ message: "Organization ID is missing" });
      }
      
      // Check if the all parameter is present
      const fetchAll = req.query.all === 'true';
      
      // If all=true, use a large limit to effectively fetch all records
      // Otherwise use normal pagination
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = fetchAll ? 1000 : (req.query.limit ? parseInt(req.query.limit as string) : 10);
      
      const result = await storage.listMarketingPersons(organizationId, page, limit);
      res.json(result);
    } catch (err) {
      console.error('Error fetching marketing persons:', err);
      res.status(500).json({ message: "Failed to fetch marketing persons" });
    }
  });

  app.post("/api/marketing-persons", requireAuth, async (req, res) => {
    try {
      const data = insertMarketingPersonSchema.parse(req.body);
      const marketingPerson = await storage.createMarketingPerson({...data, organizationId: req.user!.organizationId});
      res.status(201).json(marketingPerson);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(err.errors);
      } else {
        res.status(500).json({ message: "Internal server error" });
      }
    }
  });

  app.patch("/api/marketing-persons/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const marketingPerson = await storage.updateMarketingPerson(id, req.body, req.user!.organizationId);
      res.json(marketingPerson);
    } catch (err) {
      res.status(404).json({ message: "Marketing person not found" });
    }
  });

  app.delete("/api/marketing-persons/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteMarketingPerson(id, req.user!.organizationId);
      res.status(200).json({ message: "Marketing person deleted successfully" });
    } catch (err) {
      console.error('Error deleting marketing person:', err);
      
      // Check if it's a foreign key constraint error
      if (err instanceof Error && err.message.includes('foreign key constraint')) {
        return res.status(400).json({ 
          message: "Cannot delete this marketing person because they are still assigned to candidates. Please unassign them first.",
          error: err.message
        });
      }
      
      res.status(500).json({ 
        message: "Failed to delete marketing person", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Potential Consultants routes
  app.get("/api/potential-consultants", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user?.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is missing" });
      }
      
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const tabType = (req.query.tabType as 'potential' | 'onboarding' | 'waitinglist') || 'potential';
      
      // Validate tab type
      if (!['potential', 'onboarding', 'waitinglist'].includes(tabType)) {
        return res.status(400).json({ message: "Invalid tab type. Must be one of: potential, onboarding, waitinglist" });
      }
      
      const result = await storage.listPotentialConsultants(organizationId, page, limit, tabType);
      res.json(result);
    } catch (err) {
      console.error('Error fetching potential consultants:', err);
      res.status(500).json({ 
        message: "Failed to fetch potential consultants", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  app.get("/api/potential-consultants/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is missing" });
      }
      
      const consultant = await storage.getPotentialConsultant(id, organizationId);
      
      if (!consultant) {
        return res.status(404).json({ message: "Potential consultant not found" });
      }
      
      res.json(consultant);
    } catch (err) {
      console.error('Error fetching potential consultant:', err);
      res.status(500).json({ 
        message: "Failed to fetch potential consultant", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  app.post("/api/potential-consultants", requireAuth, async (req, res) => {
    try {
      // Pre-process dates from strings to Date objects if they're strings
      const formData = { 
        ...req.body,
        // Convert date strings to Date objects
        dob: req.body.dob ? new Date(req.body.dob) : undefined,
        availabilityDate: req.body.availabilityDate ? new Date(req.body.availabilityDate) : undefined,
        visaExpiry: req.body.visaExpiry ? new Date(req.body.visaExpiry) : undefined,
      };
      
      const data = insertPotentialConsultantSchema.parse(formData);
      const consultant = await storage.createPotentialConsultant({
        ...data, 
        organizationId: req.user!.organizationId,
        status: data.status || "active",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      res.status(201).json(consultant);
    } catch (err) {
      console.error('Error creating potential consultant:', err);
      if (err instanceof ZodError) {
        res.status(400).json({ 
          message: "Invalid data", 
          errors: err.errors 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to create potential consultant", 
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  });
  
  app.patch("/api/potential-consultants/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      
      // Verify consultant exists
      const existingConsultant = await storage.getPotentialConsultant(id, organizationId);
      if (!existingConsultant) {
        return res.status(404).json({ message: "Potential consultant not found" });
      }
      
      // Process any date fields in the request
      const formData = { 
        ...req.body,
        // Convert date strings to Date objects
        dob: req.body.dob ? new Date(req.body.dob) : undefined,
        availabilityDate: req.body.availabilityDate ? new Date(req.body.availabilityDate) : undefined,
        visaExpiry: req.body.visaExpiry ? new Date(req.body.visaExpiry) : undefined,
      };
      
      // Automatically update status to "completed" if onboardingStage is set to "completed"
      if (formData.onboardingStage === "completed" && !formData.status) {
        formData.status = "completed";
      }
      
      const consultant = await storage.updatePotentialConsultant(id, formData, organizationId);
      res.json(consultant);
    } catch (err) {
      console.error('Error updating potential consultant:', err);
      if (err instanceof ZodError) {
        res.status(400).json({ 
          message: "Invalid data", 
          errors: err.errors 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to update potential consultant", 
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }
  });
  
  // Preview offer letter without sending for potential consultant
  app.post("/api/potential-consultants/:id/preview-offer-letter", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const organizationId = (req.user as User).organizationId;
      const consultantId = parseInt(req.params.id, 10);
      
      if (isNaN(consultantId)) {
        return res.status(400).json({ message: "Invalid consultant ID" });
      }
      
      // Get consultant details
      const consultant = await storage.getPotentialConsultant(consultantId, organizationId);
      if (!consultant) {
        return res.status(404).json({ message: "Consultant not found" });
      }
      
      // Check if we have form data or use existing consultant data
      const {
        offerLetterTitle = consultant.offerLetterTitle,
        offerLetterMode = consultant.offerLetterMode,
        offerLetterModeCustom = consultant.offerLetterModeCustom,
        offerLetterType = consultant.offerLetterType,
        offerLetterTypeCustom = consultant.offerLetterTypeCustom,
        offerLetterStartDate = consultant.offerLetterStartDate,
        offerLetterEndDate = consultant.offerLetterEndDate,
        letterDate
      } = req.body;
      
      // Validate essential details
      if (!offerLetterTitle || !offerLetterMode || !offerLetterType || 
          !offerLetterStartDate || !offerLetterEndDate) {
        return res.status(400).json({ message: "Missing required offer letter details" });
      }
      
      // Format job details
      const mode = offerLetterMode === 'other' && offerLetterModeCustom 
        ? offerLetterModeCustom 
        : offerLetterMode;
        
      const type = offerLetterType === 'other' && offerLetterTypeCustom
        ? offerLetterTypeCustom
        : offerLetterType;
      
      // Create responsibilities
      const responsibilities = `
        - Work on ${offerLetterTitle} projects
        - Collaborate with team members
        - Deliver high-quality code
        - Participate in meetings and discussions
      `;
      
      // Format responsibilities HTML from plain text
      const responsibilitiesHtml = responsibilities
        .split('\n')
        .filter((line: string) => line.trim() !== '')
        .map((line: string) => `<p>${line}</p>`)
        .join('');
      
      // Format letter date
      const formattedLetterDate = letterDate 
        ? new Date(letterDate).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
      
      // Format start and end dates
      const startDate = new Date(offerLetterStartDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const endDate = new Date(offerLetterEndDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Generate the offer letter HTML
      const offerLetterHtml = await generateOfferLetterPreview({
        candidate: {
          name: consultant.name,
          email: consultant.email || ''
        },
        jobDetails: {
          title: offerLetterTitle,
          type: type,
          mode: mode
        },
        responsibilitiesHtml,
        letterDate: formattedLetterDate,
        startDate,
        endDate
      });
      
      res.status(200).json({ 
        html: offerLetterHtml,
        consultantName: consultant.name,
        email: consultant.email
      });
    } catch (error) {
      console.error("Error generating offer letter preview:", error);
      res.status(500).json({ 
        message: "Failed to generate offer letter preview",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Send offer letter to potential consultant
  app.post("/api/potential-consultants/:id/send-offer-letter", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as User).id;
      const organizationId = (req.user as User).organizationId;
      const consultantId = parseInt(req.params.id, 10);
      
      if (isNaN(consultantId)) {
        return res.status(400).json({ message: "Invalid consultant ID" });
      }
      
      // Get consultant details
      const consultant = await storage.getPotentialConsultant(consultantId, organizationId);
      if (!consultant) {
        return res.status(404).json({ message: "Consultant not found" });
      }
      
      // Check consultant has email
      if (!consultant.email) {
        return res.status(400).json({ message: "Consultant has no email address" });
      }
      
      // Verify onboarding stage is appropriate for offer letter
      if (consultant.onboardingStage !== "offer letter released" && 
          consultant.onboardingStage !== "contract sent" && 
          consultant.onboardingStage !== "received i20 and signed contract" && 
          consultant.onboardingStage !== "completed") {
        return res.status(400).json({ 
          message: "Consultant must be in the appropriate onboarding stage to receive an offer letter"
        });
      }
      
      // Ensure required offer letter fields are present
      if (!consultant.offerLetterTitle || !consultant.offerLetterMode || 
          !consultant.offerLetterType || !consultant.offerLetterStartDate || !consultant.offerLetterEndDate) {
        return res.status(400).json({ message: "Consultant is missing required offer letter details" });
      }
      
      // Format job details from consultant record
      const mode = consultant.offerLetterMode === 'other' && consultant.offerLetterModeCustom 
        ? consultant.offerLetterModeCustom 
        : consultant.offerLetterMode;
        
      const type = consultant.offerLetterType === 'other' && consultant.offerLetterTypeCustom
        ? consultant.offerLetterTypeCustom
        : consultant.offerLetterType;
      
      // Create dummy responsibilities (can be improved with actual data)
      const responsibilities = `
        - Work on ${consultant.offerLetterTitle} projects
        - Collaborate with team members
        - Deliver high-quality code
        - Participate in meetings and discussions
      `;
      
      // Format responsibilities HTML from plain text (convert line breaks to paragraphs)
      const responsibilitiesHtml = responsibilities
        .split('\n')
        .filter((line: string) => line.trim() !== '')
        .map((line: string) => `<p>${line}</p>`)
        .join('');
      
      // Create a formatted date string for letter date (today)
      const letterDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      
      // Format start and end dates
      const startDate = new Date(consultant.offerLetterStartDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const endDate = new Date(consultant.offerLetterEndDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // Send the offer letter
      const emailSent = await sendOfferLetter({
        candidate: {
          name: consultant.name,
          email: consultant.email
        },
        jobDetails: {
          title: consultant.offerLetterTitle,
          type: type,
          mode: mode
        },
        responsibilitiesHtml,
        letterDate,
        startDate,
        endDate
      });
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send offer letter" });
      }
      
      res.status(200).json({ 
        message: "Offer letter has been sent successfully",
        email: consultant.email
      });
    } catch (error) {
      console.error("Error sending offer letter:", error);
      res.status(500).json({ 
        message: "Failed to send offer letter",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  app.delete("/api/potential-consultants/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePotentialConsultant(id, req.user!.organizationId);
      res.status(200).json({ message: "Potential consultant deleted successfully" });
    } catch (err) {
      console.error('Error deleting potential consultant:', err);
      res.status(500).json({ 
        message: "Failed to delete potential consultant", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  app.post("/api/potential-consultants/:id/assign", requireAuth, requireAdmin, async (req, res) => {
    try {
      const consultantId = parseInt(req.params.id);
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }
      
      const consultant = await storage.assignConsultantToUser(consultantId, userId, req.user!.organizationId);
      res.json(consultant);
    } catch (err) {
      console.error('Error assigning potential consultant:', err);
      res.status(500).json({ 
        message: "Failed to assign potential consultant", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  app.post("/api/potential-consultants/:id/send-interest-email", requireAuth, async (req, res) => {
    try {
      const consultantId = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      
      // Get the potential consultant's details
      const consultant = await storage.getPotentialConsultant(consultantId, organizationId);
      if (!consultant) {
        return res.status(404).json({ message: "Potential consultant not found" });
      }
      
      // Get organization name for the email
      const organization = await storage.getOrganization(organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      // Send the interest email
      const emailSent = await sendInterestLink(
        consultant.name, 
        consultant.email, 
        organizationId,
        organization.name
      );
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send email" });
      }
      
      // Update the consultant record to track that an email was sent
      await storage.updatePotentialConsultant(
        consultantId, 
        {
          contactAttempts: (consultant.contactAttempts || 0) + 1,
          lastContactedAt: new Date(),
          status: "contacted"
        },
        organizationId
      );
      
      res.json({ 
        message: "Interest email sent successfully",
        consultant
      });
    } catch (err) {
      console.error('Error sending interest email:', err);
      res.status(500).json({ 
        message: "Failed to send interest email", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Endpoint for sending interest emails to new potential consultants
  app.post("/api/send-external-interest-email", requireAuth, async (req, res) => {
    try {
      const { name, email } = req.body;
      
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      const organizationId = req.user!.organizationId;
      const organization = await storage.getOrganization(organizationId);
      
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      // Create a new potential consultant record
      const consultant = await storage.createPotentialConsultant({
        name,
        email,
        phone: "",
        status: "external invite sent",
        organizationId,
        contactAttempts: 1,
        interestLevel: "medium",
        skills: "",
        yearsOfExperience: 0
      });
      
      // Send the interest email
      const emailSent = await sendInterestLink(
        name, 
        email, 
        organizationId,
        organization.name
      );
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send email" });
      }
      
      res.json({ 
        message: "Interest email sent successfully to new potential consultant",
        consultant
      });
    } catch (err) {
      console.error('Error sending external interest email:', err);
      res.status(500).json({ 
        message: "Failed to send interest email", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });
  
  // Send invitation email to a new external contact
  app.post("/api/send-external-interest-email", requireAuth, async (req, res) => {
    try {
      const { name, email } = req.body;
      const organizationId = req.user!.organizationId;
      
      // Validate input
      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      
      if (!email.includes('@')) {
        return res.status(400).json({ message: "Invalid email format" });
      }
      
      // Check if this email already exists in the potential consultants
      const existingConsultant = await storage.findPotentialConsultantByEmail(email, organizationId);
      if (existingConsultant) {
        // If it exists, just send a new email
        const organization = await storage.getOrganization(organizationId);
        if (!organization) {
          return res.status(404).json({ message: "Organization not found" });
        }
        
        const emailSent = await sendInterestLink(
          existingConsultant.name,
          existingConsultant.email,
          organizationId,
          organization.name
        );
        
        if (!emailSent) {
          return res.status(500).json({ message: "Failed to send email" });
        }
        
        // Update the consultant record to track that an email was sent
        await storage.updatePotentialConsultant(
          existingConsultant.id,
          {
            contactAttempts: (existingConsultant.contactAttempts || 0) + 1,
            lastContactedAt: new Date(),
            status: "external invite sent"
          },
          organizationId
        );
        
        return res.json({
          message: "Interest email sent successfully to existing contact",
          consultant: existingConsultant
        });
      }
      
      // Create a new potential consultant record
      const newConsultant = await storage.createPotentialConsultant({
        name,
        email,
        phone: "", // No phone provided yet
        skills: "", // No skills provided yet
        yearsOfExperience: 0,
        status: "external invite sent",
        contactAttempts: 1,
        lastContactedAt: new Date(),
        interestLevel: "medium", // Default interest level
        organizationId
      });
      
      // Get organization name for the email
      const organization = await storage.getOrganization(organizationId);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      
      // Send the interest email
      const emailSent = await sendInterestLink(
        name,
        email,
        organizationId,
        organization.name
      );
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send email" });
      }
      
      res.json({
        message: "Interest email sent successfully to new contact",
        consultant: newConsultant
      });
      
    } catch (err) {
      console.error('Error sending external interest email:', err);
      res.status(500).json({ message: "Failed to send external interest email" });
    }
  });

  // Move consultant to candidates list
  // Upload resume for potential consultant
  app.post("/api/potential-consultants/:id/resume", requireAuth, upload.single('resume'), async (req, res) => {
    try {
      const consultantId = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      
      // Verify consultant exists
      const consultant = await storage.getPotentialConsultant(consultantId, organizationId);
      if (!consultant) {
        return res.status(404).json({ message: "Potential consultant not found" });
      }
      
      // Make sure a file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "Resume file is required" });
      }
      
      // Determine mime type
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const mimeType = fileExtension === '.pdf' ? 'application/pdf' : 'application/msword';
      
      // Store the resume URL and format
      const resumeUrl = `/uploads/${req.file.filename}`;
      
      // Update the consultant with resume information
      const updatedConsultant = await storage.updatePotentialConsultant(
        consultantId, 
        { 
          resumeUrl: resumeUrl, 
          resumeFormat: fileExtension,
          hasResume: true 
        }, 
        organizationId
      );
      
      // Try to parse the resume (optional)
      try {
        const resumeData = await parseResume(req.file.path, mimeType);
        
        // If we have skills from the resume and the consultant has no skills, update them
        if (resumeData.skills?.technical?.length && !consultant.skills) {
          const skills = resumeData.skills.technical.join(', ');
          await storage.updatePotentialConsultant(
            consultantId,
            { skills },
            organizationId
          );
        }
      } catch (parseError) {
        console.error('Error parsing consultant resume:', parseError);
        // Continue even if parsing fails - the file is still uploaded
      }
      
      res.status(200).json({ 
        message: "Resume uploaded successfully", 
        resumeUrl: resumeUrl
      });
    } catch (err) {
      console.error("Error uploading resume for consultant:", err);
      res.status(500).json({ message: "Failed to upload resume" });
    }
  });

  app.post("/api/potential-consultants/:id/move-to-candidate", requireAuth, async (req, res) => {
    try {
      const consultantId = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      const { status = "active" } = req.body; // Get status from request, defaulting to "active"
      
      // Verify consultant exists
      const consultant = await storage.getPotentialConsultant(consultantId, organizationId);
      if (!consultant) {
        return res.status(404).json({ message: "Potential consultant not found" });
      }
      
      // Verify all required verifications are completed
      if (!consultant.hasAllDetailsReceived || 
          !consultant.hasLinkedin || 
          !consultant.hasEmailAndPhoneCreated ||
          !consultant.hasResume ||
          !consultant.hasOfferLetter ||
          !consultant.hasContract) {
        return res.status(400).json({ 
          message: "Cannot move to candidates. All verifications must be completed first."
        });
      }
      
      // Create a candidate from the consultant
      const candidate = await storage.createCandidate({
        name: consultant.name,
        email: consultant.email,
        phone: consultant.phone,
        skills: consultant.skills,
        organizationId: organizationId,
        visaType: consultant.visaStatus || null,
        location: consultant.location || null,
        yearsOfExperience: consultant.yearsOfExperience || 0,
        resumeUrl: consultant.resumeUrl || null,
        resumeFormat: consultant.resumeFormat || null,
        status: status, // Use the status from request body, defaulting to "active"
        priority: "medium"
      });
      
      // Update the consultant status to moved
      await storage.updatePotentialConsultant(consultantId, { 
        status: "moved to candidate" 
      }, organizationId);
      
      res.json({ 
        message: "Successfully moved to candidates", 
        consultant, 
        candidate
      });
    } catch (err) {
      console.error('Error moving consultant to candidates:', err);
      res.status(500).json({ 
        message: "Failed to move consultant to candidates", 
        error: err instanceof Error ? err.message : String(err)
      });
    }
  });

  app.get("/api/marketing-persons/:id/candidates", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const candidates = await storage.getAssignedCandidates(id, req.user!.organizationId);
      res.json(candidates);
    } catch (err) {
      console.error('Error fetching assigned candidates:', err);
      res.status(500).json({ message: "Failed to fetch assigned candidates" });
    }
  });

  app.get("/api/marketing-persons/:id/candidates-count", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid marketing person ID" });
      }
      
      // The role parameter can be 'primary', 'backup', or 'all'
      const role = req.query.role as string || 'primary';
      
      // Validate the role parameter
      if (role !== 'primary' && role !== 'backup' && role !== 'all') {
        return res.status(400).json({ message: "Role must be either 'primary', 'backup', or 'all'" });
      }
      
      // Handle the role parameter
      if (role === 'all') {
        // For 'all' role, get the total assignments count
        const count = await storage.getAssignedCandidatesCount(id, req.user!.organizationId);
        return res.json({ count });
      } else {
        // Get candidates with the specific role
        const candidates = await storage.getCandidatesByMarketer(id, role, req.user!.organizationId);
        return res.json({ count: candidates.length });
      }
    } catch (err) {
      console.error('Error fetching assigned candidates count:', err);
      res.status(500).json({ message: "Failed to fetch assigned candidates count" });
    }
  });

  // Add new route for marketing metrics with optimized batch processing
  app.get("/api/marketing-persons/metrics", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      // Get all marketing persons without pagination
      const result = await storage.listMarketingPersons(organizationId, 1, 1000);
      const marketingPersons = result.marketingPersons;
      
      if (!marketingPersons || marketingPersons.length === 0) {
        return res.json({});
      }
      
      // Get all candidates with assignments in one query
      const allAssignedCandidates = await storage.getAllMarketersAssignedCandidates(organizationId);
      
      // Process the results to create metrics for each marketing person
      const metrics = {};
      
      for (const person of marketingPersons) {
        // Filter candidates for current marketer
        const personCandidates = allAssignedCandidates.filter(
          c => c.marketingPersonId === person.id || 
               c.candidateMarketers?.some(cm => cm.marketingPersonId === person.id)
        );
        
        const totalAssignments = personCandidates.length;
        const activeAssignments = personCandidates.filter(c => c.status === 'active').length;
        const conversionRate = totalAssignments > 0 ? (activeAssignments / totalAssignments) * 100 : 0;
        
        // For now, we'll use a placeholder for response time
        const responseTime = 24; // placeholder 24 hours
        
        metrics[person.id] = {
          totalAssignments,
          activeAssignments,
          conversionRate,
          responseTime
        };
      }

      res.json(metrics);
    } catch (err) {
      console.error('Error fetching marketing metrics:', err);
      res.status(500).json({ message: "Failed to fetch marketing metrics" });
    }
  });
  
  // API endpoint to toggle a marketing person's leave status
  app.patch("/api/marketing-persons/:id/leave-status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { onLeave, backupMarketerId } = req.body;
      
      if (typeof onLeave !== 'boolean') {
        return res.status(400).json({ message: "onLeave status must be a boolean" });
      }
      
      // Get the marketing person's organization for permission checking
      const marketer = await storage.getMarketingPerson(parseInt(id), req.user!.organizationId);
      if (!marketer) {
        return res.status(404).json({ message: "Marketing person not found" });
      }
      
      // Check that the user has permission to update this marketing person
      if (marketer.organizationId !== req.user!.organizationId) {
        return res.status(403).json({ message: "You don't have permission to update this marketing person" });
      }
      
      // If setting to on leave, a backup is required
      if (onLeave && !backupMarketerId) {
        return res.status(400).json({ message: "A backup marketer must be assigned when going on leave" });
      }
      
      // If a backup is specified, make sure it exists and isn't the same person
      if (backupMarketerId) {
        if (parseInt(id) === backupMarketerId) {
          return res.status(400).json({ message: "A marketer cannot be their own backup" });
        }
        
        const backup = await storage.getMarketingPerson(backupMarketerId, req.user!.organizationId);
        if (!backup) {
          return res.status(404).json({ message: "Backup marketing person not found" });
        }
        
        // Check that the backup isn't on leave
        if (backup.onLeave) {
          return res.status(400).json({ message: "Cannot assign a marketer who is on leave as a backup" });
        }
      }
      
      // Update the marketer's leave status and backup
      const updated = await storage.updateMarketingPerson(
        parseInt(id), 
        { 
          onLeave,
          backupMarketerId: onLeave ? backupMarketerId : null
        }, 
        req.user!.organizationId
      );
      
      return res.json(updated);
    } catch (error) {
      console.error("Error updating marketer leave status:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Add new route for resume analysis with a job ID
  app.post("/api/candidates/:id/analyze", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const { jobId } = req.body;

      // Get candidate details including resume
      const candidate = await storage.getCandidate(candidateId, req.user!.organizationId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Get job details
      const job = await storage.getJob(jobId, req.user!.organizationId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Extract resume text from resumeData
      const resumeText = [
        ...candidate.resumeData.experience.map(exp =>
          `${exp.position} at ${exp.company}\n${exp.responsibilities.join('\n')}`
        ),
        ...candidate.resumeData.education.map(edu =>
          `${edu.degree} from ${edu.institution} (${edu.year})`
        ),
        candidate.resumeData.skills.technical.join(', '),
        candidate.resumeData.skills.soft.join(', ')
      ].join('\n\n');

      // Analyze resume
      const analysis = await analyzeResume(resumeText, job.description);

      res.json(analysis);
    } catch (error) {
      console.error('Resume analysis error:', error);
      res.status(500).json({
        message: "Failed to analyze resume",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Add new route for analyzing candidate with custom JD
  app.post("/api/candidates/:id/analyze-custom", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const { customJd } = req.body;
      
      if (!customJd || customJd.trim() === '') {
        return res.status(400).json({ message: "Custom job description is required" });
      }

      // Get candidate details including resume
      const candidate = await storage.getCandidate(candidateId, req.user!.organizationId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      // Check if the candidate has resume data
      if (!candidate.resumeData || !candidate.resumeData.experience) {
        return res.status(400).json({ message: "Candidate does not have resume data" });
      }

      // Extract resume text from resumeData
      const resumeText = [
        ...candidate.resumeData.experience.map(exp =>
          `${exp.position} at ${exp.company}\n${exp.responsibilities.join('\n')}`
        ),
        ...candidate.resumeData.education.map(edu =>
          `${edu.degree} from ${edu.institution} (${edu.year})`
        ),
        candidate.resumeData.skills.technical.join(', '),
        candidate.resumeData.skills.soft.join(', ')
      ].join('\n\n');

      // Analyze resume with custom JD
      const analysis = await analyzeResume(resumeText, customJd);

      res.json(analysis);
    } catch (error) {
      console.error('Custom JD analysis error:', error);
      res.status(500).json({
        message: "Failed to analyze resume with custom job description",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add route for generating improved content
  app.post("/api/candidates/:id/improve-section", requireAuth, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const { jobId, section, currentContent } = req.body;

      // Get job details
      const job = await storage.getJob(jobId, req.user!.organizationId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const improvedContent = await generateImprovedContent(
        section,
        currentContent,
        job.description
      );

      res.json({ improvedContent });
    } catch (error) {
      console.error('Content improvement error:', error);
      res.status(500).json({
        message: "Failed to improve content",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add this route for analyzing resumes for a job
  app.post("/api/jobs/:id/analyze-candidates", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.id);
      const { candidateIds } = req.body;

      // Get job details
      const job = await storage.getJob(jobId, req.user!.organizationId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const results = {};

      // Analyze each candidate
      for (const candidateId of candidateIds) {
        try {
          // Check cache first
          let analysis = await storage.getCachedAnalysis(candidateId, jobId);

          if (!analysis) {
            // Get candidate details
            const candidate = await storage.getCandidate(candidateId, req.user!.organizationId);
            if (!candidate) {
              console.error(`Candidate not found: ${candidateId}`);
              results[candidateId] = { error: "Candidate not found" };
              continue;
            }

            // Extract resume text from resumeData
            const resumeText = [
              ...(candidate.resumeData.experience || []).map(exp =>
                `${exp.position} at ${exp.company}\n${exp.responsibilities.join('\n')}`
              ),
              ...(candidate.resumeData.education || []).map(edu =>
                `${edu.degree} from ${edu.institution} (${edu.year})`
              ),
              (candidate.resumeData.skills?.technical || []).join(', '),
              (candidate.resumeData.skills?.soft || []).join(', ')
            ].join('\n\n');

            // Analyze resume
            const analysisResult = await analyzeResume(resumeText, job.description);

            // Cache the analysis
            analysis = await storage.cacheAnalysis({
              candidateId,
              jobId,
              analysis: analysisResult,
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
              organizationId: req.user!.organizationId
            });
          }

          results[candidateId] = analysis;
        } catch (error) {
          console.error(`Error analyzing candidate ${candidateId}:`, error);
          results[candidateId] = { error: "Analysis failed" };
        }
      }

      res.json(results);
    } catch (error) {
      console.error('Resume analysis error:', error);
      res.status(500).json({
        message: "Failed to analyze resumes",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add route for generating improved content
  app.post("/api/jobs/:jobId/improve-candidate-section", requireAuth, async (req, res) => {
    try {
      const jobId = parseInt(req.params.jobId);
      const { candidateId, section, currentContent } = req.body;

      // Get job details
      const job = await storage.getJob(jobId, req.user!.organizationId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const improvedContent = await generateImprovedContent(
        section,
        currentContent,
        job.description
      );

      // Invalidate cached analysis since the content has been improved
      await storage.invalidateAnalysis(candidateId, jobId);

      res.json({ improvedContent });
    } catch (error) {
      console.error('Content improvement error:', error);
      res.status(500).json({
        message: "Failed to improve content",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Reprocess a candidate's resume (POST /api/candidates/:id/reprocess)
  app.post('/api/candidates/:id/reprocess', requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user?.organizationId;
      const useAI = req.body.useAI === true; // Check if AI-enhanced parsing is requested
      
      if (!organizationId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const candidate = await storage.getCandidate(id, organizationId);
      
      if (!candidate) {
        return res.status(404).json({ message: 'Candidate not found' });
      }
      
      if (!candidate.resumeUrl) {
        return res.status(400).json({ message: 'Candidate does not have a resume to reprocess' });
      }
      
      // Get the full path to the resume file
      // Remove leading slash if present for correct path joining
      const cleanPath = candidate.resumeUrl.startsWith('/') ? candidate.resumeUrl.substring(1) : candidate.resumeUrl;
      const resumePath = path.join(process.cwd(), cleanPath);
      console.log(`Resume path: ${resumePath}`); // Debug log
      
      // Determine the file type based on the stored resumeFormat
      const fileType = candidate.resumeFormat === '.pdf' ? 'application/pdf' : 
                      (candidate.resumeFormat === '.docx' || candidate.resumeFormat === '.doc') ? 
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain';
      
      console.log(`Reprocessing resume: ${resumePath} with type ${fileType}`);
      
      if (!fs.existsSync(resumePath)) {
        return res.status(404).json({ message: 'Resume file not found' });
      }
      
      // Parse the resume with AI enhancement if requested
      const resumeData = await parseResume(resumePath, fileType, useAI);
      console.log(`Resume reprocessed successfully${useAI ? ' with AI assistance' : ''}`);
      
      // Update the candidate with the new resume data
      const updatedCandidate = await storage.updateCandidate(id, { 
        resumeData: resumeData 
      }, organizationId);
      
      res.json(updatedCandidate);
    } catch (error) {
      console.error('Error reprocessing resume:', error);
      res.status(500).json({ message: 'Error reprocessing resume' });
    }
  });

  // Interview Slots endpoints
  
  /**
   * Helper function to transform date objects to proper ISO strings
   * Addresses an issue where some DB drivers return date objects as empty objects {} instead of strings
   */
  function transformDates(obj: any): any {
    if (!obj) return obj;
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => transformDates(item));
    }
    
    // Handle objects
    if (typeof obj === 'object' && obj !== null) {
      // Create a new object to avoid mutating the original
      const transformed: any = {};
      
      for (const key in obj) {
        if (key === 'timeFrom' || key === 'timeTo' || key === 'createdAt' || key === 'updatedAt') {
          // Check if it's an empty object that should be a date
          if (typeof obj[key] === 'object' && Object.keys(obj[key]).length === 0) {
            // Keep the original value instead of using current time
            transformed[key] = null;
            console.warn(`Found empty date object for key ${key}, preserving as null`);
          } else if (obj[key] instanceof Date) {
            // Convert Date objects to ISO strings
            transformed[key] = obj[key].toISOString();
          } else if (typeof obj[key] === 'string') {
            // Keep date strings as they are
            transformed[key] = obj[key];
          } else {
            // Preserve the original value instead of using fallback
            transformed[key] = obj[key];
            console.warn(`Unexpected type for date field ${key}: ${typeof obj[key]}`);
          }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          // Recursively transform nested objects
          transformed[key] = transformDates(obj[key]);
        } else {
          // Keep other properties as they are
          transformed[key] = obj[key];
        }
      }
      return transformed;
    }
    
    // Return non-object values as they are
    return obj;
  }

  // Get all interview slots with filtering and pagination
  app.get("/api/interview-slots", requireAuth, async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Parse filter parameters
      const filters: any = {};
      
      if (req.query.candidateId) {
        filters.candidateId = parseInt(req.query.candidateId as string);
      }
      
      if (req.query.marketingPersonId) {
        filters.marketingPersonId = parseInt(req.query.marketingPersonId as string);
      }
      
      if (req.query.techStack) {
        filters.techStack = req.query.techStack as string;
      }
      
      if (req.query.fromDate) {
        // Use the date exactly as provided by the client
        const fromDate = new Date(req.query.fromDate as string);
        filters.fromDate = fromDate;
        console.log(`Using fromDate: ${fromDate.toISOString()}`);
      }
      
      if (req.query.toDate) {
        // Use the date exactly as provided by the client
        const toDate = new Date(req.query.toDate as string);
        filters.toDate = toDate;
        console.log(`Using toDate: ${toDate.toISOString()}`);
      }
      
      const result = await storage.listInterviewSlots(organizationId, filters, page, limit);
      
      // Transform date objects before sending the response
      const transformedResult = transformDates(result);
      console.log("Transformed interview slots with proper date strings");
      
      res.json(transformedResult);
    } catch (error) {
      console.error('Error fetching interview slots:', error);
      res.status(500).json({ 
        message: "Failed to fetch interview slots", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get a specific interview slot by ID
  app.get("/api/interview-slots/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid interview slot ID" });
      }
      
      const slot = await storage.getInterviewSlot(id, organizationId);
      
      if (!slot) {
        return res.status(404).json({ message: "Interview slot not found" });
      }
      
      // Transform date objects before sending the response
      const transformedSlot = transformDates(slot);
      console.log("Transformed individual interview slot with proper date strings");
      
      res.json(transformedSlot);
    } catch (error) {
      console.error('Error fetching interview slot:', error);
      res.status(500).json({ 
        message: "Failed to fetch interview slot", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Create a new interview slot
  app.post("/api/interview-slots", requireAuth, async (req, res) => {
    try {
      // Parse date strings to Date objects
      const formData = { ...req.body };
      
      console.log("Form data received:", formData);
      
      // Ensure proper UTC date handling
      if (formData.timeFrom) {
        if (typeof formData.timeFrom === 'string') {
          // Create a proper UTC date object
          const timeFromDate = new Date(formData.timeFrom);
          formData.timeFrom = new Date(
            Date.UTC(
              timeFromDate.getUTCFullYear(),
              timeFromDate.getUTCMonth(),
              timeFromDate.getUTCDate(),
              timeFromDate.getUTCHours(),
              timeFromDate.getUTCMinutes(),
              timeFromDate.getUTCSeconds()
            )
          );
        } else if (formData.timeFrom instanceof Date) {
          // Ensure the date is in UTC
          formData.timeFrom = new Date(formData.timeFrom.toISOString());
        }
      }
      
      if (formData.timeTo) {
        if (typeof formData.timeTo === 'string') {
          // Create a proper UTC date object
          const timeToDate = new Date(formData.timeTo);
          formData.timeTo = new Date(
            Date.UTC(
              timeToDate.getUTCFullYear(), 
              timeToDate.getUTCMonth(),
              timeToDate.getUTCDate(),
              timeToDate.getUTCHours(),
              timeToDate.getUTCMinutes(),
              timeToDate.getUTCSeconds()
            )
          );
        } else if (formData.timeTo instanceof Date) {
          // Ensure the date is in UTC
          formData.timeTo = new Date(formData.timeTo.toISOString());
        }
      }
      
      // Ensure candidateId and marketingPersonId are numbers or null
      if (formData.candidateId === null || formData.candidateId === "none" || formData.candidateId === "") {
        formData.candidateId = null;
      } else if (typeof formData.candidateId === 'string') {
        formData.candidateId = parseInt(formData.candidateId);
      }
      
      if (formData.marketingPersonId === null || formData.marketingPersonId === "none" || formData.marketingPersonId === "") {
        formData.marketingPersonId = null;
      } else if (typeof formData.marketingPersonId === 'string') {
        formData.marketingPersonId = parseInt(formData.marketingPersonId);
      }
      
      // Process "other" tech stack
      if (formData.techStack !== "other") {
        formData.otherStack = null;
      }
      
      // Set default values for missing fields
      if (!formData.calendarInvite) {
        formData.calendarInvite = "No";
      }
      
      // Ensure the rest of the fields are at least empty strings if they're undefined
      formData.result = formData.result || "";
      formData.otherComment = formData.otherComment || "";
      formData.pvName = formData.pvName || "";
      formData.vendorName = formData.vendorName || "";
      formData.panelEmailId = formData.panelEmailId || "";
      
      const slotData = {
        ...formData,
        organizationId: req.user!.organizationId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log("Processed slot data:", slotData);
      
      const newSlot = await storage.createInterviewSlot(slotData);
      
      // Transform date objects before sending the response
      const transformedSlot = transformDates(newSlot);
      console.log("Transformed new interview slot with proper date strings");
      
      res.status(201).json(transformedSlot);
    } catch (error) {
      console.error('Error creating interview slot:', error);
      
      if (error instanceof ZodError) {
        res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to create interview slot", 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
  
  // Update an existing interview slot
  app.patch("/api/interview-slots/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid interview slot ID" });
      }
      
      // Verify slot exists
      const existingSlot = await storage.getInterviewSlot(id, organizationId);
      if (!existingSlot) {
        return res.status(404).json({ message: "Interview slot not found" });
      }
      
      // Process date fields in the request
      const formData = { ...req.body };
      
      console.log("Update form data received:", formData);
      
      // Ensure proper UTC date handling
      if (formData.timeFrom) {
        if (typeof formData.timeFrom === 'string') {
          // Create a proper UTC date object
          const timeFromDate = new Date(formData.timeFrom);
          formData.timeFrom = new Date(
            Date.UTC(
              timeFromDate.getUTCFullYear(),
              timeFromDate.getUTCMonth(),
              timeFromDate.getUTCDate(),
              timeFromDate.getUTCHours(),
              timeFromDate.getUTCMinutes(),
              timeFromDate.getUTCSeconds()
            )
          );
        } else if (formData.timeFrom instanceof Date) {
          // Ensure the date is in UTC
          formData.timeFrom = new Date(formData.timeFrom.toISOString());
        }
      }
      
      if (formData.timeTo) {
        if (typeof formData.timeTo === 'string') {
          // Create a proper UTC date object
          const timeToDate = new Date(formData.timeTo);
          formData.timeTo = new Date(
            Date.UTC(
              timeToDate.getUTCFullYear(), 
              timeToDate.getUTCMonth(),
              timeToDate.getUTCDate(),
              timeToDate.getUTCHours(),
              timeToDate.getUTCMinutes(),
              timeToDate.getUTCSeconds()
            )
          );
        } else if (formData.timeTo instanceof Date) {
          // Ensure the date is in UTC
          formData.timeTo = new Date(formData.timeTo.toISOString());
        }
      }
      
      // Ensure candidateId and marketingPersonId are numbers or null
      if (formData.candidateId === null || formData.candidateId === "none" || formData.candidateId === "") {
        formData.candidateId = null;
      } else if (typeof formData.candidateId === 'string') {
        formData.candidateId = parseInt(formData.candidateId);
      }
      
      if (formData.marketingPersonId === null || formData.marketingPersonId === "none" || formData.marketingPersonId === "") {
        formData.marketingPersonId = null;
      } else if (typeof formData.marketingPersonId === 'string') {
        formData.marketingPersonId = parseInt(formData.marketingPersonId);
      }
      
      // Process "other" tech stack
      if (formData.techStack !== "other") {
        formData.otherStack = null;
      }
      
      // Add updatedAt timestamp
      formData.updatedAt = new Date();
      
      console.log("Processed update data:", formData);
      
      const updatedSlot = await storage.updateInterviewSlot(id, formData, organizationId);
      
      // Transform date objects before sending the response
      const transformedSlot = transformDates(updatedSlot);
      console.log("Transformed updated interview slot with proper date strings");
      
      res.json(transformedSlot);
    } catch (error) {
      console.error('Error updating interview slot:', error);
      
      if (error instanceof ZodError) {
        res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to update interview slot", 
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });
  
  // Delete an interview slot
  // Special endpoint to update ONLY the calendar invite field
  app.patch("/api/interview-slots/:id/calendar-invite", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      const { calendarInvite } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid interview slot ID" });
      }
      
      // Validate input
      if (!calendarInvite || (calendarInvite !== "Yes" && calendarInvite !== "No")) {
        return res.status(400).json({ message: "Invalid calendar invite value" });
      }
      
      // Get the existing slot to check if it exists and user has access
      const existingSlot = await storage.getInterviewSlot(id, organizationId);
      if (!existingSlot) {
        return res.status(404).json({ message: "Interview slot not found" });
      }
      
      // Update ONLY the calendar invite field
      const updatedSlot = await storage.updateInterviewSlot(id, { calendarInvite }, organizationId);
      
      // Transform date objects before sending the response
      const transformedSlot = transformDates(updatedSlot);
      console.log("Transformed calendar invite update with proper date strings");
      
      res.json(transformedSlot);
    } catch (error) {
      console.error("Error updating calendar invite:", error);
      res.status(500).json({ message: "Failed to update calendar invite" });
    }
  });
  
  // Delete an interview slot
  app.delete("/api/interview-slots/:id", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const organizationId = req.user!.organizationId;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid interview slot ID" });
      }
      
      // Verify slot exists
      const existingSlot = await storage.getInterviewSlot(id, organizationId);
      if (!existingSlot) {
        return res.status(404).json({ message: "Interview slot not found" });
      }
      
      await storage.deleteInterviewSlot(id, organizationId);
      res.status(200).json({ message: "Interview slot deleted successfully" });
    } catch (error) {
      console.error('Error deleting interview slot:', error);
      res.status(500).json({ 
        message: "Failed to delete interview slot", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get successful marketers (those with candidates who received offers in the last 48 hours)
  app.get("/api/successful-marketers", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const organizationId = req.user!.organizationId;
      
      console.log("Successful marketers request from user ID:", userId, "Organization:", organizationId);
      
      // Look back 2 days (48 hours) for status changes to "offer"
      const daysToLookBack = 2;
      const lookbackDate = new Date();
      lookbackDate.setDate(lookbackDate.getDate() - daysToLookBack);
      
      console.log("Looking back days:", daysToLookBack);
      console.log("Looking for offer status changes since:", lookbackDate.toISOString());
      
      const statusChanges = await storage.getRecentOfferStatusChanges(organizationId, daysToLookBack);
      console.log("Found status changes:", statusChanges.length);
      
      if (!statusChanges || statusChanges.length === 0) {
        return res.json({ successfulMarketers: [] });
      }
      
      // Get all unique candidate IDs that have received offers
      const candidateIds = [...new Set(statusChanges.map(change => change.candidateId))];
      
      // Track successful marketers
      const successfulMarketers = new Set<number>();
      
      // For each candidate, find their marketers
      for (const candidateId of candidateIds) {
        const candidateMarketers = await storage.getCandidateMarketers(
          candidateId,
          organizationId
        );
        
        if (candidateMarketers && candidateMarketers.length > 0) {
          // Add all marketers for this candidate to our set
          candidateMarketers.forEach(marketer => {
            successfulMarketers.add(marketer.marketingPersonId);
          });
        }
      }
      
      console.log("Successful marketers found:", Array.from(successfulMarketers));
      res.json({ successfulMarketers: Array.from(successfulMarketers) });
    } catch (error) {
      console.error("Error fetching successful marketers:", error);
      res.status(500).json({ message: "Error fetching successful marketers" });
    }
  });

  // AI Contextual Help Endpoints
  app.post("/api/ai-help/contextual", requireAuth, async (req, res) => {
    try {
      const { feature, context, question, userRole } = req.body;
      
      if (!feature || !question) {
        return res.status(400).json({ 
          success: false, 
          message: "Feature name and question are required" 
        });
      }
      
      // Get contextual help from OpenAI
      const { getContextualHelp } = await import('./services/openai');
      const helpText = await getContextualHelp({
        feature,
        context,
        question,
        userRole: userRole || req.user?.role
      });
      
      return res.json({
        success: true,
        helpText
      });
    } catch (error: any) {
      console.error('Error in contextual help endpoint:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate help content',
        error: error.message
      });
    }
  });

  // Get feature explanation
  app.post("/api/ai-help/explain-feature", requireAuth, async (req, res) => {
    try {
      const { feature } = req.body;
      
      if (!feature) {
        return res.status(400).json({ 
          success: false, 
          message: "Feature name is required" 
        });
      }
      
      // Get feature explanation from OpenAI
      const { getFeatureExplanation } = await import('./services/openai');
      const explanation = await getFeatureExplanation(feature);
      
      return res.json({
        success: true,
        explanation
      });
    } catch (error: any) {
      console.error('Error in feature explanation endpoint:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate feature explanation',
        error: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}