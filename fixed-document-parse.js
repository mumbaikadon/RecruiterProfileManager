// Fixed implementation of document parsing endpoint
import express from 'express';
import multer from 'multer';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

// Create a router instance
const router = express.Router();

// Set up multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Document parsing endpoint
router.post('/api/fixed-parse-document', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "No file uploaded" 
      });
    }

    console.log(`Document file received: ${req.file.originalname}, ${Math.round(req.file.size / 1024)}KB`);
    
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();
    const fileType = fileName.endsWith('.pdf') ? 'pdf' : 
                    fileName.endsWith('.docx') ? 'docx' : 
                    fileName.endsWith('.txt') ? 'txt' : 'unknown';
    
    console.log(`Processing ${fileType} document: ${req.file.originalname} (${fileBuffer.length} bytes)`);
    
    // Extract text based on file type
    try {
      let extractedText = '';
      
      if (fileType === 'docx') {
        // Process DOCX files
        console.log("Using mammoth to extract DOCX content");
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        extractedText = result.value || "";
      } 
      else if (fileType === 'pdf') {
        // Process PDF files
        console.log("Using pdf-parse to extract PDF content");
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(fileBuffer);
        extractedText = data.text || "";
      }
      else if (fileType === 'txt') {
        // Process TXT files
        extractedText = fileBuffer.toString('utf8');
      }
      else {
        return res.status(400).json({
          success: false,
          error: "Unsupported file type",
          message: `File type '${fileType}' is not supported. Please upload a PDF, DOCX, or TXT file.`
        });
      }
      
      // Log the extraction results
      console.log(`Successfully extracted ${extractedText.length} characters from ${fileType.toUpperCase()}`);
      if (extractedText.length > 0) {
        console.log("Text preview:", extractedText.substring(0, 200) + "...");
      } else {
        console.log("Warning: Extracted text is empty!");
      }
      
      // Return success with the extracted text
      return res.json({
        success: true,
        text: extractedText,
        fileType,
        fileName: req.file.originalname,
        textLength: extractedText.length
      });
      
    } catch (parseError) {
      console.error("Document parsing error:", parseError);
      return res.status(500).json({ 
        success: false,
        error: "Document parsing failed", 
        message: parseError instanceof Error ? parseError.message : "Unknown error" 
      });
    }
  } catch (error) {
    console.error("Request handling error:", error);
    return res.status(500).json({ 
      success: false,
      error: "Server error", 
      message: error instanceof Error ? error.message : "Unknown error" 
    });
  }
});

// For local testing
if (require.main === module) {
  const app = express();
  app.use(router);
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default router;