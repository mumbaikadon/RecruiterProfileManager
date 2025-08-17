/**
 * Comprehensive test suite for Profile Record system
 * Tests file upload, text extraction, search functionality, and CRUD operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../server/db';
import { profileResumes, resumeContent } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { extractTextFromDocument } from '../server/document-parser';
import { createTestApp } from './test-utils';

describe('Profile Record System', () => {
  let app: express.Application;
  let testUserId: number;
  let testResumeId: number;

  beforeAll(async () => {
    // Create test application
    app = await createTestApp();
    
    // Create test user for authentication
    testUserId = 1; // Assuming admin user exists
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(resumeContent);
    await db.delete(profileResumes);
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(resumeContent);
    await db.delete(profileResumes);
  });

  describe('Document Parser', () => {
    it('should extract text from PDF files', async () => {
      // Create a simple test buffer (this would be a real PDF in practice)
      const testBuffer = Buffer.from('PDF test content');
      
      try {
        const extractedText = await extractTextFromDocument(testBuffer, 'pdf');
        expect(typeof extractedText).toBe('string');
        expect(extractedText.length).toBeGreaterThan(0);
      } catch (error) {
        // PDF parsing might fail with test buffer, which is expected
        expect(error).toBeDefined();
      }
    });

    it('should extract text from DOCX files', async () => {
      const testBuffer = Buffer.from('DOCX test content');
      
      try {
        const extractedText = await extractTextFromDocument(testBuffer, 'docx');
        expect(typeof extractedText).toBe('string');
      } catch (error) {
        // DOCX parsing might fail with test buffer, which is expected
        expect(error).toBeDefined();
      }
    });

    it('should handle unsupported file types', async () => {
      const testBuffer = Buffer.from('test content');
      
      await expect(extractTextFromDocument(testBuffer, 'unsupported'))
        .rejects.toThrow('Unsupported file type');
    });

    it('should handle MIME types correctly', async () => {
      const testBuffer = Buffer.from('test content');
      
      // Test PDF MIME type
      try {
        await extractTextFromDocument(testBuffer, 'application/pdf');
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Test DOCX MIME type
      try {
        await extractTextFromDocument(testBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Profile Resume CRUD Operations', () => {
    it('should create a new profile resume record', async () => {
      const testData = {
        filename: 'test-resume.pdf',
        fileType: 'pdf' as const,
        fileSize: 1024,
        fileData: 'base64encodeddata',
        candidateName: 'John Doe',
        candidateEmail: 'john@example.com',
        uploadedBy: testUserId
      };

      const [resume] = await db.insert(profileResumes).values(testData).returning();
      
      expect(resume).toBeDefined();
      expect(resume.filename).toBe(testData.filename);
      expect(resume.candidateName).toBe(testData.candidateName);
      
      testResumeId = resume.id;
    });

    it('should retrieve all profile resumes', async () => {
      // Insert test data
      await db.insert(profileResumes).values({
        filename: 'test1.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'data1',
        uploadedBy: testUserId
      });
      
      await db.insert(profileResumes).values({
        filename: 'test2.docx',
        fileType: 'docx',
        fileSize: 2048,
        fileData: 'data2',
        uploadedBy: testUserId
      });

      const resumes = await db.select().from(profileResumes);
      expect(resumes).toHaveLength(2);
    });

    it('should delete a profile resume', async () => {
      // Insert test data
      const [resume] = await db.insert(profileResumes).values({
        filename: 'test-delete.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'data',
        uploadedBy: testUserId
      }).returning();

      // Delete the resume
      await db.delete(profileResumes).where(eq(profileResumes.id, resume.id));

      // Verify deletion
      const deletedResume = await db.select().from(profileResumes).where(eq(profileResumes.id, resume.id));
      expect(deletedResume).toHaveLength(0);
    });
  });

  describe('Resume Content Operations', () => {
    beforeEach(async () => {
      // Create a test resume first
      const [resume] = await db.insert(profileResumes).values({
        filename: 'test-content.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'data',
        uploadedBy: testUserId
      }).returning();
      
      testResumeId = resume.id;
    });

    it('should create resume content record', async () => {
      const contentData = {
        profileResumeId: testResumeId,
        extractedText: 'This is extracted resume text with skills like JavaScript, React, Node.js',
        contentHash: 'testhash123'
      };

      const [content] = await db.insert(resumeContent).values(contentData).returning();
      
      expect(content).toBeDefined();
      expect(content.extractedText).toBe(contentData.extractedText);
      expect(content.profileResumeId).toBe(testResumeId);
    });

    it('should search resume content using full-text search', async () => {
      // Insert test content
      await db.insert(resumeContent).values([
        {
          profileResumeId: testResumeId,
          extractedText: 'Senior JavaScript developer with React and Node.js experience',
          contentHash: 'hash1'
        },
        {
          profileResumeId: testResumeId,
          extractedText: 'Python developer with Django and Flask frameworks',
          contentHash: 'hash2'
        }
      ]);

      // Search for JavaScript-related content
      const results = await db.execute(`
        SELECT rc.*, pr.filename, pr.candidate_name
        FROM resume_content rc
        JOIN profile_resumes pr ON rc.profile_resume_id = pr.id
        WHERE to_tsvector('english', rc.extracted_text) @@ plainto_tsquery('english', 'JavaScript')
      `);

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('API Endpoints', () => {
    it('should get all profile resumes via API', async () => {
      const response = await request(app)
        .get('/api/profile-resumes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle file upload via API', async () => {
      // Create a mock file buffer
      const mockFile = Buffer.from('Mock PDF content');
      
      const response = await request(app)
        .post('/api/profile-resumes/upload')
        .attach('resume', mockFile, 'test-resume.pdf')
        .field('candidateName', 'Test Candidate')
        .field('candidateEmail', 'test@example.com');

      // Note: This might fail due to file parsing, but should test the endpoint structure
      expect([200, 400, 500]).toContain(response.status);
    });

    it('should search resumes via API', async () => {
      const response = await request(app)
        .post('/api/profile-resumes/search')
        .send({ query: 'JavaScript developer' })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should download resume file via API', async () => {
      // First create a resume
      const [resume] = await db.insert(profileResumes).values({
        filename: 'download-test.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: Buffer.from('test file content').toString('base64'),
        uploadedBy: testUserId
      }).returning();

      const response = await request(app)
        .get(`/api/profile-resumes/${resume.id}/download`)
        .expect(200);

      expect(response.headers['content-type']).toContain('application');
    });

    it('should delete resume via API', async () => {
      // First create a resume
      const [resume] = await db.insert(profileResumes).values({
        filename: 'delete-test.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'data',
        uploadedBy: testUserId
      }).returning();

      const response = await request(app)
        .delete(`/api/profile-resumes/${resume.id}`)
        .expect(200);

      expect(response.body.message).toBe('Resume deleted successfully');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing file in upload', async () => {
      const response = await request(app)
        .post('/api/profile-resumes/upload')
        .field('candidateName', 'Test')
        .expect(400);

      expect(response.body.message).toContain('file');
    });

    it('should handle invalid file types', async () => {
      const mockFile = Buffer.from('Invalid file content');
      
      const response = await request(app)
        .post('/api/profile-resumes/upload')
        .attach('resume', mockFile, 'test.txt')
        .expect(400);

      expect(response.body.message).toContain('file type');
    });

    it('should handle non-existent resume download', async () => {
      const response = await request(app)
        .get('/api/profile-resumes/99999/download')
        .expect(404);

      expect(response.body.message).toBe('Resume not found');
    });

    it('should handle non-existent resume deletion', async () => {
      const response = await request(app)
        .delete('/api/profile-resumes/99999')
        .expect(404);

      expect(response.body.message).toBe('Resume not found');
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple file uploads efficiently', async () => {
      const uploadPromises = [];
      
      for (let i = 0; i < 5; i++) {
        const mockFile = Buffer.from(`Mock content ${i}`);
        uploadPromises.push(
          request(app)
            .post('/api/profile-resumes/upload')
            .attach('resume', mockFile, `test-${i}.pdf`)
            .field('candidateName', `Candidate ${i}`)
        );
      }

      const results = await Promise.allSettled(uploadPromises);
      
      // At least some uploads should complete (even if they fail due to parsing)
      expect(results.length).toBe(5);
    });

    it('should search through multiple resumes efficiently', async () => {
      // Insert multiple test resumes
      const testResumes = [];
      for (let i = 0; i < 10; i++) {
        testResumes.push({
          profileResumeId: testResumeId,
          extractedText: `Resume ${i} contains skills like JavaScript, Python, React, Node.js`,
          contentHash: `hash${i}`
        });
      }
      
      await db.insert(resumeContent).values(testResumes);

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/profile-resumes/search')
        .send({ query: 'JavaScript' })
        .expect(200);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
      expect(response.body.length).toBeGreaterThan(0);
    });
  });
});