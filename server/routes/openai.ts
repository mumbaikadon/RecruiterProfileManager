import express, { Request, Response } from "express";
import multer from "multer";
import { parseDocument, ResumeAnalysisResult } from "../document-parser";
import { analyzeResumeText } from "../openai";

// Create an Express router
const router = express.Router();

// Configure multer for in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (_req, file, cb) => {
    // Accept only PDF and DOCX files
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const allowedExts = ['.pdf', '.docx', '.doc'];
    
    const fileExt = '.' + file.originalname.split('.').pop()?.toLowerCase();
    
    if (allowedTypes.includes(file.mimetype) || allowedExts.some(ext => fileExt.endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Only PDF and Word documents are accepted.'), false);
    }
  }
});

// Handle resume analysis route
router.post(
  "/analyze-resume",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      // Check if file was uploaded
      const file = req.file;
      if (!file) {
        return res.status(400).json({ 
          error: "No file uploaded. Please upload a PDF or Word document." 
        });
      }

      // Determine file type for parsing
      let fileType: string;
      if (file.mimetype === 'application/pdf') {
        fileType = 'pdf';
      } else if (file.mimetype.includes('word') || file.originalname.endsWith('.doc') || file.originalname.endsWith('.docx')) {
        fileType = 'docx';
      } else {
        return res.status(400).json({ 
          error: "Unsupported file type. Only PDF and Word documents are accepted." 
        });
      }

      console.log(`Processing ${fileType} file: ${file.originalname}, size: ${file.size} bytes`);

      try {
        // Step 1: Extract text from document
        const extractedText = await parseDocument(file.buffer, fileType);
        console.log(`Extracted text successfully, length: ${extractedText.length} characters`);

        if (!extractedText || extractedText.length < 50) {
          return res.status(422).json({
            error: "Could not extract sufficient text from the document. The file may be corrupted, password-protected, or contain no readable text."
          });
        }

        // Step 2: Analyze the resume text with OpenAI to extract structured data
        console.log("Analyzing resume text with OpenAI...");
        const analysis = await analyzeResumeText(extractedText);
        
        // Step 3: Add the filename to the analysis result
        analysis.fileName = file.originalname;

        // Step 4: Return the complete analysis
        console.log("Resume analysis completed successfully");
        return res.status(200).json(analysis);
      } catch (parseError) {
        console.error("Document parsing or analysis error:", parseError);
        return res.status(500).json({ 
          error: parseError instanceof Error ? parseError.message : "Failed to process document" 
        });
      }
    } catch (error) {
      console.error("Unexpected error in resume analysis route:", error);
      return res.status(500).json({ 
        error: "An unexpected error occurred while processing your resume." 
      });
    }
  }
);

// Handle resume matching route
router.post("/match-resume", async (req: Request, res: Response) => {
  try {
    const { resumeText, jobDescription } = req.body;
    
    // Validate inputs
    if (!resumeText) {
      return res.status(400).json({ error: "Resume text is required" });
    }
    
    if (!jobDescription) {
      return res.status(400).json({ error: "Job description is required" });
    }
    
    // Import the matchResumeToJob function
    const { matchResumeToJob } = await import("../openai");
    
    // Process the resume and job description
    console.log("Starting resume matching process...");
    const matchResult = await matchResumeToJob(resumeText, jobDescription);
    
    console.log("Resume matching completed, match score:", matchResult.score);
    return res.status(200).json(matchResult);
  } catch (error) {
    console.error("Error in resume matching:", error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : "Failed to match resume with job description" 
    });
  }
});

export default router;