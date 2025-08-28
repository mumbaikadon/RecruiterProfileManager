/**
 * Document parser utility for handling different document formats
 */

import { Buffer } from 'node:buffer';
import { profileLogger } from './logger';

/**
 * Extract text from a PDF file using PDF.js library
 * @param buffer PDF file buffer
 * @returns Extracted text
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    profileLogger.extractionStart('pdf-file', 'pdf');
    console.log("Starting PDF text extraction with PDF.js, buffer size:", buffer.length);
    console.log("Buffer type:", typeof buffer);
    console.log("Is Buffer instance:", Buffer.isBuffer(buffer));
    
    // Ensure we have a clean buffer
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input is not a valid buffer");
    }
    
    // Check file size limit (50MB)
    const maxFileSize = 50 * 1024 * 1024;
    if (buffer.length > maxFileSize) {
      throw new Error(`PDF file too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum size is 50MB.`);
    }
    
    console.log("Loading PDF.js library...");
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    console.log("PDF.js loaded successfully");
    
    // Configure PDF.js for Node.js environment  
    // In Node.js, we use an empty string to disable the worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    console.log("Parsing PDF document...");
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document with options to prevent stack overflow
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0, // Reduce logging
      cMapUrl: undefined,
      cMapPacked: false,
      standardFontDataUrl: undefined
    });
    
    // Set timeout for PDF loading
    const pdfDoc = await Promise.race([
      loadingTask.promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF loading timeout')), 30000)
      )
    ]) as any;
    
    console.log(`PDF loaded successfully. Pages: ${pdfDoc.numPages}`);
    
    // Limit number of pages to process (prevent excessive processing)
    const maxPages = Math.min(pdfDoc.numPages, 50);
    let extractedText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        console.log(`Processing page ${pageNum}/${maxPages}`);
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Extract text items and join them
        const pageText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        
        if (pageText) {
          extractedText += pageText + '\n';
        }
        
        // Clean up page resources
        page.cleanup();
      } catch (pageError) {
        console.warn(`Error processing page ${pageNum}:`, pageError);
        // Continue with other pages
      }
    }
    
    // Clean up PDF document
    pdfDoc.destroy();
    
    extractedText = extractedText.trim();
    console.log(`PDF extraction completed: ${extractedText.length} characters extracted`);
    
    if (extractedText && extractedText.length > 20) {
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