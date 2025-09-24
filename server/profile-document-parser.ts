import { Buffer } from 'node:buffer';
import path from 'path';

// Type definitions for pdf-parse
interface PDFParseResult {
  text?: string;
  numpages?: number;
  info?: {
    Producer?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Enhanced PDF parser specifically designed for Profile Records bulk upload
 * Addresses previous stack overflow issues with robust error handling,
 * memory management, and file size limits
 */

// Memory and performance limits
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit (increased for enterprise-scale uploads)
const MAX_PAGES = 100; // Page limit to prevent excessive memory usage
const PARSING_TIMEOUT = 20000; // 20 second timeout
const MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB memory threshold

// Utility to monitor memory usage
function getMemoryUsage(): { used: number; total: number } {
  const usage = process.memoryUsage();
  return {
    used: usage.heapUsed,
    total: usage.heapTotal
  };
}

// Utility to force garbage collection if available
function forceGarbageCollection(): void {
  if (global.gc) {
    global.gc();
  }
}

// Timeout wrapper to prevent hanging operations
async function withTimeout<T>(
  promise: Promise<T>, 
  ms: number, 
  label = 'operation'
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)), 
      ms
    );
  });
  
  try {
    const result = await Promise.race([promise, timeout]);
    return result as T;
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Validate buffer input to prevent invalid data processing
 */
function validateBuffer(buffer: any): buffer is Buffer {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return false;
  }
  
  if (buffer.length === 0) {
    return false;
  }
  
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`PDF file too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
  }
  
  return true;
}

/**
 * Enhanced PDF text extraction using pdf-parse with comprehensive error handling
 * Designed specifically for bulk Profile Records upload to avoid stack overflow issues
 */
export async function extractTextFromPdfProfile(buffer: Buffer): Promise<string> {
  const startTime = Date.now();
  const initialMemory = getMemoryUsage();
  
  try {
    console.log(`[Profile PDF] Starting extraction: ${buffer.length} bytes, Memory: ${Math.round(initialMemory.used / 1024 / 1024)}MB`);
    
    // Validate input buffer
    if (!validateBuffer(buffer)) {
      throw new Error('Input is not a valid buffer');
    }
    
    // Check memory before processing
    if (initialMemory.used > MEMORY_THRESHOLD) {
      console.warn(`[Profile PDF] High memory usage detected: ${Math.round(initialMemory.used / 1024 / 1024)}MB`);
      forceGarbageCollection();
    }
    
    // Validate PDF signature
    const pdfSignature = buffer.slice(0, 4).toString('ascii');
    if (pdfSignature !== '%PDF') {
      console.warn(`[Profile PDF] Invalid PDF signature: ${pdfSignature}, continuing anyway`);
    }
    
    // Load pdf-parse with proper error handling
    let pdfParse: any;
    try {
      console.log('[Profile PDF] Loading pdf-parse module...');
      const mod: any = await import('pdf-parse');
      pdfParse = mod.default ?? mod;
      
      if (!pdfParse || typeof pdfParse !== 'function') {
        throw new Error('pdf-parse module did not export a function');
      }
      
      console.log('[Profile PDF] pdf-parse module loaded successfully');
    } catch (moduleError) {
      console.error('[Profile PDF] Failed to load pdf-parse:', moduleError);
      throw new Error(`Failed to load PDF parser: ${(moduleError as Error).message}`);
    }
    
    // Configure parsing options to prevent stack overflow
    const parseOptions = {
      max: MAX_PAGES, // Limit pages processed
      version: 'v1.10.1', // Use specific version for stability
      // Additional options to prevent memory issues
      normalizeWhitespace: true,
      disableCombineTextItems: false
    };
    
    console.log(`[Profile PDF] Starting parsing with options:`, parseOptions);
    
    // Parse with timeout protection
    const parsePromise = pdfParse(buffer, parseOptions);
    const data: PDFParseResult = await withTimeout(parsePromise, PARSING_TIMEOUT, 'PDF parsing');
    
    // Extract and normalize text
    if (!data || !data.text) {
      throw new Error('PDF parsing returned no text content');
    }
    
    let text = data.text.toString();
    
    // Normalize text to prevent encoding issues
    text = text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ') // Remove control characters
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n') // Handle old Mac line endings
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Validate extracted text
    if (!text || text.length === 0) {
      throw new Error('No readable text found in PDF');
    }
    
    if (text.length < 10) {
      console.warn(`[Profile PDF] Very short text extracted: ${text.length} characters`);
    }
    
    // Memory cleanup
    forceGarbageCollection();
    
    const endTime = Date.now();
    const finalMemory = getMemoryUsage();
    const duration = endTime - startTime;
    
    console.log(`[Profile PDF] Extraction successful: ${text.length} chars, ${duration}ms, Memory: ${Math.round(finalMemory.used / 1024 / 1024)}MB`);
    
    // Log parsing metadata for debugging
    if (data.info) {
      console.log(`[Profile PDF] Document info: ${data.numpages || 'Unknown'} pages, Producer: ${data.info.Producer || 'Unknown'}`);
    }
    
    return text;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`[Profile PDF] Extraction failed after ${duration}ms:`, error);
    
    // Clean up memory on error
    forceGarbageCollection();
    
    // Provide user-friendly error messages
    const message = error instanceof Error ? error.message : String(error);
    
    if (message.includes('Password') || message.includes('encrypted')) {
      throw new Error('PDF is password-protected and cannot be processed');
    }
    
    if (message.includes('timed out')) {
      throw new Error('PDF processing timed out - file may be too complex or corrupted');
    }
    
    if (message.includes('too large')) {
      throw new Error(message); // Pass through file size errors
    }
    
    if (message.includes('Invalid PDF signature')) {
      throw new Error('File does not appear to be a valid PDF document');
    }
    
    if (message.includes('not a valid buffer')) {
      throw new Error('Invalid file data received');
    }
    
    // Generic error with guidance
    throw new Error(`PDF parsing failed: ${message}. Please ensure the file is a valid, unprotected PDF document.`);
  }
}

/**
 * Extract text from DOCX files using mammoth
 * Optimized for Profile Records with memory management
 */
export async function extractTextFromDocxProfile(buffer: Buffer): Promise<string> {
  const startTime = Date.now();
  const initialMemory = getMemoryUsage();
  
  try {
    console.log(`[Profile DOCX] Starting extraction: ${buffer.length} bytes, Memory: ${Math.round(initialMemory.used / 1024 / 1024)}MB`);
    
    // Validate buffer
    if (!validateBuffer(buffer)) {
      throw new Error('Input is not a valid buffer');
    }
    
    // Load mammoth
    const mammoth = await import('mammoth');
    
    // Extract text with timeout protection
    const extractPromise = mammoth.extractRawText({ buffer });
    const result = await withTimeout(extractPromise, 15000, 'DOCX extraction');
    
    let text = (result?.value ?? '').toString();
    
    // Normalize text
    text = text
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!text || text.length === 0) {
      throw new Error('No readable text found in DOCX document');
    }
    
    forceGarbageCollection();
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`[Profile DOCX] Extraction successful: ${text.length} chars, ${duration}ms`);
    
    return text;
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`[Profile DOCX] Extraction failed after ${duration}ms:`, error);
    
    forceGarbageCollection();
    
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`DOCX parsing failed: ${message}`);
  }
}

/**
 * Extract text from TXT files
 */
export function extractTextFromTxtProfile(buffer: Buffer): string {
  try {
    if (!validateBuffer(buffer)) {
      throw new Error('Input is not a valid buffer');
    }
    
    const text = buffer.toString('utf8').trim();
    
    if (!text || text.length === 0) {
      throw new Error('Text file is empty');
    }
    
    return text;
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Text file processing failed: ${message}`);
  }
}

