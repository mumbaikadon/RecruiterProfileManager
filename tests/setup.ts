/**
 * Jest test setup file
 */

// Mock winston logger to avoid file system issues in tests
jest.mock('../server/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
  profileLogger: {
    uploadStart: jest.fn(),
    uploadSuccess: jest.fn(),
    uploadError: jest.fn(),
    extractionStart: jest.fn(),
    extractionSuccess: jest.fn(),
    extractionError: jest.fn(),
    searchStart: jest.fn(),
    searchSuccess: jest.fn(),
    searchError: jest.fn(),
    dbOperation: jest.fn(),
    dbError: jest.fn(),
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
  existsSync: jest.fn(() => true),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => 'mock file content'),
}));

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';