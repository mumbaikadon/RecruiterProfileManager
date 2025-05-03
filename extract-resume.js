import fs from 'fs';
import mammoth from 'mammoth';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractTextFromDocx(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({
      buffer: buffer
    });
    console.log(result.value);
    return result.value;
  } catch (error) {
    console.error("Error extracting text:", error);
    return null;
  }
}

// Path to the resume file
const resumePath = path.join(__dirname, 'attached_assets', 'abinesh_resume.docx');

// Extract and print the text content
extractTextFromDocx(resumePath);