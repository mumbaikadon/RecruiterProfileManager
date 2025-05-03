import express from "express";
import multer from "multer";
import { parseDocument, ResumeAnalysisResult } from "../../../../server/document-parser";
import { analyzeResumeText } from "../../../../server/openai";

const router = express.Router();
const upload = multer(); // memory storage by default

router.post(
  "/api/openai/analyze-resume",
  upload.single("file"),
  async (req, res) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const ext = file.originalname.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "docx"].includes(ext)) {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    try {
      const extractedText = await parseDocument(file.buffer, ext);

      // Use the OpenAI analysis to extract structured data from the resume text
      const analysis = await analyzeResumeText(extractedText);
      
      // Add the filename to the analysis result
      analysis.fileName = file.originalname;

      res.status(200).json(analysis);
    } catch (error) {
      console.error("Resume parsing failed:", error);
      res.status(500).json({ error: "Resume parsing failed" });
    }
  },
);

export default router;
