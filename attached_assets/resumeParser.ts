import * as fs from 'fs';
import * as path from 'path';
import * as mammoth from 'mammoth';
import OpenAI from 'openai';

// Initialize pdf-parse with dynamic import to avoid test file issues
let pdfParser: any = null;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function initializePdfParser() {
  if (!pdfParser) {
    try {
      console.log('Initializing PDF parser...');
      // Try different import approaches to handle ESM/CJS compatibility
      try {
        const pdfParse = await import('pdf-parse');
        pdfParser = pdfParse.default;
        console.log('PDF parser initialized via default import');
      } catch (importErr) {
        console.log('Default import failed, trying alternative import path');
        try {
          const pdfParse = await import('pdf-parse/lib/pdf-parse.js');
          pdfParser = pdfParse.default;
          console.log('PDF parser initialized via specific path');
        } catch (specificImportErr) {
          console.log('Specific import failed, trying CommonJS require');
          // Last resort - try CommonJS require
          const pdfParse = require('pdf-parse');
          pdfParser = pdfParse;
          console.log('PDF parser initialized via CommonJS require');
        }
      }
      
      if (!pdfParser) {
        throw new Error('Could not initialize PDF parser through any method');
      }
    } catch (error) {
      console.error('Error initializing pdf-parse:', error);
      throw error;
    }
  }
  return pdfParser;
}

interface ParsedResume {
  experience: Array<{
    company: string;
    position: string;
    duration: string;
    responsibilities: string[];
  }>;
  skills: {
    technical: string[];
    soft: string[];
    certifications: string[];
  };
  education: Array<{
    degree: string;
    institution: string;
    year: string;
    details?: string;
  }>;
  projects: Array<{
    name: string;
    description: string;
    technologies: string[];
  }>;
}

/**
 * Parse a resume using AI capabilities when useAI flag is set
 */
