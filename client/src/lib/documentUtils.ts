/**
 * Client-side document processing utilities
 * These functions extract text from resume files directly in the browser
 */

/**
 * Reads the content of a file as text or ArrayBuffer based on the file type
 */
async function readFileData(file: File): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target?.result) {
        resolve(event.target.result);
      } else {
        reject(new Error("Failed to read file"));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    // Read as text for .txt files, ArrayBuffer for binary files
    if (file.name.toLowerCase().endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
}

/**
 * PDF extraction is complex and requires libraries
 * This simplified version just delegates to the server
 */
async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  // For PDF extraction, we'll use server-side processing
  // PDF.js can be complex to set up in the browser
  console.log("PDF extraction requires server-side processing");
  throw new Error("PDF extraction requires server-side processing");
}

/**
 * Extracts text from a DOCX file
 * This is a simple approximation as browser-based DOCX parsing is limited
 * For production use, server-side extraction is more reliable
 */
async function extractDocxText(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // This is a simplified approach - proper DOCX parsing in the browser
    // requires more complex libraries or server-side processing
    const decoder = new TextDecoder('utf-8');
    const bytes = new Uint8Array(arrayBuffer);
    
    // DOCX files are zip files, so look for text content
    // This is a very naive approach and won't work for all DOCX files
    // It looks for text chunks between XML tags
    const content = decoder.decode(bytes);
    
    // Extract text between XML paragraph tags
    const textMatches = content.match(/<w:t>(.*?)<\/w:t>/g) || [];
    const extractedText = textMatches
      .map(match => match.replace(/<\/?w:t>/g, ''))
      .join(' ');
    
    if (extractedText.length > 100) {
      return extractedText;
    }
    
    // If the simple approach fails, notify the user
    throw new Error('Browser-based DOCX parsing is limited. Try a PDF or TXT file instead.');
  } catch (error) {
    console.error('DOCX extraction error:', error);
    throw new Error('Failed to extract text from DOCX. Try uploading a PDF file instead.');
  }
}

/**
 * Main function to extract text from a document file (pdf, docx, txt)
 */
export async function extractDocumentText(file: File): Promise<string> {
  try {
    console.log(`Starting extraction for file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
    
    // Determine file type based on extension
    const fileType = file.name.split('.').pop()?.toLowerCase();
    console.log(`Detected file type: ${fileType}`);
    
    if (!fileType) {
      throw new Error("Unknown file type");
    }
    
    // Read the file data
    const fileData = await readFileData(file);
    
    // Extract text based on file type
    let extractedText = '';
    
    if (fileType === 'txt') {
      // Text files can be used directly
      extractedText = fileData as string;
    } else if (fileType === 'pdf') {
      // For PDFs, we need to fallback to server-side processing
      // as PDF.js might not be available
      extractedText = await callServerExtraction(file);
    } else if (fileType === 'docx') {
      // For DOCX, we need to fallback to server-side processing
      extractedText = await callServerExtraction(file);
    } else {
      throw new Error(`Unsupported file type: ${fileType}. Please use PDF, DOCX, or TXT files.`);
    }
    
    console.log(`Extracted ${extractedText.length} characters of text`);
    
    return extractedText;
  } catch (error) {
    console.error("Document extraction error:", error);
    
    // Fallback to server-side extraction
    if (error instanceof Error && !error.message.includes("server-side")) {
      console.log("Falling back to server-side extraction...");
      return callServerExtraction(file);
    }
    
    throw error;
  }
}

/**
 * Fallback function that calls the server API for document extraction
 */
async function callServerExtraction(file: File): Promise<string> {
  try {
    console.log("Using server-side extraction for document...");
    
    // Create a FormData object for file upload
    const formData = new FormData();
    formData.append("file", file);
    
    // Call the server API
    const response = await fetch('/api/parse-document', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server extraction failed: ${errorText}`);
    }
    
    // Extract text from the server's response
    const result = await response.json();
    
    if (!result.success || !result.text) {
      throw new Error("Document parsing failed on server");
    }
    
    console.log(`Server extracted ${result.text.length} characters`);
    
    // Use the extracted text from the server
    return result.text;
  } catch (error) {
    console.error("Server extraction error:", error);
    throw new Error(`Server-side extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}