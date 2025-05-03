/**
 * Document processing module
 * 
 * This module provides basic document parsing functionality for resume uploads.
 * All AI-based analysis and matching functions have been removed.
 */

import * as fs from 'fs';
import * as path from 'path';

console.log("Document processing module loaded - analysis features removed");

// Basic interface for resume data structure when storing resumes
export interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
  fileName?: string;
}

// Interface for API response when only basic info is needed
export interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  technicalGaps?: string[];
  matchingSkills?: string[];
  missingSkills?: string[];
  clientExperience?: string;
  confidence?: number;
}

/**
 * Document parser with robust PDF and DOCX handling
 * Simplified to handle basic resume file parsing
 */
export async function parseDocument(buffer: Buffer, fileType: string): Promise<string> {
  try {
    console.log(`Parsing document of type: ${fileType}, buffer size: ${buffer.length} bytes`);

    if (fileType === 'pdf') {
      try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(buffer);
        const extractedText = data.text || "";
        console.log(`PDF parsing successful. Extracted ${extractedText.length} characters.`);
        return extractedText;
      } catch (error) {
        console.error("Failed to parse PDF:", error);
        throw new Error("PDF parsing failed. The file may be corrupted or password-protected.");
      }
    } else if (fileType === 'docx' || fileType === 'doc') {
      try {
        // First try mammoth for DOCX files
        const mammoth = require('mammoth');
        let extractedText = "";
        
        try {
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value || "";
          console.log(`DOCX parsing with mammoth successful. Extracted ${extractedText.length} characters.`);
        } catch (mammothError) {
          console.error("Mammoth extraction failed, attempting fallback method:", mammothError);
          
          // Fallback method for older DOC files or problematic DOCX files
          const fs = require('fs');
          const path = require('path');
          const os = require('os');
          const { exec } = require('child_process');
          const util = require('util');
          const execPromise = util.promisify(exec);
          
          // Create a temporary file
          const tempDir = os.tmpdir();
          const tempFilePath = path.join(tempDir, `temp-${Date.now()}.docx`);
          
          try {
            // Write the buffer to a temporary file
            fs.writeFileSync(tempFilePath, buffer);
            
            // Use the extract-resume.js script as a fallback
            const extractScriptPath = path.resolve('./extract-resume.js');
            const { stdout } = await execPromise(`node ${extractScriptPath} ${tempFilePath}`);
            
            extractedText = stdout || "";
            console.log(`DOCX parsing with fallback successful. Extracted ${extractedText.length} characters.`);
            
            // Clean up the temporary file
            fs.unlinkSync(tempFilePath);
          } catch (fallbackError) {
            console.error("Fallback extraction failed:", fallbackError);
            throw new Error("Document parsing failed with both primary and fallback methods");
          }
        }
        
        return extractedText;
      } catch (error) {
        console.error("Failed to parse DOCX:", error);
        throw new Error("DOCX parsing failed. The file may be corrupted or in an unsupported format.");
      }
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error("Document parsing error:", error);
    throw error;
  }
}

/**
 * Simple resume text extraction - returns minimal placeholder data
 * This replaces the AI-powered analysis with a basic function that just
 * provides the minimal required structure without actual analysis
 */
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  const { sanitizeHtml } = await import('./utils');
  
  // Remove HTML/XML content if present
  if (resumeText.trim().startsWith('<!DOCTYPE') || resumeText.includes('<?xml')) {
    resumeText = resumeText.replace(/<!DOCTYPE[^>]*>/gi, '')
                      .replace(/<\?xml[^>]*\?>/gi, '')
                      .replace(/<!--[\s\S]*?-->/g, '')
                      .replace(/<[^>]*>?/g, ' ');
  }
  
  // Sanitize and truncate text
  const sanitizedText = sanitizeHtml(resumeText).substring(0, 5000);
  
  // Return a basic structure with empty fields
  return {
    clientNames: [],
    jobTitles: [],
    relevantDates: [],
    skills: [],
    education: [],
    extractedText: sanitizedText
  };
}

/**
 * Simple job match function that returns default values
 * This replaces the AI-powered matching with a placeholder
 */
export function matchResumeToJob(resumeText: string, jobDescription: string): MatchScoreResult {
  return {
    score: 0, // No score since analysis is disabled
    strengths: [],
    weaknesses: ["Resume analysis is disabled"],
    suggestions: ["Manual evaluation required"],
    technicalGaps: [],
    matchingSkills: [],
    missingSkills: [],
    clientExperience: "",
    confidence: 0
  };
}