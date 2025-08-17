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
    
    // Use dynamic import for pdf-parse in ES modules
    const { default: pdfParse } = await import('pdf-parse');
    
    if (!pdfParse || typeof pdfParse !== 'function') {
      throw new Error('PDF parser not available');
    }
    
    // Multiple parsing strategies for different PDF types
    const strategies = [
      // Strategy 1: Basic parsing with limits
      {
        name: 'basic',
        options: {
          max: 50,
          normalizeWhitespace: false
        }
      },
      // Strategy 2: Minimal options for problematic PDFs
      {
        name: 'minimal',
        options: {}
      },
      // Strategy 3: Text-only extraction
      {
        name: 'text-only',
        options: {
          max: 25,
          normalizeWhitespace: true
        }
      }
    ];
    
    for (const strategy of strategies) {
      try {
        console.log(`Trying PDF parsing strategy: ${strategy.name}`);
        const data = await pdfParse(buffer, strategy.options);
        
        const extractedText = data.text?.trim() || "";
        
        if (extractedText.length > 50) {
          console.log(`PDF extraction successful with ${strategy.name} strategy: ${extractedText.length} characters`);
          profileLogger.extractionSuccess('pdf-file', extractedText.length);
          return extractedText;
        } else if (extractedText.length > 0) {
          console.log(`PDF extraction returned short text with ${strategy.name}: ${extractedText.length} characters`);
          // Continue to try other strategies for better results
        }
      } catch (strategyError) {
        console.log(`Strategy ${strategy.name} failed:`, strategyError.message);
        // Continue to next strategy
      }
    }
    
    // If all strategies failed, return a helpful message
    console.log("All PDF parsing strategies failed");
    return "PDF content could not be extracted. The file may be image-based, password-protected, or corrupted. Please try converting to Word document format.";
    
  } catch (error) {
    console.error("PDF extraction error:", error);
    const errorMsg = `PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try converting the PDF to a Word document or use a different PDF file.`;
    profileLogger.extractionError('pdf-file', errorMsg);
    return errorMsg;
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
    return errorMsg;
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