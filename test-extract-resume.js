import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use the original test resume for reference
const docxResumePath = path.join(__dirname, 'attached_assets', 'Rajesh (1).docx');

// Path for saving the text content
const textOutputPath = path.join(__dirname, 'extracted_resume.txt');

async function extractDocxResume() {
  try {
    console.log('Reading DOCX resume file:', docxResumePath);
    const buffer = fs.readFileSync(docxResumePath);
    
    console.log('Extracting text with mammoth...');
    const result = await mammoth.extractRawText({
      buffer: buffer
    });
    
    const text = result.value;
    console.log(`Successfully extracted ${text.length} characters`);
    console.log('Preview:', text.substring(0, 300));
    
    // Save the extracted text to a file
    fs.writeFileSync(textOutputPath, text);
    console.log('Full text saved to:', textOutputPath);
    
    return {
      success: true,
      text,
      length: text.length
    };
  } catch (error) {
    console.error('Error extracting resume:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the extraction
extractDocxResume().then(result => {
  console.log('Extraction complete:', result.success);
  if (result.success) {
    console.log(`Extracted ${result.length} characters of resume text`);
  }
});