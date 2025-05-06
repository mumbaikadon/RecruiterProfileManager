/**
 * Test script for the business analyst domain-specific expertise analysis
 * This will analyze Drew's resume against a Business Systems Analyst job description
 */

import fs from 'fs';
import path from 'path';
import { OpenAI } from 'openai';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract text from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromPdf(filePath) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    return pdfData.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Extract text from a DOCX file
 * @param {string} filePath - Path to the DOCX file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromDocx(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw error;
  }
}

/**
 * Extract text from a file based on its extension
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  if (extension === '.pdf') {
    return extractTextFromPdf(filePath);
  } else if (extension === '.docx') {
    return extractTextFromDocx(filePath);
  } else if (extension === '.txt') {
    return fs.readFileSync(filePath, 'utf8');
  } else {
    throw new Error(`Unsupported file format: ${extension}`);
  }
}

/**
 * Analyze a resume with OpenAI for business analyst domain-specific expertise
 * @param {string} resumeText - The extracted resume text
 * @param {string} jobDescription - The business analyst job description
 */
async function analyzeBaDomainExpertise(resumeText, jobDescription) {
  try {
    console.log("Starting OpenAI analysis...");
    
    // Business Analyst specific prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer specializing in business analysis roles. " +
            "Your strength is identifying specific, nuanced gaps between a candidate's business analysis experience and job requirements. " +
            "You are precise in identifying domain-specific missing expertise rather than generic skill gaps. " +
            "For business analyst roles, identify domain-specific gaps like 'Insufficient experience with specific process modeling notations such as BPMN' rather than general skills like 'system diagramming'."
        },
        {
          role: "user",
          content: 
            `I need you to analyze this resume for compatibility with the following business analyst job description, with special focus on business analysis domain expertise gaps.
            
            Resume:
            ${resumeText}
            
            Job Description:
            ${jobDescription}
            
            IMPORTANT - ANALYSIS INSTRUCTIONS:
            1. Identify detailed, domain-specific business analysis expertise gaps between the resume and job requirements
            2. For each significant gap, provide specific details about:
               a) The precise nature of the business analysis expertise gap
               b) The level of importance (critical, important, nice-to-have)
               c) Why this specific business analysis expertise matters for this role
               d) Specific suggestions to address the gap
            3. Calculate an overall domain knowledge score (0-100) for business analysis expertise
            
            Return your analysis in a structured JSON format with the following fields:
            - domainExpertiseGaps (array of business analysis specific expertise gaps)
            - domainKnowledgeScore (number 0-100 indicating business analysis domain knowledge level)
            - gapDetails: [
                {
                  category: string (e.g., "Business Process Modeling", "Requirements Elicitation")
                  gaps: string[] (Business analysis specific gaps in this category)
                  importance: string (Critical, Important, or Nice-to-have)
                  impact: string (How this domain expertise gap impacts the role)
                  suggestions: string[] (Ways to address this domain-specific gap)
                }
              ]
            - strengths: string[] (Key business analysis strengths for this role)
            - overallScore: number (0-100)`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000,
    });
    
    console.log("OpenAI analysis completed");
    
    // Parse the response content
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    // Display the domain expertise analysis in a formatted way
    displayDomainExpertiseAnalysis(analysisResult);
    
    return analysisResult;
  } catch (error) {
    console.error("Error during OpenAI analysis:", error);
    throw error;
  }
}

/**
 * Display domain expertise analysis in a formatted way
 * @param {object} result - The analysis result
 */
function displayDomainExpertiseAnalysis(result) {
  console.log("\n======== BUSINESS ANALYST DOMAIN EXPERTISE ANALYSIS ========\n");
  
  // Domain knowledge score
  console.log(`Domain Knowledge Score: ${result.domainKnowledgeScore}/100`);
  console.log("├" + "─".repeat(Math.floor(result.domainKnowledgeScore / 2)) + "┤");
  console.log("0                  50                  100");
  
  // Score interpretation
  let scoreInterpretation = "";
  if (result.domainKnowledgeScore >= 70) {
    scoreInterpretation = "Strong business analysis knowledge - Candidate has solid expertise";
  } else if (result.domainKnowledgeScore >= 40) {
    scoreInterpretation = "Moderate business analysis knowledge - Some domain-specific gaps exist";
  } else {
    scoreInterpretation = "Limited business analysis knowledge - Significant expertise gaps";
  }
  console.log(`Interpretation: ${scoreInterpretation}\n`);
  
  // Domain expertise gaps
  console.log("BUSINESS ANALYSIS EXPERTISE GAPS:");
  console.log("-------------------------------");
  result.domainExpertiseGaps.forEach((gap, i) => {
    console.log(`${i+1}. ${gap}`);
  });
  
  // Detailed gap analysis
  console.log("\nDETAILED GAP ANALYSIS BY CATEGORY:");
  console.log("----------------------------------");
  result.gapDetails.forEach((category, i) => {
    console.log(`\n[${category.importance}] ${category.category}`);
    console.log(`Impact: ${category.impact}`);
    
    console.log("\nSpecific Gaps:");
    category.gaps.forEach((gap, j) => {
      console.log(`  • ${gap}`);
    });
    
    console.log("\nSuggestions:");
    category.suggestions.forEach((suggestion, j) => {
      console.log(`  ✓ ${suggestion}`);
    });
    
    if (i < result.gapDetails.length - 1) {
      console.log("\n" + "-".repeat(50));
    }
  });
  
  // Key strengths
  console.log("\nKEY BUSINESS ANALYSIS STRENGTHS:");
  console.log("-------------------------------");
  result.strengths.forEach((strength, i) => {
    console.log(`${i+1}. ${strength}`);
  });
}

/**
 * Main function to run the test
 */
async function main() {
  try {
    console.log("Starting Business Analyst domain expertise analysis test...");
    
    // Path to Drew's resume
    const resumePath = new URL('./attached_assets/Drew Corrigan - CV.pdf', import.meta.url).pathname;
    
    // Business Analyst job description
    const bsaJobDescription = `
    Business Systems Analyst Position
    
    We are seeking an experienced Business Systems Analyst to help optimize our business processes and systems. The ideal candidate will have strong skills in business process modeling, requirements elicitation, and system diagramming. Experience with UML, BPMN, and gap analysis is required.
    
    Key Responsibilities:
    - Document complex business processes using BPMN and UML notations
    - Support architects in designing system solutions that meet business needs
    - Perform gap analysis between current and future state processes
    - Elicit and document detailed business requirements from stakeholders
    - Create user stories and acceptance criteria for development teams
    - Validate that implemented solutions meet business requirements
    
    Requirements:
    - 5+ years of experience as a Business Analyst or Systems Analyst
    - Strong knowledge of business process modeling techniques (BPMN, UML)
    - Experience supporting system architects in solution design
    - Expertise in requirements elicitation and documentation
    - Familiarity with agile methodologies and user story creation
    - Strong communication and stakeholder management skills
    `;
    
    // Extract text from Drew's resume
    console.log(`Extracting text from ${resumePath}...`);
    const resumeText = await extractTextFromFile(resumePath);
    console.log(`Successfully extracted ${resumeText.length} characters from resume`);
    
    // Analyze for business analyst domain expertise
    await analyzeBaDomainExpertise(resumeText, bsaJobDescription);
    
  } catch (error) {
    console.error("Error in main function:", error);
  }
}

// Run the main function
main();