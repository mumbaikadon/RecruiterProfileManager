import fs from 'fs';
import OpenAI from 'openai';

// Initialize OpenAI client with API key
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Path to the extracted resume text
const resumeTextPath = './extracted_resume.txt';

// A sample job description for testing
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

async function analyzeResumeWithOpenAI() {
  try {
    // Read the resume text from file
    console.log('Reading resume text from file:', resumeTextPath);
    const resumeText = fs.readFileSync(resumeTextPath, 'utf8');
    console.log(`Resume text loaded: ${resumeText.length} characters`);
    
    console.log('Sending to OpenAI for analysis...');
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
    
    // Extract and parse the response
    const analysisResult = JSON.parse(response.choices[0].message.content);
    
    // Save the entire analysis to a file
    fs.writeFileSync('openai_analysis_result.json', JSON.stringify(analysisResult, null, 2));
    console.log('Full analysis saved to: openai_analysis_result.json');
    
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
    console.error('Error analyzing resume with OpenAI:', error);
    return null;
  }
}

// Run the analysis
analyzeResumeWithOpenAI().then(result => {
  if (result) {
    console.log('Analysis complete successfully');
  } else {
    console.log('Analysis failed');
  }
});