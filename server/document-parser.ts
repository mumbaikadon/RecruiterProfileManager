/**
 * Document parser utility for handling different document formats
 */

import type { Buffer } from 'node:buffer';

/**
 * Extract text from a PDF file using pdf-parse library
 * @param buffer PDF file buffer
 * @returns Extracted text
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    // Simplified PDF parsing approach to avoid stack overflow issues
    console.log("Starting PDF text extraction, buffer size:", buffer.length);
    
    // Use direct require for pdf-parse to avoid complex import chain
    const pdfParse = require('pdf-parse');
    
    if (!pdfParse || typeof pdfParse !== 'function') {
      throw new Error('PDF parser not available');
    }
    
    // Add options to prevent stack overflow on large PDFs
    const options = {
      // Limit the number of pages to prevent stack overflow
      max: 50,
      // Disable font combining to reduce memory usage
      normalizeWhitespace: false,
      // Set version to prevent compatibility issues
      version: 'v1.6.0'
    };
    
    console.log("Parsing PDF with options:", options);
    const data = await pdfParse(buffer, options);
    
    const extractedText = data.text || "";
    console.log(`PDF extraction completed: ${extractedText.length} characters extracted`);
    
    return extractedText;
  } catch (error) {
    console.error("PDF extraction error:", error);
    // Return a more user-friendly error message instead of throwing
    return `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try converting the PDF to a Word document or use a different PDF file.`;
  }
}

/**
 * Extract text from a DOCX file using mammoth library
 * @param buffer DOCX file buffer
 * @returns Extracted text
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    console.log("Starting DOCX text extraction, buffer size:", buffer.length);
    
    // Use direct require for mammoth to avoid complex import chain
    const mammoth = require('mammoth');
    
    if (!mammoth || typeof mammoth.extractRawText !== 'function') {
      throw new Error('Mammoth library not available');
    }
    
    // Extract text from the DOCX buffer with error handling
    console.log("Extracting text from DOCX buffer...");
    const result = await mammoth.extractRawText({ buffer });
    
    const extractedText = result.value || "";
    console.log(`DOCX extraction completed: ${extractedText.length} characters extracted`);
    
    return extractedText;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    // Return a more user-friendly error message instead of throwing
    return `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try saving the document as a PDF or use a different Word document.`;
  }
}

/**
 * Extract text from a text file
 * @param buffer Text file buffer
 * @returns Extracted text
 */
export function extractTextFromTxt(buffer: Buffer): string {
  return buffer.toString('utf8');
}

/**
 * Extract text from a document file
 * @param buffer Document file buffer
 * @param fileType File type (pdf, docx, txt)
 * @returns Extracted text
 */
export async function extractTextFromDocument(buffer: Buffer, fileType: string): Promise<string> {
  // Convert file type to lowercase for consistency
  const type = fileType.toLowerCase();
  
  // Extract text based on file type
  switch (type) {
    case 'pdf':
      return extractTextFromPdf(buffer);
    case 'docx':
      return extractTextFromDocx(buffer);
    case 'txt':
      return extractTextFromTxt(buffer);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}