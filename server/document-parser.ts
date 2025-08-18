/**
 * Document parser utility for handling different document formats
 */

import type { Buffer } from 'node:buffer';
import { createRequire } from 'node:module';
import { profileLogger } from './logger';

/**
 * Extract text from a PDF file using pdf-parse library
 * @param buffer PDF file buffer
 * @returns Extracted text
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    profileLogger.extractionStart('pdf-file', 'pdf');
    console.log("Starting PDF text extraction, buffer size:", buffer.length);
    console.log("Buffer type:", typeof buffer);
    console.log("Is Buffer instance:", Buffer.isBuffer(buffer));
    
    // Use createRequire to avoid debug mode issue with dynamic imports
    // pdf-parse enters debug mode when module.parent is undefined (which happens with dynamic imports)
    console.log("Loading pdf-parse using createRequire to avoid debug mode...");
    const require = createRequire(import.meta.url);
    const pdfParse = require('pdf-parse');
    console.log("pdf-parse loaded successfully");
    
    console.log("pdf-parse type:", typeof pdfParse);
    console.log("Calling pdf-parse with buffer...");
    
    // Ensure we have a clean buffer
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input is not a valid buffer");
    }
    
    const data = await pdfParse(buffer);
    console.log("pdf-parse completed, data keys:", Object.keys(data));
    
    let extractedText = data.text?.trim() || "";
    console.log("Extracted text length:", extractedText.length);
    
    if (extractedText && extractedText.length > 20) {
      console.log(`PDF extraction successful: ${extractedText.length} characters extracted`);
      console.log("First 200 chars:", extractedText.substring(0, 200));
      profileLogger.extractionSuccess('pdf-file', extractedText.length);
      return extractedText;
    } else {
      throw new Error("PDF contains no readable text - likely image-based or encrypted");
    }
    
  } catch (error) {
    console.error("PDF extraction error:", error);
    const errorMsg = `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. The file may be image-based, password-protected, or corrupted.`;
    profileLogger.extractionError('pdf-file', errorMsg);
    
    // For bulk uploads, we should throw the error so the file is marked as failed
    throw new Error("PDF content could not be extracted. Please try converting to Word document format.");
  }
}

/**
 * Extract text from a DOCX file using mammoth library
 * @param buffer DOCX file buffer
 * @returns Extracted text
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    profileLogger.extractionStart('docx-file', 'docx');
    console.log("Starting DOCX text extraction, buffer size:", buffer.length);
    
    // Use dynamic import for mammoth library
    const mammoth = await import('mammoth');
    
    if (!mammoth || typeof mammoth.extractRawText !== 'function') {
      throw new Error('Mammoth library not available');
    }
    
    // Extract text from the DOCX buffer with error handling
    console.log("Extracting text from DOCX buffer...");
    const result = await mammoth.extractRawText({ buffer });
    
    const extractedText = result.value || "";
    console.log(`DOCX extraction completed: ${extractedText.length} characters extracted`);
    
    if (extractedText.length > 0) {
      profileLogger.extractionSuccess('docx-file', extractedText.length);
    }
    
    return extractedText;
  } catch (error) {
    console.error("DOCX extraction error:", error);
    const errorMsg = `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try saving the document as a PDF or use a different Word document.`;
    profileLogger.extractionError('docx-file', errorMsg);
    
    // For bulk uploads, we should throw the error so the file is marked as failed
    throw new Error("DOCX content could not be extracted. Please try a different Word document.");
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
  
  // Handle MIME types
  if (type.includes('pdf') || type === 'application/pdf') {
    return extractTextFromPdf(buffer);
  } else if (type.includes('docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocx(buffer);
  } else if (type.includes('txt') || type === 'text/plain') {
    return extractTextFromTxt(buffer);
  } else if (type === 'pdf' || type === 'docx' || type === 'txt') {
    // Legacy file extension handling
    switch (type) {
      case 'pdf':
        return extractTextFromPdf(buffer);
      case 'docx':
        return extractTextFromDocx(buffer);
      case 'txt':
        return extractTextFromTxt(buffer);
    }
  }
  
  throw new Error(`Unsupported file type: ${fileType}. Please use PDF or DOCX files only.`);
}