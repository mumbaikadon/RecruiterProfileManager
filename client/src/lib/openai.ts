import { apiRequest } from "./queryClient";

interface MatchScoreResult {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

interface ResumeAnalysisResult {
  clientNames: string[];
  jobTitles: string[];
  relevantDates: string[];
  skills: string[];
  education: string[];
  extractedText: string;
}

// Mock implementation that would be replaced with actual OpenAI API calls
// This simulates what would happen when we process text with AI
export async function analyzeResumeText(resumeText: string): Promise<ResumeAnalysisResult> {
  // In a real implementation, this would make an API call to OpenAI
  // For now we'll return simulated data based on resume text patterns

  const clientNamesPattern = /(?:client|worked for|project with)\s+([A-Z][a-z]+ (?:[A-Z][a-z]+)?)/g;
  const jobTitlesPattern = /(?:as|position|title|role):\s*([A-Z][a-z]+ [A-Za-z ]+(?:Developer|Engineer|Manager|Designer|Architect))/g;
  const datesPattern = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}/g;
  const skillsPattern = /(?:React|Angular|Vue|JavaScript|TypeScript|Java|Python|SQL|AWS|Azure|DevOps|Node\.js|Express|MongoDB)/g;
  const educationPattern = /(?:University|College|Bachelor|Master|PhD|BS|MS|BA|MBA)/g;

  // Extract data using regex
  const clientNames = Array.from(
    new Set((resumeText.match(clientNamesPattern) || []).map(match => match.replace(/(?:client|worked for|project with)\s+/, "")))
  ).slice(0, 5);
  
  const jobTitles = Array.from(
    new Set((resumeText.match(jobTitlesPattern) || []).map(match => match.replace(/(?:as|position|title|role):\s*/, "")))
  ).slice(0, 5);
  
  const relevantDates = Array.from(
    new Set(resumeText.match(datesPattern) || [])
  ).slice(0, 10);
  
  const skills = Array.from(
    new Set(resumeText.match(skillsPattern) || [])
  );
  
  const education = Array.from(
    new Set(resumeText.match(educationPattern) || [])
  ).slice(0, 3);

  return {
    clientNames,
    jobTitles,
    relevantDates,
    skills,
    education,
    extractedText: resumeText.substring(0, 1000) // Storing first 1000 chars as a sample
  };
}

export async function matchResumeToJob(
  resumeText: string, 
  jobDescription: string
): Promise<MatchScoreResult> {
  // In a real implementation, this would be an OpenAI API call
  // Here we're just doing a simplified keyword matching

  // Convert texts to lowercase for better matching
  const resumeLower = resumeText.toLowerCase();
  const jobLower = jobDescription.toLowerCase();

  // Extract important keywords from job description (simplified approach)
  const keywordExtractor = /\b([a-z]+(?:\s[a-z]+)?)\b/g;
  const jobKeywords = Array.from(
    new Set(jobLower.match(keywordExtractor) || [])
  ).filter(word => 
    word.length > 4 && 
    !['with', 'that', 'this', 'have', 'will', 'about', 'from'].includes(word)
  );

  // Count matches
  let matches = 0;
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  jobKeywords.forEach(keyword => {
    if (resumeLower.includes(keyword)) {
      matches++;
      // Add some of the matches as strengths
      if (Math.random() > 0.7) {
        strengths.push(`Experience with ${keyword}`);
      }
    } else {
      // Add some of the misses as weaknesses
      if (Math.random() > 0.7) {
        weaknesses.push(`No mention of ${keyword}`);
      }
    }
  });

  // Calculate score as percentage
  const score = Math.min(100, Math.max(0, Math.round((matches / jobKeywords.length) * 100)));

  // Generate suggestions based on weaknesses
  const suggestions = weaknesses
    .slice(0, 3)
    .map(weakness => `Consider highlighting experience with ${weakness.replace('No mention of ', '')}`);

  // Limit the arrays to reasonable sizes
  return {
    score,
    strengths: strengths.slice(0, 5),
    weaknesses: weaknesses.slice(0, 5),
    suggestions: suggestions.slice(0, 3)
  };
}

// In a real implementation, this function would make server-side calls to OpenAI
// For this demo, we'll process on the client side
export async function analyzeResume(file: File): Promise<{
  analysis: ResumeAnalysisResult;
  text: string;
}> {
  // Simulate file reading and text extraction
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async function (e) {
      let text = '';
      
      if (typeof e.target?.result === 'string') {
        text = e.target.result;
      } else {
        text = "Sample resume content for demonstration purposes.";
      }
      
      // Add some random content to simulate a resume
      if (text.length < 100) {
        text += `
          Professional Experience:
          
          Senior Frontend Developer at Microsoft
          Jan 2019 - Present
          - Developed React components and Redux state management
          - Implemented TypeScript across the codebase
          - Worked on Azure DevOps integration
          
          Software Engineer at Amazon
          Mar 2015 - Dec 2018
          - Built responsive web applications using Angular
          - Designed RESTful APIs with Node.js and Express
          - Implemented CI/CD pipelines
          
          Education:
          
          Master of Computer Science, Stanford University
          Bachelor of Science in Computer Engineering, MIT
        `;
      }
      
      const analysis = await analyzeResumeText(text);
      resolve({
        analysis,
        text
      });
    };
    
    reader.readAsText(file);
  });
}
