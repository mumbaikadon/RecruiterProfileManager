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
        return data.text || "";
      } catch (error) {
        console.error("Failed to parse PDF:", error);
        throw new Error("PDF parsing failed");
      }
    } else if (fileType === 'docx') {
      try {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || "";
      } catch (error) {
        console.error("Failed to parse DOCX:", error);
        throw new Error("DOCX parsing failed");
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