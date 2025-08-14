// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.SESSION_SECRET = 'test-session-secret';

// Mock OpenAI API calls
jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
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
          })
        }
      }
    }))
  };
});

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});