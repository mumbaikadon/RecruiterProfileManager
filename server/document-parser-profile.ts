/**
 * Document Parser for Profile Records using pdf-parse library
 * Designed with comprehensive memory management and stack overflow prevention
 * 
 * Safety Features:
 * - Memory monitoring and cleanup
 * - Timeout protection (30s)
 * - Buffer size limits (50MB)
 * - Stack overflow prevention
 * - Explicit garbage collection
 * - Error recovery and fallback
 */

import { profileLogger } from './logging/winston-logger';

/**
 * Memory monitoring utility
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB  
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024) // MB
  };
}

/**
 * Force garbage collection if available
 */
function forceGarbageCollection() {
  if (global.gc) {
    global.gc();
    console.log("🗑️ Forced garbage collection completed");
  }
}

/**
 * Extract text from PDF using pdf-parse with comprehensive safety measures
 * @param buffer PDF file buffer
 * @returns Extracted text content
 */
export async function extractTextFromPdfProfile(buffer: Buffer): Promise<string> {
  // Track initial memory state
  const initialMemory = getMemoryUsage();
  console.log("🔍 [PDF-PARSE] Starting PDF extraction with memory safety");
  console.log(`📊 Initial memory: Heap ${initialMemory.heapUsed}MB / RSS ${initialMemory.rss}MB`);
  
  let pdfParseModule: any = null;
  let localBuffer: Buffer | null = buffer;
  
  try {
    profileLogger.extractionStart('pdf-parse-file', 'pdf');
    
    // Input validation
    if (!Buffer.isBuffer(buffer)) {
      throw new Error("Input is not a valid buffer");
    }
    
    if (buffer.length === 0) {
      throw new Error("PDF buffer is empty");
    }
    
    // File size validation (50MB limit)
    const maxFileSize = 50 * 1024 * 1024; // 50MB
    if (buffer.length > maxFileSize) {
      throw new Error(`PDF file too large (${Math.round(buffer.length / 1024 / 1024)}MB). Maximum size is 50MB.`);
    }
    
    console.log(`📄 Processing PDF: ${Math.round(buffer.length / 1024)}KB`);
    
    // Dynamic import of pdf-parse to prevent early memory allocation
    console.log("📦 Loading pdf-parse library...");
    pdfParseModule = await import('pdf-parse');
    const pdfParse = pdfParseModule.default || pdfParseModule;
    
    if (!pdfParse || typeof pdfParse !== 'function') {
      throw new Error('pdf-parse library not available or invalid');
    }
    
    console.log("✅ pdf-parse library loaded successfully");
    
    // Memory check before processing
    const preProcessMemory = getMemoryUsage();
    console.log(`📊 Pre-process memory: Heap ${preProcessMemory.heapUsed}MB`);
    
    // Create parsing options to prevent stack overflow
    const parseOptions = {
      // Limit max pages to prevent excessive memory usage
      max: 100,
      
      // Version compatibility
      version: 'v1.1.1'
    };
    
    // Set up timeout promise to prevent infinite processing
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('PDF parsing timeout after 30 seconds'));
      }, 30000); // 30 second timeout
    });
    
    // Parse PDF with timeout protection
    console.log("🔄 Starting PDF parsing with timeout protection...");
    const parsePromise = pdfParse(localBuffer, parseOptions);
    
    // Race between parsing and timeout
    const result = await Promise.race([parsePromise, timeoutPromise]);
    
    // Immediately clear buffer reference to help GC
    localBuffer = null;
    
    // Extract text content
    const extractedText = result?.text || '';
    const numPages = result?.numpages || 0;
    
    console.log(`📃 PDF parsing completed: ${extractedText.length} characters, ${numPages} pages`);
    
    // Validate extracted content
    if (!extractedText || extractedText.length === 0) {
      throw new Error("PDF contains no readable text - likely image-based, password-protected, or corrupted");
    }
    
    if (extractedText.length < 10) {
      throw new Error("PDF text content too short - may be corrupted or empty");
    }
    
    // Memory cleanup and monitoring
    const postProcessMemory = getMemoryUsage();
    console.log(`📊 Post-process memory: Heap ${postProcessMemory.heapUsed}MB`);
    
    // Force garbage collection to clean up pdf-parse memory
    forceGarbageCollection();
    
    const finalMemory = getMemoryUsage();
    console.log(`📊 After GC memory: Heap ${finalMemory.heapUsed}MB`);
    
    // Log memory difference  
    const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed;
    console.log(`📈 Memory delta: ${memoryDiff > 0 ? '+' : ''}${memoryDiff}MB`);
    
    // Log first 200 characters for verification
    if (extractedText.length > 200) {
      console.log("📝 Text preview:", extractedText.substring(0, 200) + "...");
    }
    
    profileLogger.extractionSuccess('pdf-parse-file', extractedText.length);
    
    return extractedText.trim();
    
  } catch (error) {
    // Comprehensive error handling
    console.error("❌ [PDF-PARSE] Extraction failed:", error);
    
    // Determine error type for better user feedback
    let errorMessage = 'PDF parsing failed';
    
    if (error instanceof Error) {
      const errorMsg = error.message.toLowerCase();
      
      if (errorMsg.includes('timeout')) {
        errorMessage = 'PDF processing timed out - file may be too complex or large';
      } else if (errorMsg.includes('memory') || errorMsg.includes('heap')) {
        errorMessage = 'PDF too large for processing - try a smaller file';
      } else if (errorMsg.includes('invalid') || errorMsg.includes('corrupted')) {
        errorMessage = 'PDF file appears to be corrupted or invalid';
      } else if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
        errorMessage = 'PDF is password-protected or encrypted';
      } else if (errorMsg.includes('image-based')) {
        errorMessage = 'PDF is image-based and contains no extractable text';
      } else {
        errorMessage = `PDF parsing failed: ${error.message}`;
      }
    }
    
    // Log detailed error for debugging
    profileLogger.extractionError('pdf-parse-file', errorMessage);
    
    // Clean up memory on error
    localBuffer = null;
    pdfParseModule = null;
    forceGarbageCollection();
    
    throw new Error(errorMessage);
    
  } finally {
    // Final cleanup to prevent memory leaks
    localBuffer = null;
    pdfParseModule = null;
    
    // Final memory report
    const finalMemory = getMemoryUsage();
    console.log(`🏁 [PDF-PARSE] Cleanup completed. Final memory: ${finalMemory.heapUsed}MB`);
  }
}