/**
 * Main document extraction function for Profile Records
 * Routes to appropriate parser based on file type
 */
export async function extractTextFromDocumentProfile(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  const startTime = Date.now();
  
  try {
    console.log(`[Profile Parser] Processing ${fileType} file: ${buffer.length} bytes`);
    
    // Normalize file type
    const type = fileType.toLowerCase();
    
    // Handle filename-based detection
    if (fileType.includes('.')) {
      const extension = path.extname(fileType).toLowerCase().replace('.', '');
      switch (extension) {
        case 'pdf':
          return await extractTextFromPdfProfile(buffer);
        case 'docx':
          return await extractTextFromDocxProfile(buffer);
        case 'txt':
          return extractTextFromTxtProfile(buffer);
        default:
          throw new Error(`Unsupported file extension: ${extension}`);
      }
    }
    
    // Handle MIME type-based detection
    switch (type) {
      case 'pdf':
      case 'application/pdf':
        return await extractTextFromPdfProfile(buffer);
        
      case 'docx':
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return await extractTextFromDocxProfile(buffer);
        
      case 'txt':
      case 'text/plain':
        return extractTextFromTxtProfile(buffer);
        
      default:
        throw new Error(`Unsupported file type: ${fileType}. Only PDF, DOCX, and TXT files are supported.`);
    }
    
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error(`[Profile Parser] Document processing failed after ${duration}ms:`, error);
    throw error;
  }
}

/**
 * Health check function to verify parser is working
 */
export async function healthCheckProfileParser(): Promise<boolean> {
  try {
    // Test with minimal text buffer
    const testBuffer = Buffer.from('Test content for health check');
    const result = extractTextFromTxtProfile(testBuffer);
    return result === 'Test content for health check';
  } catch (error) {
    console.error('[Profile Parser] Health check failed:', error);
    return false;
  }
}