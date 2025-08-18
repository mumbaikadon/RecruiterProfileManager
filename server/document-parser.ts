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
    
    // Use pdfjs-dist which is more stable for server environments
    try {
      const { getDocument } = await import('pdfjs-dist');
      
      // Load the PDF document from buffer
      const uint8Array = new Uint8Array(buffer);
      const loadingTask = getDocument({ data: uint8Array });
      const pdf = await loadingTask.promise;
      
      let fullText = '';
      const numPages = pdf.numPages;
      console.log(`PDF has ${numPages} pages`);
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ');
          
          fullText += pageText + '\n';
        } catch (pageError) {
          console.log(`Error extracting page ${pageNum}:`, pageError.message);
          // Continue with other pages
        }
      }
      
      const extractedText = fullText.trim();
      
      if (extractedText.length > 50) {
        console.log(`PDF extraction successful: ${extractedText.length} characters extracted`);
        profileLogger.extractionSuccess('pdf-file', extractedText.length);
        return extractedText;
      } else {
        console.log("PDF extraction returned minimal text");
        throw new Error("Minimal text extracted from PDF");
      }
      
    } catch (pdfjsError) {
      console.log("pdfjs-dist extraction failed:", pdfjsError.message);
      
      // Fallback to pdf-parse with isolated execution
      try {
        // Create a safe wrapper to avoid the test file issue
        const pdfParseModule = await import('pdf-parse');
        const pdfParse = pdfParseModule.default;
        
        if (!pdfParse || typeof pdfParse !== 'function') {
          throw new Error('PDF parser not available');
        }
        
        // Use minimal options to avoid library bugs
        const data = await pdfParse(buffer, {
          max: 0 // No page limit to extract all pages
        });
        
        const extractedText = data.text?.trim() || "";
        
        if (extractedText.length > 50) {
          console.log(`PDF extraction successful with pdf-parse: ${extractedText.length} characters`);
          profileLogger.extractionSuccess('pdf-file', extractedText.length);
          return extractedText;
        } else {
          throw new Error("Minimal text extracted");
        }
        
      } catch (fallbackError) {
        console.log("pdf-parse fallback failed:", fallbackError.message);
        throw new Error("All PDF parsing methods failed");
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