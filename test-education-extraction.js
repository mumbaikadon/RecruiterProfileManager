/**
 * Test script for debugging education data extraction
 * This will analyze Punnya's resume and check if education data is properly extracted
 */

import { OpenAI } from 'openai';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check for OpenAI API key
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze a resume with OpenAI to extract education information
 * @param {string} resumeText - The extracted resume text
 */
async function analyzeResumeEducation(resumeText) {
  try {
    console.log(`Analyzing resume text (${resumeText.length} chars)...`);
    console.log("Text preview:", resumeText.substring(0, 200) + "...");
    
    // Create a focused prompt for education extraction
    const prompt = `
    You are an expert resume parser specializing in extracting structured education information from resumes.
    
    Please analyze the following resume and extract ONLY the education information in this format:
    1. Parse all degrees, educational institutions, and graduation years
    2. Format each entry as: "Degree, Institution, Year" (or as much info as is available)
    3. Return ONLY a JSON array of education items with no other commentary
    
    Resume text:
    ${resumeText}
    `;
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are an expert resume parser that extracts only education information from resumes." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 500,
    });
    
    // Get the response text
    const responseText = response.choices[0].message.content.trim();
    console.log("Raw OpenAI response:", responseText);
    
    // Try to parse the JSON response
    try {
      const education = JSON.parse(responseText);
      console.log("Parsed education data:", education);
      console.log("Education data type:", typeof education);
      console.log("Is education an array?", Array.isArray(education));
      console.log("Education entries:", education.length);
      return education;
    } catch (parseError) {
      console.error("Error parsing OpenAI response as JSON:", parseError);
      console.log("Raw response was:", responseText);
      return [];
    }
  } catch (error) {
    console.error("Error analyzing resume with OpenAI:", error);
    return [];
  }
}

/**
 * Main function to run the test
 */
async function main() {
  try {
    // Load the resume text - replace with path to Punnya's resume or use sample data
    let resumeText;
    
    try {
      // Try to load from file if available
      resumeText = await fs.readFile(path.join(process.cwd(), 'extracted_resume.txt'), 'utf8');
    } catch (fileError) {
      console.log("Could not load resume file, using sample data instead");
      // Sample data from logs
      resumeText = `Punnya Dhakal
Email: punnya267@gmail.com
Contact: (720) 778-0096LinkedIn: https://www.linkedin.com/in/punnya-dhakal-3852471a5/                                           
PROFESSIONAL SUMMARY:
Skilled Full Stack developer, with a focus on creating various web and client/server applications using Java, Spring Boot, and related technologies. 

EDUCATION:
Bachelor's in Computer Science from Tribhuvan University, Nepal 2011`;
    }
    
    // Analyze the resume text
    const educationData = await analyzeResumeEducation(resumeText);
    
    // Log the results
    console.log("\n===== EDUCATION EXTRACTION TEST RESULTS =====");
    console.log("Education data extracted:", educationData);
    console.log("Is data in the expected format?", Array.isArray(educationData));
    
    // Verify against our schema
    const resumeDataPayload = {
      candidateId: 999, // Test ID
      education: educationData,
    };
    
    console.log("\nResume data payload for database:", resumeDataPayload);
    console.log("Education field type:", typeof resumeDataPayload.education);
    console.log("Is education an array?", Array.isArray(resumeDataPayload.education));
    
    // Success message
    console.log("\nTest completed successfully!");
  } catch (error) {
    console.error("Error running test:", error);
  }
}

// Run the test
main();