async function parseResumeWithAI(text: string): Promise<ParsedResume> {
  try {
    console.log('Starting AI-powered resume parsing...');
    
    const prompt = `
    Extract structured information from the following resume text. 
    Format the response as a valid JSON object with the following structure:
    {
      "experience": [
        {
          "company": "Company name",
          "position": "Job title",
          "duration": "Employment period",
          "responsibilities": ["Responsibility 1", "Responsibility 2", ...]
        }
      ],
      "skills": {
        "technical": ["Skill 1", "Skill 2", ...],
        "soft": ["Skill 1", "Skill 2", ...],
        "certifications": ["Certification 1", "Certification 2", ...]
      },
      "education": [
        {
          "degree": "Degree name",
          "institution": "School name",
          "year": "Graduation year",
          "details": "Additional education details"
        }
      ],
      "projects": [
        {
          "name": "Project name",
          "description": "Project description",
          "technologies": ["Technology 1", "Technology 2", ...]
        }
      ]
    }

    Here's the resume text to parse:
    ${text}
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: [
        { role: "system", content: "You are a resume parsing assistant that extracts structured information from resume text. Return ONLY the JSON without any explanations or markdown formatting." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const result = response.choices[0].message.content;
    console.log('AI resume parsing completed successfully');
    console.log('AI parsed resume data:', result);
    
    try {
      const parsedData = JSON.parse(result || '{}') as ParsedResume;
      return parsedData;
    } catch (parseError) {
      console.error('Error parsing AI response as JSON:', parseError);
      return createEmptyResume();
    }
  } catch (error) {
    console.error('Error using AI to parse resume:', error);
    return createEmptyResume();
  }
}

export async function parseResume(filePath: string, fileType: string, useAI: boolean = false): Promise<ParsedResume> {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      return createEmptyResume();
    }

    console.log(`Parsing resume file: ${filePath} with type: ${fileType}`);
    let text = '';

    // Determine file extension from path and use it as a fallback
    const fileExtension = path.extname(filePath).toLowerCase();
    console.log(`File extension detected: ${fileExtension}`);

    // Extract text based on file type or extension
    if (fileType === 'application/pdf' || fileExtension === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      try {
        const parser = await initializePdfParser();
        if (!parser) {
          console.error('PDF parser not initialized properly');
          throw new Error('PDF parser initialization failed');
        }
        
        const pdfData = await parser(dataBuffer);
        text = pdfData.text;
        console.log('Successfully parsed PDF file');
      } catch (error) {
        console.error('Error parsing PDF:', error);
        return createEmptyResume();
      }
    } else if (
      fileType.includes('word') || 
      fileType.includes('docx') || 
      fileType.includes('doc') || 
      fileExtension === '.docx' || 
      fileExtension === '.doc'
    ) {
      try {
        console.log('Attempting to parse Word document with mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
        console.log('Successfully parsed Word document, text length:', text.length);
      } catch (error) {
        console.error('Error parsing Word document:', error);
        return createEmptyResume();
      }
    } else {
      console.error(`Unsupported file type: ${fileType} with extension ${fileExtension}`);
      return createEmptyResume();
    }

    if (!text || text.trim() === '') {
      console.error('Failed to extract text from document');
      return createEmptyResume();
    }

    console.log('Text extracted successfully. Length:', text.length);
    
    // If AI processing is requested, use OpenAI to parse the resume
    if (useAI) {
      console.log('Using AI to parse resume...');
      const aiResult = await parseResumeWithAI(text);
      console.log('AI parsing complete, returning structured resume data');
      
      // Log the entire parsed resume for debugging
      console.log('Entire parsed resume data:', JSON.stringify(aiResult, null, 2));
      
      return aiResult;
    }
    
    // Otherwise use the traditional parsing approach
    console.log('Using traditional parsing approach...');
    
    // Split text into sections using common resume headers
    const sections = splitIntoSections(text);
    console.log('Parsed sections:', Object.keys(sections));

    // If no sections were detected, try to parse the entire text
    if (Object.keys(sections).length === 0) {
      console.log('No sections detected, using full text for parsing');
      return {
        experience: parseExperience(text),
        education: parseEducation(text),
        skills: parseSkills(text),
        projects: parseProjects(text)
      };
    }

    return {
      experience: parseExperience(sections.experience || ''),
      education: parseEducation(sections.education || ''),
      skills: parseSkills(sections.skills || ''),
      projects: parseProjects(sections.projects || '')
    };
  } catch (error) {
    console.error('Resume parsing error:', error);
    return createEmptyResume();
  }
}

function createEmptyResume(): ParsedResume {
  return {
    experience: [],
    skills: {
      technical: [],
      soft: [],
      certifications: []
    },
    education: [],
    projects: []
  };
}

function splitIntoSections(text: string): Record<string, string> {
  const sections: Record<string, string> = {};
  const content = text.replace(/\r\n/g, '\n');

  // Common section headers in resumes
  const headers = {
    experience: /\b(experience|work\s+experience|employment(\s+history)?)\b/i,
    education: /\b(education|academic|qualifications)\b/i,
    skills: /\b(skills|technical\s+skills|competencies)\b/i,
    projects: /\b(projects|personal\s+projects|portfolio)\b/i
  };

  let currentSection = '';
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check if line matches any section header
    for (const [section, pattern] of Object.entries(headers)) {
      if (pattern.test(line)) {
        currentSection = section;
        sections[currentSection] = '';
        continue;
      }
    }

    // Add line to current section if we're in one
    if (currentSection) {
      sections[currentSection] += line + '\n';
    }
  }

  return sections;
}

function parseExperience(text: string): ParsedResume['experience'] {
  const entries = text.split(/\n\s*\n/).filter(Boolean);
  return entries.map(entry => {
    const lines = entry.split('\n').filter(Boolean);
    const responsibilities = lines.slice(3).filter(line =>
      line.trim().startsWith('•') || line.trim().startsWith('-')
    ).map(line => line.replace(/^[•\-]\s*/, '').trim());

    return {
      company: lines[0] || '',
      position: lines[1] || '',
      duration: lines[2] || '',
      responsibilities
    };
  });
}

function parseEducation(text: string): ParsedResume['education'] {
  const entries = text.split(/\n\s*\n/).filter(Boolean);
  return entries.map(entry => {
    const lines = entry.split('\n').filter(Boolean);
    return {
      degree: lines[0] || '',
      institution: lines[1] || '',
      year: lines[2] || '',
      details: lines.slice(3).join(' ').trim()
    };
  });
}

function parseSkills(text: string): ParsedResume['skills'] {
  const lines = text.split('\n').filter(Boolean).map(line => line.trim());

  const categorizedSkills = {
    technical: [] as string[],
    soft: [] as string[],
    certifications: [] as string[]
  };

  const patterns = {
    technical: /(programming|language|framework|tool|database|technical|development)/i,
    soft: /(communication|leadership|management|interpersonal|teamwork)/i,
    certifications: /(certification|certified|license)/i
  };

  lines.forEach(line => {
    const skills = line.split(/[,;]/).map(skill => skill.trim()).filter(Boolean);

    if (patterns.technical.test(line)) {
      categorizedSkills.technical.push(...skills);
    } else if (patterns.soft.test(line)) {
      categorizedSkills.soft.push(...skills);
    } else if (patterns.certifications.test(line)) {
      categorizedSkills.certifications.push(...skills);
    } else {
      // If no category is detected, assume it's a technical skill
      categorizedSkills.technical.push(...skills);
    }
  });

  return categorizedSkills;
}

function parseProjects(text: string): ParsedResume['projects'] {
  const entries = text.split(/\n\s*\n/).filter(Boolean);
  return entries.map(entry => {
    const lines = entry.split('\n').filter(Boolean);
    const technologies = (lines[2] || '')
      .split(/[,;]/)
      .map(t => t.trim())
      .filter(Boolean);

    return {
      name: lines[0] || '',
      description: lines[1] || '',
      technologies
    };
  });
}

export function detectResumeType(text: string): string {
  const keywords = {
    technical: ['programming', 'developer', 'engineer', 'software', 'coding', 'database', 'frontend', 'backend'],
    management: ['manager', 'director', 'lead', 'supervisor', 'coordinator', 'head'],
    marketing: ['marketing', 'sales', 'advertising', 'brand', 'social media', 'content'],
    design: ['designer', 'UX', 'UI', 'graphic', 'visual', 'creative']
  };

  const counts = Object.entries(keywords).reduce((acc, [type, words]) => {
    acc[type] = words.filter(word =>
      text.toLowerCase().includes(word.toLowerCase())
    ).length;
    return acc;
  }, {} as Record<string, number>);

  // Return the category with the highest keyword matches
  return Object.entries(counts).reduce((a, b) =>
    counts[a[0]] > counts[b[0]] ? a : b
  )[0];
}