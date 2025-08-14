/**
 * Document parser utility for handling different document formats
 */

import { Buffer } from 'node:buffer';

/**
 * Extract text from a PDF file using pdf-parse library
 * @param buffer PDF file buffer
 * @returns Extracted text
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  console.log('\n🔍 ===== PDF PARSING DEBUG START =====');
  console.log(`📄 PDF Buffer Info:`);
  console.log(`   - Size: ${buffer.length} bytes`);
  console.log(`   - Type: ${typeof buffer}`);
  console.log(`   - Is Buffer: ${Buffer.isBuffer(buffer)}`);
  console.log(`   - First 20 bytes: ${buffer.subarray(0, 20).toString('hex')}`);
  
  // Check if this is actually a PDF by looking for PDF header
  const pdfHeader = buffer.subarray(0, 4).toString('ascii');
  console.log(`   - Header signature: "${pdfHeader}" (should start with "%PDF")`);
  
  if (!pdfHeader.startsWith('%PDF')) {
    console.log('⚠️  WARNING: File does not appear to be a valid PDF (missing %PDF header)');
    return '';
  }

  try {
    console.log('\n📦 PDF-Parse Library Loading:');
    let pdfParse: any = null;
    
    try {
      console.log('   - Attempting default import...');
      const pdf = await import('pdf-parse');
      pdfParse = pdf.default || pdf;
      console.log(`   ✅ Default import successful: ${typeof pdfParse}`);
    } catch (importError: any) {
      console.log(`   ❌ Default import failed: ${importError?.message || String(importError)}`);
      console.log('   - Trying specific path import...');
      try {
        const pdf = await import('pdf-parse/lib/pdf-parse.js');
        pdfParse = pdf.default || pdf;
        console.log(`   ✅ Specific path import successful: ${typeof pdfParse}`);
      } catch (specificError: any) {
        console.log(`   ❌ Specific path failed: ${specificError?.message || String(specificError)}`);
        console.log('   - Trying CommonJS require as last resort...');
        const pdf = require('pdf-parse');
        pdfParse = pdf.default || pdf;
        console.log(`   ✅ CommonJS require successful: ${typeof pdfParse}`);
      }
    }
    
    if (!pdfParse || typeof pdfParse !== 'function') {
      console.log('❌ PDF parser could not be loaded properly');
      console.log(`   - pdfParse type: ${typeof pdfParse}`);
      console.log(`   - pdfParse value: ${pdfParse}`);
      throw new Error('Could not load PDF parser');
    }
    
    console.log('\n🔧 PDF Parsing Process:');
    console.log('   - Starting PDF buffer parsing...');
    const startTime = Date.now();
    
    // Parse the PDF buffer
    const data = await pdfParse(buffer);
    const endTime = Date.now();
    
    console.log(`   ✅ PDF parsing completed in ${endTime - startTime}ms`);
    console.log('\n📊 PDF Parse Results:');
    console.log(`   - Pages: ${data.numpages || 'unknown'}`);
    console.log(`   - Version: ${data.version || 'unknown'}`);
    console.log(`   - Text length: ${data.text ? data.text.length : 0} characters`);
    
    if (data.text) {
      console.log(`   - Text preview (first 200 chars): "${data.text.substring(0, 200)}..."`);
      console.log(`   - Contains readable content: ${data.text.trim().length > 0 ? 'YES' : 'NO'}`);
    } else {
      console.log('   ⚠️  No text extracted from PDF');
    }
    
    console.log('\n✅ PDF parsing successful');
    console.log('🔍 ===== PDF PARSING DEBUG END =====\n');
    
    return data.text || "";
  } catch (error: any) {
    console.log('\n❌ PDF Parsing Error Details:');
    console.log(`   - Error type: ${error?.constructor?.name || 'Unknown'}`);
    console.log(`   - Error message: ${error?.message || String(error)}`);
    console.log(`   - Error stack: ${error?.stack || 'No stack trace'}`);
    
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('Invalid PDF')) {
      console.log('   - Diagnosis: PDF file appears to be corrupted or invalid');
    } else if (errorMessage.includes('Module not found')) {
      console.log('   - Diagnosis: PDF parsing library not properly installed');
    } else if (errorMessage.includes('Cannot read properties')) {
      console.log('   - Diagnosis: PDF parsing library returned unexpected format');
    }
    
    console.log('🔍 ===== PDF PARSING DEBUG END (WITH ERROR) =====\n');
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
  console.log('\n📄 Document Parser - Entry Point:');
  console.log(`   - File type: ${fileType}`);
  console.log(`   - Buffer size: ${buffer.length} bytes`);
  
  // Convert file type to lowercase for consistency
  const type = fileType.toLowerCase();
  console.log(`   - Normalized type: ${type}`);
  
  // Extract text based on file type
  switch (type) {
    case 'pdf':
      console.log('   - Routing to PDF parser...');
      return extractTextFromPdf(buffer);
    case 'docx':
      console.log('   - Routing to DOCX parser (no debug - working perfectly)...');
      return extractTextFromDocx(buffer);
    case 'txt':
      console.log('   - Routing to TXT parser...');
      return extractTextFromTxt(buffer);
    default:
      console.log(`   ❌ Unsupported file type: ${fileType}`);
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Extract text from buffer based on MIME type
 * @param buffer Document file buffer
 * @param mimeType MIME type of the file
 * @returns Extracted text
 */
export async function extractTextFromBuffer(buffer: Buffer, mimeType: string): Promise<string> {
  console.log('\n🔧 extractTextFromBuffer called:');
  console.log(`   - MIME type: ${mimeType}`);
  console.log(`   - Buffer size: ${buffer.length} bytes`);
  
  // Determine file type from MIME type
  let fileType: string;
  if (mimeType.includes('pdf')) {
    fileType = 'pdf';
    console.log('   - Detected as PDF file');
  } else if (mimeType.includes('wordprocessing') || mimeType.includes('docx')) {
    fileType = 'docx';
    console.log('   - Detected as DOCX file');
  } else if (mimeType.includes('text')) {
    fileType = 'txt';
    console.log('   - Detected as TXT file');
  } else {
    console.log(`   ❌ Unsupported MIME type: ${mimeType}`);
    throw new Error(`Unsupported MIME type: ${mimeType}`);
  }
  
  return extractTextFromDocument(buffer, fileType);
}