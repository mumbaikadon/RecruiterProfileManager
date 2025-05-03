import fs from 'fs';
import mammoth from 'mammoth';
import { fileURLToPath } from 'url';
import path from 'path';
import OpenAI from 'openai';

// Initialize OpenAI with API key from environment
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractTextFromDocx(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({
      buffer: buffer
    });
    return result.value;
  } catch (error) {
    console.error("Error extracting text:", error);
    return null;
  }
}

async function analyzeResumeWithOpenAI(resumeText, jobDescription) {
  console.log("Sending resume to OpenAI for analysis");
  console.log(`Resume text length: ${resumeText.length} characters`);
  
  try {
    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
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
    
    // Display the employment history
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
    console.error("Error analyzing resume with OpenAI:", error);
    return null;
  }
}

async function main() {
  // Path to the resume file
  const resumePath = path.join(__dirname, 'attached_assets', 'Rajesh (1).docx');
  
  // Basic job description
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
  
  // Extract text from resume
  console.log("Extracting text from resume...");
  const resumeText = await extractTextFromDocx(resumePath);
  
  if (!resumeText) {
    console.error("Failed to extract text from resume");
    return;
  }
  
  console.log(`Successfully extracted ${resumeText.length} characters from resume`);
  
  // Analyze resume with OpenAI
  await analyzeResumeWithOpenAI(resumeText, jobDescription);
}

// Run the script
main().catch(console.error);