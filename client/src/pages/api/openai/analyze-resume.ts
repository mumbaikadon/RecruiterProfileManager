import { Request, Response } from 'express';
import { parseDocument, analyzeResumeText } from '../../../../server/document-parser';
import { sanitizeHtml } from '../../../../server/utils';

/**
 * API Handler for resume analysis
 * This endpoint receives a resume file, extracts text, and performs AI analysis
 */
export default async function handler(req: Request, res: Response) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Check if request includes a file or text content
    const file = req.files?.['file'];
    let text = req.body.text;
    
    // If there's a file, extract text from it
    if (file && !text) {
      const buffer = Buffer.from(file.data);
      const fileType = file.mimetype;
      
      // Extract text from document
      text = await parseDocument(buffer, fileType);
    }
    
    // Validate text input
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ message: 'Resume text is required' });
    }
    
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
      text = cleanedText;
    }
    
    // Proceed with analyzing the text
    try {
      const analysis = await analyzeResumeText(text);
      
      // Additional safety sanitization for extracted values
      const safeAnalysis = {
        clientNames: analysis.clientNames.map(client => sanitizeHtml(client)),
        jobTitles: analysis.jobTitles.map(title => sanitizeHtml(title)),
        relevantDates: analysis.relevantDates.map(date => sanitizeHtml(date)),
        skills: analysis.skills.map(skill => sanitizeHtml(skill)), 
        education: analysis.education.map(edu => sanitizeHtml(edu)),
        // Truncate extractedText to ensure it doesn't exceed DB limits
        extractedText: text.substring(0, 4000)
      };
      
      return res.json(safeAnalysis);
    } catch (analysisError) {
      console.error("Failed to analyze document text:", analysisError);
      return res.status(500).json({ 
        message: "Resume analysis failed", 
        error: analysisError instanceof Error ? analysisError.message : "Unknown error" 
      });
    }
    
  } catch (error) {
    console.error("Resume analysis API error:", error);
    return res.status(500).json({ 
      message: "Resume processing failed", 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
  }
}