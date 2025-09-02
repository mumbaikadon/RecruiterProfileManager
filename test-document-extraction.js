// Test script to verify the document extraction fix
import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromDocument } from './server/document-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set up a simple express server to test the document extraction
const app = express();
const port = 3333;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create a test route for document parsing
app.post('/test-parse-document', upload.single('file'), async (req, res) => {
  try {
    console.log('Received file:', req.file.originalname);
    
    // Get file type from the original name
    const fileType = req.file.originalname.split('.').pop().toLowerCase();
    console.log('File type:', fileType);
    
    // Extract text from the document
    const text = await extractTextFromDocument(req.file.buffer, fileType);
    
    // Return the extracted text
    res.json({
      success: true,
      text,
      fileType,
      fileName: req.file.originalname,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('Error in test route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Test server running at http://localhost:${port}`);
  
  // Test with a sample PDF file
  const testFile = path.join(__dirname, 'attached_assets', 'Drew Corrigan - CV.pdf');
  console.log(`Testing with file: ${testFile}`);
  
  // Create a FormData-like object for the test
  const formData = new FormData();
  const fileBuffer = fs.readFileSync(testFile);
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, path.basename(testFile));
  
  // Send the request
  fetch('http://localhost:3333/test-parse-document', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    console.log('Test result:', data);
    if (data.success) {
      console.log('Document extraction successful!');
      console.log(`Extracted ${data.text.length} characters`);
      console.log('Preview:', data.text.substring(0, 200));
    } else {
      console.error('Document extraction failed:', data.error);
    }
    
    // Shut down the server after the test
    process.exit(0);
  })
  .catch(error => {
    console.error('Test request failed:', error);
    process.exit(1);
  });
});
