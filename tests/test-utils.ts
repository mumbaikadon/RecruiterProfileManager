/**
 * Test utilities for Profile Record system
 */

import express from 'express';
import session from 'express-session';
import { registerRoutes } from '../server/routes';

export async function createTestApp(): Promise<express.Application> {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // Mock session for testing
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
  }));

  // Mock authentication middleware for testing
  app.use((req: any, res, next) => {
    req.user = { id: 1, username: 'test-admin', role: 'admin' };
    req.isAuthenticated = () => true;
    next();
  });

  // Register routes
  await registerRoutes(app);
  
  return app;
}

export function createMockFile(filename: string, content: string, mimetype: string) {
  return {
    fieldname: 'resume',
    originalname: filename,
    encoding: '7bit',
    mimetype: mimetype,
    buffer: Buffer.from(content),
    size: Buffer.from(content).length
  };
}

export function createMockResumeData() {
  return {
    filename: 'john-doe-resume.pdf',
    fileType: 'pdf' as const,
    fileSize: 1024,
    fileData: Buffer.from('Mock PDF content').toString('base64'),
    candidateName: 'John Doe',
    candidateEmail: 'john.doe@example.com',
    uploadedBy: 1
  };
}

export function createMockResumeContent(profileResumeId: number) {
  return {
    profileResumeId,
    extractedText: `
      John Doe
      Senior Software Engineer
      
      Experience:
      - 5+ years of JavaScript development
      - Expert in React, Node.js, and TypeScript
      - Experience with AWS, Docker, and microservices
      - Led teams of 3-5 developers
      
      Skills:
      - Frontend: React, Vue.js, Angular
      - Backend: Node.js, Python, Java
      - Databases: PostgreSQL, MongoDB, Redis
      - Cloud: AWS, Azure, GCP
      
      Education:
      - Bachelor's in Computer Science
      - Certified AWS Solutions Architect
    `,
    contentHash: 'mock-hash-123'
  };
}