/**
 * Document parser utility for handling different document formats
 */

import type { Buffer } from 'node:buffer';
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
    
    // Try pdf-extraction library which is more reliable for server environments
    try {
      const { extractText } = await import('pdf-extraction');
      
      console.log("Attempting PDF parsing with pdf-extraction...");
      
      // Extract text using pdf-extraction which is more stable
      const extractionResult = await extractText(buffer);
      
      const extractedText = extractionResult?.trim() || "";
      
      if (extractedText && extractedText.length > 10) {
        console.log(`PDF extraction successful: ${extractedText.length} characters extracted`);
        profileLogger.extractionSuccess('pdf-file', extractedText.length);
        return extractedText;
      } else {
        console.log("PDF extraction returned minimal or no text");
        throw new Error("No meaningful text extracted from PDF");
      }
      
    } catch (extractionError) {
      console.log("pdf-extraction failed:", extractionError.message);
      
      // Fallback: Try simple text extraction approach
      try {
        console.log("Trying fallback approach for PDF text extraction...");
        
        // Convert buffer to string and look for readable text patterns
        const bufferString = buffer.toString('utf8');
        
        // Look for text patterns in PDF (very basic approach)
        const textMatches = bufferString.match(/[\x20-\x7E\s]{10,}/g);
        
        if (textMatches && textMatches.length > 0) {
          const extractedText = textMatches
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          if (extractedText.length > 50) {
            console.log(`Fallback PDF extraction found ${extractedText.length} characters`);
            profileLogger.extractionSuccess('pdf-file', extractedText.length);
            return extractedText;
          }
        }
        
        throw new Error("No readable text found in PDF");
        
      } catch (fallbackError) {
        console.log("All PDF extraction methods failed:", fallbackError.message);
        throw new Error("PDF appears to be image-based or encrypted - no text could be extracted");
      }
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