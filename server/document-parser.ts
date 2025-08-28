import type { Buffer } from 'node:buffer';
import path from 'path';

/**
 * Extract text from a PDF file using pdf-parse
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    console.log(`PDF extraction: Processing buffer of size ${buffer.length} bytes`);
    const pdf = await import('pdf-parse/lib/pdf-parse.js');
    const pdfParse = pdf.default || pdf;
    const data = await pdfParse(buffer);
    console.log(`PDF extraction successful: Extracted ${data.text?.length || 0} characters`);
    return data.text || "";
  } catch (error) {
    console.error("PDF extraction error:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract text from a DOCX file using mammoth
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (error) {
    console.error("DOCX extraction error:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}

/**
 * Extract text from a TXT file
 */
export function extractTextFromTxt(buffer: Buffer): string {
  return buffer.toString('utf8');
}

/**
 * Extract text from a document file (pdf, docx, txt)
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  fileType: string
): Promise<string> {
  console.log(`Document extraction: Processing ${fileType} file of size ${buffer.length} bytes`);
  
  // Handle file type which might be a MIME type or file extension
  const type = fileType.toLowerCase();
  
  // Handle case where fileType might be a filename with extension
  if (fileType.includes('.')) {
    const extension = path.extname(fileType).toLowerCase().replace('.', '');
    if (extension === 'pdf') return extractTextFromPdf(buffer);
    if (extension === 'docx') return extractTextFromDocx(buffer);
    if (extension === 'txt') return extractTextFromTxt(buffer);
  }

  // Handle by MIME type or direct type string
  switch (type) {
    case "pdf":
    case "application/pdf":
      return extractTextFromPdf(buffer);
    case "docx":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return extractTextFromDocx(buffer);
    case "txt":
    case "text/plain":
      return extractTextFromTxt(buffer);
    default:
      console.error(`Unsupported file type: ${fileType}`);
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}