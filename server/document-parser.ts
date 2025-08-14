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
    // Try multiple import strategies for cross-platform compatibility
    let pdfParse: any = null;
    
    try {
      // Try default import first
      const pdf = await import('pdf-parse');
      pdfParse = pdf.default || pdf;
    } catch (importError) {
      console.log('Default import failed, trying specific path');
      try {
        // Try specific path import
        const pdf = await import('pdf-parse/lib/pdf-parse.js');
        pdfParse = pdf.default || pdf;
      } catch (specificError) {
        console.log('Specific path failed, trying CommonJS require');
        // Last resort - CommonJS require
        const pdf = require('pdf-parse');
        pdfParse = pdf.default || pdf;
      }
    }
    
    if (!pdfParse || typeof pdfParse !== 'function') {
      throw new Error('Could not load PDF parser');
    }
    
    // Parse the PDF buffer
    const data = await pdfParse(buffer);
    return data.text || "";
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from a DOCX file using mammoth library
 * @param buffer DOCX file buffer
 * @returns Extracted text
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    // Try multiple import strategies for cross-platform compatibility
    let mammoth: any = null;
    
    try {
      // Try ES module import first
      mammoth = await import('mammoth');
    } catch (importError) {
      console.log('ES module import failed for mammoth, trying CommonJS require');
      try {
        // Fallback to CommonJS require
        mammoth = require('mammoth');
      } catch (requireError) {
        throw new Error('Could not load mammoth library');
      }
    }
    
    if (!mammoth || typeof mammoth.extractRawText !== 'function') {
      throw new Error('Mammoth library not properly loaded');
    }
    
    // Extract text from the DOCX buffer
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : String(error)}`);
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