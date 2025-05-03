// Direct implementation for document extraction and OpenAI analysis
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mammoth from 'mammoth';
import OpenAI from 'openai';

// Initialize OpenAI client with API key from environment
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the sample resume
const resumePath = path.join(__dirname, 'sample_resume.docx');

// Sample job description
const jobDescription = `
  We are looking for an experienced Java Full Stack Developer who can work on both frontend and backend technologies.
  Required Skills:
  - Java/J2EE, Spring Boot, Hibernate
  - RESTful API development
  - Frontend frameworks like React or Angular
  - Database experience with SQL and NoSQL
  - Agile/Scrum methodology
  - Experience with microservices architecture
  - 5+ years of professional software development experience
`;

// Extract text from the DOCX file
async function extractResumeText() {
  try {
    console.log('Reading DOCX resume file:', resumePath);
    const buffer = fs.readFileSync(resumePath);
    
    console.log('Extracting text with mammoth...');
    const result = await mammoth.extractRawText({
      buffer: buffer
    });
    
    const text = result.value;
    console.log(`Successfully extracted ${text.length} characters`);
    console.log('Preview:', text.substring(0, 300));
    
    // Save the extracted text to a file
    const textOutputPath = 'extracted_resume_text.txt';
    fs.writeFileSync(textOutputPath, text);
    console.log('Full text saved to:', textOutputPath);
    
    return text;
  } catch (error) {
    console.error('Error extracting resume text:', error);
    return null;
  }
}

// Analyze the resume with OpenAI
async function analyzeResumeWithOpenAI(resumeText) {
  try {
    console.log('Sending resume to OpenAI for analysis...');
    console.log(`Resume text length: ${resumeText.length} characters`);
    
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: 
            "You are an expert resume analyzer specializing in extracting accurate employment history from resumes. " +
            "Your primary task is to extract REAL employment data from the resume - never generate fake or generic data. " +
            "If you cannot find clear employment history, respond with empty arrays rather than making up placeholder data. " +
            "Extract exact company names, job titles, and employment dates directly from the resume text. " +
            "Be precise, accurate, and only use information actually present in the resume."
        },
        {
          role: "user",
          content: 
            `I need you to analyze this resume for compatibility with the following job description.
            
            Resume:
            ${resumeText}
            
            Job Description:
            ${jobDescription}
            
            IMPORTANT - EMPLOYMENT HISTORY EXTRACTION INSTRUCTIONS:
            1. Carefully read the entire resume text
            2. Search for sections labeled "Experience", "Work Experience", "Professional Experience", "Employment History", etc.
            3. Extract the following from these sections EXACTLY as they appear in the resume - do not generate or fabricate data:
               - clientNames: Array of company/employer names the candidate worked for (most recent first)
               - jobTitles: Array of job titles/positions held by the candidate (most recent first)
               - relevantDates: Array of employment periods (most recent first)
            
            2. Then analyze the fit between this resume and job description. Calculate an overall match percentage score (0-100).
            
            Return your analysis in a structured JSON format with the following fields:
            - clientNames (array of strings: extract EXACT company names from the resume)
            - jobTitles (array of strings: extract EXACT job titles from the resume)
            - relevantDates (array of strings: extract EXACT date ranges from the resume)
            - skillsGapAnalysis: { missingSkills (array), matchingSkills (array), suggestedTraining (array) }
            - relevantExperience (array of relevant experiences from the resume)
            - improvements: { content (array), formatting (array), language (array) }
            - overallScore (number 0-100)
            - confidenceScore (number 0-1)
            
            NOTICE: It is critical that you extract only actual employment data from the resume. NEVER invent company names, job titles, or dates. If you cannot find employment history, return empty arrays.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000,
    });
    
    // Parse the response
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    // Save the full response to a file
    fs.writeFileSync('openai_analysis.json', JSON.stringify(analysisResult, null, 2));
    console.log('Full analysis saved to: openai_analysis.json');
    
    // Print the employment history
    console.log("\n=== Employment History Extracted from Resume ===");
    
    if (analysisResult.clientNames && analysisResult.clientNames.length > 0) {
      console.log("\nCompanies/Employers:");
      analysisResult.clientNames.forEach((company, index) => {
        console.log(`${index + 1}. ${company}`);
      });
      
      console.log("\nJob Titles:");
      analysisResult.jobTitles.forEach((title, index) => {
        console.log(`${index + 1}. ${title}`);
      });
      
      console.log("\nEmployment Periods:");
      analysisResult.relevantDates.forEach((date, index) => {
        console.log(`${index + 1}. ${date}`);
      });
      
      console.log("\nOverall Match Score:", analysisResult.overallScore + "%");
    } else {
      console.log("No employment history data found in the resume");
    }
    
    return analysisResult;
  } catch (error) {
    console.error('Error analyzing resume with OpenAI:', error);
    return null;
  }
}

// Main function to run the process
async function main() {
  // Step 1: Extract text from resume
  const resumeText = await extractResumeText();
  
  if (!resumeText) {
    console.error('Failed to extract resume text');
    return;
  }
  
  // Step 2: Analyze the resume with OpenAI
  await analyzeResumeWithOpenAI(resumeText);
}

// Run the main function
main().catch(console.error);