/**
 * Debug script for resume parsing and employment history extraction
 * This standalone script helps diagnose issues in the processing pipeline
 */
const fs = require('fs');
const { OpenAI } = require('openai');
const path = require('path');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function extractTextFromFile(filePath) {
  console.log(`Reading file: ${filePath}`);
  
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    let text = '';
    
    if (fileExt === '.docx') {
      console.log('Extracting text from DOCX...');
      const result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (fileExt === '.pdf') {
      console.log('Extracting text from PDF...');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else if (fileExt === '.txt') {
      console.log('Reading text file...');
      text = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error(`Unsupported file type: ${fileExt}`);
    }
    
    console.log(`Successfully extracted ${text.length} characters`);
    console.log('First 300 characters:');
    console.log(text.substring(0, 300));
    
    return text;
  } catch (error) {
    console.error('Error extracting text:', error);
    throw error;
  }
}

async function analyzeEmploymentHistory(resumeText) {
  console.log('Analyzing employment history with OpenAI...');
  console.log(`Resume text length: ${resumeText.length} characters`);
  
  try {
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
            `I need you to analyze this resume for employment history data.
            
            Resume:
            ${resumeText}
            
            IMPORTANT - EMPLOYMENT HISTORY EXTRACTION INSTRUCTIONS:
            1. Carefully read the entire resume text
            2. Search for sections labeled "Experience", "Work Experience", "Professional Experience", "Employment History", etc.
            3. Extract the following from these sections EXACTLY as they appear in the resume - do not generate or fabricate data:
               - clientNames: Array of company/employer names the candidate worked for (most recent first)
               - jobTitles: Array of job titles/positions held by the candidate (most recent first)
               - relevantDates: Array of employment periods (most recent first)
            
            Return your analysis in a structured JSON format with the following fields:
            - clientNames (array of strings: extract EXACT company names from the resume)
            - jobTitles (array of strings: extract EXACT job titles from the resume)
            - relevantDates (array of strings: extract EXACT date ranges from the resume)
            
            NOTICE: It is critical that you extract only actual employment data from the resume. NEVER invent company names, job titles, or dates. If you cannot find employment history, return empty arrays.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.5,
      max_tokens: 2000,
    });
    
    // Parse the OpenAI response
    console.log('OpenAI response received');
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    // Log the employment history data
    console.log('\n----- EXTRACTED EMPLOYMENT HISTORY -----');
    console.log('Client Names:', JSON.stringify(analysisResult.clientNames || [], null, 2));
    console.log('Job Titles:', JSON.stringify(analysisResult.jobTitles || [], null, 2));
    console.log('Relevant Dates:', JSON.stringify(analysisResult.relevantDates || [], null, 2));
    
    return analysisResult;
  } catch (error) {
    console.error('Error analyzing employment history:', error);
    throw error;
  }
}

async function main() {
  try {
    // Specify the path to the file you want to analyze
    const filePath = './attached_assets/sanjeevChapagain..pdf';
    
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      return;
    }
    
    // Extract text from the file
    const resumeText = await extractTextFromFile(filePath);
    
    // Save extracted text to a file for inspection
    fs.writeFileSync('extracted_resume_text.txt', resumeText);
    console.log('Full text saved to: extracted_resume_text.txt');
    
    // Analyze employment history
    await analyzeEmploymentHistory(resumeText);
    
  } catch (error) {
    console.error('Error in main process:', error);
  }
}

// Run the main function
main();