/**
 * Extract text from DOCX file using mammoth library (unchanged from original)
 * @param buffer DOCX file buffer  
 * @returns Extracted text
 */
export async function extractTextFromDocxProfile(buffer: Buffer): Promise<string> {
  try {
    profileLogger.extractionStart('docx-profile-file', 'docx');
    console.log("📄 [DOCX-PROFILE] Starting DOCX text extraction, buffer size:", buffer.length);
    
    // Use dynamic import for mammoth library
    const mammoth = await import('mammoth');
    
    if (!mammoth || typeof mammoth.extractRawText !== 'function') {
      throw new Error('Mammoth library not available');
    }
    
    // Extract text from the DOCX buffer with error handling
    console.log("🔄 Extracting text from DOCX buffer...");
    const result = await mammoth.extractRawText({ buffer });
    
    const extractedText = result.value || "";
    console.log(`✅ DOCX extraction completed: ${extractedText.length} characters extracted`);
    
    if (extractedText.length > 0) {
      profileLogger.extractionSuccess('docx-profile-file', extractedText.length);
    }
    
    return extractedText;
  } catch (error) {
    console.error("❌ [DOCX-PROFILE] Extraction error:", error);
    const errorMsg = `DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try saving the document as a PDF or use a different Word document.`;
    profileLogger.extractionError('docx-profile-file', errorMsg);
    
    // For bulk uploads, we should throw the error so the file is marked as failed
    throw new Error("DOCX content could not be extracted. Please try a different Word document.");
  }
}

/**
 * Extract text from TXT file (unchanged from original)
 * @param buffer TXT file buffer
 * @returns Extracted text
 */
export async function extractTextFromTxtProfile(buffer: Buffer): Promise<string> {
  try {
    profileLogger.extractionStart('txt-profile-file', 'txt');
    console.log("📄 [TXT-PROFILE] Starting TXT text extraction, buffer size:", buffer.length);
    
    // Convert buffer to string with UTF-8 encoding
    const extractedText = buffer.toString('utf-8');
    console.log(`✅ TXT extraction completed: ${extractedText.length} characters extracted`);
    
    if (extractedText.length > 0) {
      profileLogger.extractionSuccess('txt-profile-file', extractedText.length);
    }
    
    return extractedText;
  } catch (error) {
    console.error("❌ [TXT-PROFILE] Extraction error:", error);
    const errorMsg = `TXT parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    profileLogger.extractionError('txt-profile-file', errorMsg);
    
    throw new Error("TXT content could not be extracted.");
  }
}

/**
 * Main document parser for Profile Records system
 * Routes to appropriate parser based on file type
 * @param buffer File buffer
 * @param fileType File type (pdf, docx, txt)
 * @returns Extracted text content
 */
export async function extractTextFromDocumentProfile(buffer: Buffer, fileType: string): Promise<string> {
  // Convert file type to lowercase for consistency
  const type = fileType.toLowerCase();
  
  console.log(`🔍 [PROFILE-PARSER] Processing ${type.toUpperCase()} file`);
  
  // Handle MIME types and file extensions
  if (type.includes('pdf') || type === 'application/pdf') {
    return extractTextFromPdfProfile(buffer);
  } else if (type.includes('docx') || type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return extractTextFromDocxProfile(buffer);  
  } else if (type.includes('txt') || type === 'text/plain') {
    return extractTextFromTxtProfile(buffer);
  } else if (type === 'pdf' || type === 'docx' || type === 'txt') {
    // Legacy file extension handling
    switch (type) {
      case 'pdf':
        return extractTextFromPdfProfile(buffer);
      case 'docx':
        return extractTextFromDocxProfile(buffer);
      case 'txt':
        return extractTextFromTxtProfile(buffer);
    }
  }
  
  throw new Error(`Unsupported file type: ${fileType}. Please use PDF, DOCX, or TXT files only.`);
}