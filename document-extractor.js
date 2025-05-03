/**
 * Utility for extracting text from DOCX files
 */
const fs = require('fs');
const mammoth = require('mammoth');

/**
 * Extract text from a DOCX file
 * @param {Buffer} buffer - The document buffer
 * @returns {Promise<string>} The extracted text
 */
async function extractTextFromDocxBuffer(buffer) {
  try {
    // Extract raw text from the buffer
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error) {
    console.error('Error extracting text from DOCX buffer:', error);
    return '';
  }
}

/**
 * Extract text from a DOCX file on disk
 * @param {string} filePath - Path to the DOCX file
 * @returns {Promise<string>} The extracted text
 */
async function extractTextFromDocxFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    
    const buffer = fs.readFileSync(filePath);
    return extractTextFromDocxBuffer(buffer);
  } catch (error) {
    console.error('Error extracting text from DOCX file:', error);
    return '';
  }
}

module.exports = {
  extractTextFromDocxBuffer,
  extractTextFromDocxFile
};