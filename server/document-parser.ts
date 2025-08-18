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
    
    // Try pdf-parse with proper configuration to avoid test file issues
    try {
      // Create a temporary file-like approach to avoid the test file path issue
      const fs = await import('fs');
      const path = await import('path');
      const os = await import('os');
      
      // Create a temporary file to avoid the library's hardcoded test path
      const tempDir = os.tmpdir();
      const tempFile = path.join(tempDir, `temp_pdf_${Date.now()}.pdf`);
      
      try {
        // Write buffer to temp file
        fs.writeFileSync(tempFile, buffer);
        
        // Now use pdf-parse with the file path instead of buffer
        const pdfParse = await import('pdf-parse').then(module => module.default);
        const data = await pdfParse(fs.readFileSync(tempFile));
        
        // Clean up temp file
        fs.unlinkSync(tempFile);
        
        const extractedText = data.text?.trim() || "";
        
        if (extractedText && extractedText.length > 10) {
          console.log(`PDF extraction successful: ${extractedText.length} characters extracted`);
          profileLogger.extractionSuccess('pdf-file', extractedText.length);
          return extractedText;
        } else {
          throw new Error("No meaningful text extracted from PDF");
        }
        
      } catch (tempFileError) {
        // Clean up temp file if it exists
        try { fs.unlinkSync(tempFile); } catch {}
        throw tempFileError;
      }
      
    } catch (parseError) {
      console.log("pdf-parse failed:", parseError.message);
      
      // No fallback needed since pdf-parse should work with temp file approach
      throw new Error("PDF text extraction failed - file may be image-based, encrypted, or corrupted");
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