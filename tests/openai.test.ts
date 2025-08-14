import { analyzeResumeText, matchResumeToJob } from '../server/openai';
import { jest } from '@jest/globals';

// Mock OpenAI module
jest.mock('openai');

describe('OpenAI Service', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock implementation
    (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            clientNames: ['Test Company', 'Another Corp'],
            jobTitles: ['Software Engineer', 'Senior Developer'],
            relevantDates: ['2020-2023', '2018-2020'],
            skills: ['JavaScript', 'React', 'Node.js'],
            education: ['BS Computer Science - Test University (2018)']
          })
        }
      }]
    });
  });

  describe('analyzeResumeText', () => {
    const sampleResumeText = `
      John Doe
      Software Engineer
      john.doe@email.com
      
      Experience:
      Software Engineer at Tech Corp (2020-2023)
      - Developed web applications using React and Node.js
      - Worked with JavaScript, TypeScript, and MongoDB
      
      Junior Developer at Startup Inc (2018-2020)
      - Built REST APIs using Express.js
      - Collaborated with cross-functional teams
      
      Education:
      Bachelor of Science in Computer Science
      University of Technology (2018)
      
      Skills: JavaScript, React, Node.js, Express.js, MongoDB, TypeScript
    `;

    it('should successfully analyze resume text and extract information', async () => {
      const result = await analyzeResumeText(sampleResumeText);

      expect(result).toHaveProperty('clientNames');
      expect(result).toHaveProperty('jobTitles');
      expect(result).toHaveProperty('relevantDates');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('education');
      
      expect(Array.isArray(result.clientNames)).toBe(true);
      expect(Array.isArray(result.jobTitles)).toBe(true);
      expect(Array.isArray(result.relevantDates)).toBe(true);
      expect(Array.isArray(result.skills)).toBe(true);
      expect(Array.isArray(result.education)).toBe(true);
      
      expect(result.clientNames.length).toBeGreaterThan(0);
      expect(result.jobTitles.length).toBeGreaterThan(0);
      expect(result.skills.length).toBeGreaterThan(0);
    });

    it('should throw error for empty resume text', async () => {
      await expect(analyzeResumeText('')).rejects.toThrow('Resume text cannot be empty');
      await expect(analyzeResumeText('   ')).rejects.toThrow('Resume text cannot be empty');
    });

    it('should throw error for null or undefined resume text', async () => {
      await expect(analyzeResumeText(null as any)).rejects.toThrow('Resume text cannot be empty');
      await expect(analyzeResumeText(undefined as any)).rejects.toThrow('Resume text cannot be empty');
    });

    it('should handle OpenAI API errors gracefully', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(new Error('OpenAI API Error'));

      const result = await analyzeResumeText(sampleResumeText);

      // Should return default empty structure when API fails
      expect(result).toEqual({
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: sampleResumeText.substring(0, 4000)
      });
    });

    it('should handle malformed JSON response from OpenAI', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [{
          message: {
            content: 'Invalid JSON response'
          }
        }]
      });

      const result = await analyzeResumeText(sampleResumeText);

      // Should return default empty structure when JSON parsing fails
      expect(result).toEqual({
        clientNames: [],
        jobTitles: [],
        relevantDates: [],
        skills: [],
        education: [],
        extractedText: sampleResumeText.substring(0, 4000)
      });
    });

    it('should truncate very long resume text for extractedText field', async () => {
      const longResumeText = 'A'.repeat(5000);
      
      const result = await analyzeResumeText(longResumeText);

      expect(result.extractedText.length).toBe(4000);
      expect(result.extractedText).toBe(longResumeText.substring(0, 4000));
    });

    it('should call OpenAI API with correct parameters', async () => {
      await analyzeResumeText(sampleResumeText);

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4o',
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'system',
            content: expect.stringContaining('expert resume analyzer')
          }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(sampleResumeText)
          })
        ]),
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1000
      });
    });
  });

  describe('matchResumeToJob', () => {
    const sampleResumeText = `
      John Doe - Full Stack Developer
      5 years of experience in web development
      Skills: JavaScript, React, Node.js, Express, MongoDB
      Experience: Built scalable web applications
    `;

    const sampleJobDescription = `
      Senior Full Stack Developer
      Requirements: 3+ years React experience, Node.js, MongoDB
      Responsibilities: Build and maintain web applications
      Nice to have: TypeScript, AWS experience
    `;

    beforeEach(() => {
      // Mock the resumeAnalyzer function since matchResumeToJob uses it internally
      jest.doMock('../server/resumeAnalyzer', () => ({
        resumeAnalyzer: jest.fn().mockResolvedValue({
          score: 85,
          strengths: ['React experience', 'Node.js knowledge'],
          weaknesses: ['Missing TypeScript', 'No AWS experience'],
          suggestions: ['Learn TypeScript', 'Get AWS certification'],
          clientNames: ['Previous Company'],
          jobTitles: ['Full Stack Developer'],
          relevantDates: ['2019-2024'],
          education: ['BS Computer Science'],
          skillsGapAnalysis: {
            gapDetails: [{
              category: 'Technical Skills',
              gaps: ['TypeScript', 'AWS'],
              importance: 'Medium'
            }]
          },
          domainExpertiseGaps: ['AWS Cloud Services']
        })
      }));
    });

    it('should successfully match resume to job description', async () => {
      const result = await matchResumeToJob(sampleResumeText, sampleJobDescription);

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('strengths');
      expect(result).toHaveProperty('weaknesses');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('clientNames');
      expect(result).toHaveProperty('jobTitles');
      expect(result).toHaveProperty('relevantDates');
      expect(result).toHaveProperty('education');
      
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.weaknesses)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should throw error for empty resume text', async () => {
      await expect(matchResumeToJob('', sampleJobDescription)).rejects.toThrow('Resume text cannot be empty');
      await expect(matchResumeToJob('   ', sampleJobDescription)).rejects.toThrow('Resume text cannot be empty');
    });

    it('should throw error for empty job description', async () => {
      await expect(matchResumeToJob(sampleResumeText, '')).rejects.toThrow('Job description cannot be empty');
      await expect(matchResumeToJob(sampleResumeText, '   ')).rejects.toThrow('Job description cannot be empty');
    });

    it('should throw error for null or undefined inputs', async () => {
      await expect(matchResumeToJob(null as any, sampleJobDescription)).rejects.toThrow('Resume text cannot be empty');
      await expect(matchResumeToJob(sampleResumeText, null as any)).rejects.toThrow('Job description cannot be empty');
      await expect(matchResumeToJob(undefined as any, sampleJobDescription)).rejects.toThrow('Resume text cannot be empty');
      await expect(matchResumeToJob(sampleResumeText, undefined as any)).rejects.toThrow('Job description cannot be empty');
    });

    it('should validate score is within expected range', async () => {
      const result = await matchResumeToJob(sampleResumeText, sampleJobDescription);

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('should extract domain expertise gaps correctly', async () => {
      const result = await matchResumeToJob(sampleResumeText, sampleJobDescription);

      if (result.domainExpertiseGaps) {
        expect(Array.isArray(result.domainExpertiseGaps)).toBe(true);
      }
    });

    it('should handle resume analyzer errors gracefully', async () => {
      // Mock resumeAnalyzer to throw an error
      jest.doMock('../server/resumeAnalyzer', () => ({
        resumeAnalyzer: jest.fn().mockRejectedValue(new Error('Resume analyzer error'))
      }));

      await expect(matchResumeToJob(sampleResumeText, sampleJobDescription)).rejects.toThrow();
    });
  });

  describe('OpenAI Integration Tests', () => {
    it('should handle rate limiting gracefully', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded'
      });

      const result = await analyzeResumeText('Sample resume text');

      // Should fallback to empty structure when rate limited
      expect(result).toHaveProperty('clientNames');
      expect(result.clientNames).toEqual([]);
    });

    it('should handle authentication errors', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue({
        status: 401,
        message: 'Invalid API key'
      });

      const result = await analyzeResumeText('Sample resume text');

      // Should fallback to empty structure when authentication fails
      expect(result).toHaveProperty('clientNames');
      expect(result.clientNames).toEqual([]);
    });

    it('should handle network errors', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await analyzeResumeText('Sample resume text');

      // Should fallback to empty structure when network fails
      expect(result).toHaveProperty('clientNames');
      expect(result.clientNames).toEqual([]);
    });

    it('should handle partial responses from OpenAI', async () => {
      (mockOpenAI.chat.completions.create as jest.Mock).mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              clientNames: ['Company A'],
              jobTitles: ['Developer'],
              // Missing other fields
            })
          }
        }]
      });

      const result = await analyzeResumeText('Sample resume text');

      expect(result.clientNames).toEqual(['Company A']);
      expect(result.jobTitles).toEqual(['Developer']);
      expect(result.relevantDates).toEqual([]);
      expect(result.skills).toEqual([]);
      expect(result.education).toEqual([]);
    });
  });
});