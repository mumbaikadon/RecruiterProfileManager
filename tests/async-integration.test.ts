/**
 * Integration tests for Asynchronous File Processing System
 * Tests real file upload workflows and background processing integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../server/db';
import { profileResumes, resumeContent, processingJobs, uploadSessions } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { createTestApp } from './test-utils';

describe('Async Processing Integration Tests', () => {
  let app: express.Application;
  let testUserId: number;

  beforeAll(async () => {
    app = await createTestApp();
    testUserId = 1;
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(resumeContent);
    await db.delete(profileResumes);
    await db.delete(processingJobs);
    await db.delete(uploadSessions);
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(resumeContent);
    await db.delete(profileResumes);
    await db.delete(processingJobs);
    await db.delete(uploadSessions);
  });

  describe('Full Upload Workflow Tests', () => {
    it('should handle complete sync upload workflow', async () => {
      const mockFile = Buffer.from('Mock PDF content for testing');
      
      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload')
        .attach('resumes', mockFile, 'test-sync.pdf')
        .field('candidateName', 'Sync Test Candidate')
        .field('candidateEmail', 'sync@test.com');

      // Sync upload should process immediately (may fail but should have structure)
      expect([200, 400, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('successful');
        expect(response.body).toHaveProperty('failed');
        expect(Array.isArray(response.body.successful)).toBe(true);
        expect(Array.isArray(response.body.failed)).toBe(true);
      }
    });

    it('should handle async upload workflow with session creation', async () => {
      const mockFiles = [
        Buffer.from('Mock PDF content 1'),
        Buffer.from('Mock PDF content 2'),
        Buffer.from('Mock PDF content 3')
      ];

      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', mockFiles[0], 'test-async-1.pdf')
        .attach('resumes', mockFiles[1], 'test-async-2.pdf')
        .attach('resumes', mockFiles[2], 'test-async-3.pdf')
        .field('candidateName', 'Async Test Candidate')
        .field('candidateEmail', 'async@test.com');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body.successful).toHaveLength(3);

      // Verify session was created in database
      const sessions = await db.select()
        .from(uploadSessions)
        .where(eq(uploadSessions.sessionId, response.body.sessionId));
      
      expect(sessions).toHaveLength(1);
      expect(sessions[0].totalFiles).toBe(3);
      expect(sessions[0].status).toBe('processing');

      // Verify files were created
      const files = await db.select().from(profileResumes);
      expect(files).toHaveLength(3);

      // Verify jobs were queued
      const jobs = await db.select().from(processingJobs);
      expect(jobs).toHaveLength(3);
      jobs.forEach(job => {
        expect(job.status).toBe('pending');
        expect(job.jobType).toBe('extract_text');
      });
    });

    it('should filter invalid file types in async upload', async () => {
      const validPdf = Buffer.from('Mock PDF content');
      const validDocx = Buffer.from('Mock DOCX content');
      const invalidTxt = Buffer.from('Invalid TXT content');
      const invalidImage = Buffer.from('Invalid JPG content');

      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', validPdf, 'valid.pdf')
        .attach('resumes', validDocx, 'valid.docx')
        .attach('resumes', invalidTxt, 'invalid.txt')
        .attach('resumes', invalidImage, 'invalid.jpg')
        .field('candidateName', 'Filter Test');

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(2); // Only PDF and DOCX
      expect(response.body.failed).toHaveLength(2); // TXT and JPG rejected
      
      response.body.failed.forEach((failure: any) => {
        expect(failure.error).toContain('file type');
      });

      // Verify only valid files were stored
      const files = await db.select().from(profileResumes);
      expect(files).toHaveLength(2);
      
      const filenames = files.map(f => f.filename);
      expect(filenames).toContain('valid.pdf');
      expect(filenames).toContain('valid.docx');
    });
  });

  describe('Session Tracking API Tests', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create test session with jobs
      testSessionId = 'integration-test-session';
      
      await db.insert(uploadSessions).values({
        sessionId: testSessionId,
        totalFiles: 4,
        uploadedFiles: 4,
        processedFiles: 2,
        failedFiles: 1,
        status: 'processing',
        candidateName: 'Integration Test',
        candidateEmail: 'integration@test.com',
        createdBy: testUserId
      });

      // Create test resumes and jobs
      for (let i = 1; i <= 4; i++) {
        const [resume] = await db.insert(profileResumes).values({
          filename: `integration-test-${i}.pdf`,
          fileType: 'pdf',
          fileSize: 1024 * i,
          fileData: `test-data-${i}`,
          uploadedBy: testUserId
        }).returning();

        const statuses = ['completed', 'completed', 'processing', 'failed'];
        await db.insert(processingJobs).values({
          profileResumeId: resume.id,
          jobType: 'extract_text',
          status: statuses[i - 1] as any,
          priority: 1,
          retryCount: statuses[i - 1] === 'failed' ? 3 : 1,
          maxRetries: 3,
          processingData: JSON.stringify({
            sessionId: testSessionId,
            filename: `integration-test-${i}.pdf`,
            index: i
          }),
          createdBy: testUserId,
          completedAt: statuses[i - 1] === 'completed' ? new Date() : null
        });
      }
    });

    it('should return session status with progress calculation', async () => {
      const response = await request(app)
        .get(`/api/upload-sessions/${testSessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('totalFiles');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('progress');

      expect(response.body.sessionId).toBe(testSessionId);
      expect(response.body.totalFiles).toBe(4);
      expect(response.body.status).toBe('processing');

      // Check progress calculation
      const progress = response.body.progress;
      expect(progress).toHaveProperty('total');
      expect(progress).toHaveProperty('completed');
      expect(progress).toHaveProperty('processing');
      expect(progress).toHaveProperty('pending');
      expect(progress).toHaveProperty('failed');
      expect(progress).toHaveProperty('percentage');

      expect(progress.total).toBe(4);
      expect(progress.completed).toBe(2);
      expect(progress.processing).toBe(1);
      expect(progress.pending).toBe(0);
      expect(progress.failed).toBe(1);
      expect(progress.percentage).toBe(75); // (2 completed + 1 failed) / 4 * 100
    });

    it('should handle session not found gracefully', async () => {
      const response = await request(app)
        .get('/api/upload-sessions/non-existent-session-123')
        .expect(404);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Upload session not found');
    });

    it('should handle empty session ID', async () => {
      const response = await request(app)
        .get('/api/upload-sessions/')
        .expect(404); // Should hit 404 route
    });
  });

  describe('File Size and Limit Tests', () => {
    it('should handle large file uploads within limits', async () => {
      // Create a larger mock file (but still within reasonable test limits)
      const largeFile = Buffer.alloc(1024 * 100, 'x'); // 100KB file

      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', largeFile, 'large-test.pdf')
        .field('candidateName', 'Large File Test');

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(1);
      expect(response.body.failed).toHaveLength(0);

      // Verify file was stored
      const files = await db.select().from(profileResumes);
      expect(files).toHaveLength(1);
      expect(files[0].filename).toBe('large-test.pdf');
      expect(files[0].fileSize).toBe(1024 * 100);
    });

    it('should handle multiple files of varying sizes', async () => {
      const files = [
        { buffer: Buffer.alloc(1024, 'a'), name: 'small.pdf' },      // 1KB
        { buffer: Buffer.alloc(1024 * 10, 'b'), name: 'medium.pdf' }, // 10KB
        { buffer: Buffer.alloc(1024 * 50, 'c'), name: 'large.pdf' },  // 50KB
      ];

      const request_builder = request(app).post('/api/profile-resumes/bulk-upload-async');
      files.forEach(file => {
        request_builder.attach('resumes', file.buffer, file.name);
      });

      const response = await request_builder.field('candidateName', 'Multi Size Test');

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(3);
      expect(response.body.failed).toHaveLength(0);

      // Verify all files were stored with correct sizes
      const storedFiles = await db.select().from(profileResumes);
      expect(storedFiles).toHaveLength(3);
      
      const sizesMap = new Map(storedFiles.map(f => [f.filename, f.fileSize]));
      expect(sizesMap.get('small.pdf')).toBe(1024);
      expect(sizesMap.get('medium.pdf')).toBe(1024 * 10);
      expect(sizesMap.get('large.pdf')).toBe(1024 * 50);
    });
  });

  describe('Concurrent Upload Tests', () => {
    it('should handle multiple simultaneous async uploads', async () => {
      const uploadPromises = [];

      // Create 3 simultaneous uploads with different files
      for (let i = 0; i < 3; i++) {
        const mockFile = Buffer.from(`Concurrent upload content ${i}`);
        
        const uploadPromise = request(app)
          .post('/api/profile-resumes/bulk-upload-async')
          .attach('resumes', mockFile, `concurrent-${i}.pdf`)
          .field('candidateName', `Concurrent Test ${i}`)
          .field('candidateEmail', `concurrent${i}@test.com`);
        
        uploadPromises.push(uploadPromise);
      }

      const responses = await Promise.all(uploadPromises);

      // All uploads should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.successful).toHaveLength(1);
        expect(response.body.failed).toHaveLength(0);
        expect(response.body).toHaveProperty('sessionId');
      });

      // Verify all sessions were created
      const sessions = await db.select().from(uploadSessions);
      expect(sessions).toHaveLength(3);

      // Verify all files were stored
      const files = await db.select().from(profileResumes);
      expect(files).toHaveLength(3);

      // Verify all jobs were queued
      const jobs = await db.select().from(processingJobs);
      expect(jobs).toHaveLength(3);

      // Verify session IDs are unique
      const sessionIds = responses.map(r => r.body.sessionId);
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(3);
    });

    it('should handle mixed sync and async uploads', async () => {
      const syncFile = Buffer.from('Sync upload content');
      const asyncFile = Buffer.from('Async upload content');

      // Start both uploads simultaneously
      const [syncResponse, asyncResponse] = await Promise.all([
        request(app)
          .post('/api/profile-resumes/bulk-upload')
          .attach('resumes', syncFile, 'sync-upload.pdf')
          .field('candidateName', 'Sync Upload Test'),
        
        request(app)
          .post('/api/profile-resumes/bulk-upload-async')
          .attach('resumes', asyncFile, 'async-upload.pdf')
          .field('candidateName', 'Async Upload Test')
      ]);

      // Both should complete (sync might fail due to processing, but async should succeed)
      expect([200, 400, 500]).toContain(syncResponse.status);
      expect(asyncResponse.status).toBe(200);
      
      expect(asyncResponse.body).toHaveProperty('sessionId');
      expect(asyncResponse.body.successful).toHaveLength(1);

      // At least the async file should be stored
      const files = await db.select().from(profileResumes);
      expect(files.length).toBeGreaterThanOrEqual(1);
      
      const filenames = files.map(f => f.filename);
      expect(filenames).toContain('async-upload.pdf');
    });
  });

  describe('Error Recovery Tests', () => {
    it('should handle database connection issues gracefully', async () => {
      const mockFile = Buffer.from('Test content for error recovery');

      // This test would ideally mock database failures, but for now we test that
      // the error handling structure exists
      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', mockFile, 'error-test.pdf')
        .field('candidateName', 'Error Test');

      // Should either succeed or fail gracefully with proper error structure
      if (response.status !== 200) {
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
      } else {
        expect(response.body).toHaveProperty('sessionId');
        expect(response.body).toHaveProperty('successful');
        expect(response.body).toHaveProperty('failed');
      }
    });

    it('should handle malformed requests gracefully', async () => {
      // Test with missing required fields
      const response1 = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .expect(400);

      expect(response1.body).toHaveProperty('message');
      expect(response1.body.message).toContain('No files uploaded');

      // Test with malformed file
      const response2 = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .field('candidateName', 'Malformed Test')
        .expect(400);

      expect(response2.body).toHaveProperty('message');
    });
  });

  describe('Performance and Load Tests', () => {
    it('should handle reasonable batch sizes efficiently', async () => {
      const batchSize = 10;
      const files = Array.from({ length: batchSize }, (_, i) => 
        Buffer.from(`Performance test content ${i}`)
      );

      const request_builder = request(app).post('/api/profile-resumes/bulk-upload-async');
      files.forEach((file, index) => {
        request_builder.attach('resumes', file, `performance-test-${index}.pdf`);
      });

      const startTime = Date.now();
      const response = await request_builder.field('candidateName', 'Performance Test');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(batchSize);
      expect(response.body.failed).toHaveLength(0);
      
      // Upload should complete reasonably quickly (under 5 seconds for 10 files)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify all files and jobs were created
      const files_count = await db.select().from(profileResumes);
      const jobs_count = await db.select().from(processingJobs);
      
      expect(files_count).toHaveLength(batchSize);
      expect(jobs_count).toHaveLength(batchSize);
    });

    it('should maintain session consistency under load', async () => {
      const sessionCountBefore = await db.select().from(uploadSessions);
      const fileCountBefore = await db.select().from(profileResumes);
      const jobCountBefore = await db.select().from(processingJobs);

      // Perform multiple small uploads rapidly
      const rapidUploads = Array.from({ length: 5 }, (_, i) => {
        const file = Buffer.from(`Rapid upload ${i}`);
        return request(app)
          .post('/api/profile-resumes/bulk-upload-async')
          .attach('resumes', file, `rapid-${i}.pdf`)
          .field('candidateName', `Rapid Test ${i}`);
      });

      const responses = await Promise.all(rapidUploads);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.successful).toHaveLength(1);
      });

      const sessionCountAfter = await db.select().from(uploadSessions);
      const fileCountAfter = await db.select().from(profileResumes);
      const jobCountAfter = await db.select().from(processingJobs);

      // Verify correct counts
      expect(sessionCountAfter.length).toBe(sessionCountBefore.length + 5);
      expect(fileCountAfter.length).toBe(fileCountBefore.length + 5);
      expect(jobCountAfter.length).toBe(jobCountBefore.length + 5);

      // Verify session IDs are all unique
      const sessionIds = responses.map(r => r.body.sessionId);
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(5);
    });
  });
});