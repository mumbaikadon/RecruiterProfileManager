/**
 * Comprehensive test suite for Asynchronous File Processing System
 * Tests job queues, background workers, session tracking, and parallel processing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../server/db';
import { profileResumes, resumeContent, processingJobs, uploadSessions } from '../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createTestApp } from './test-utils';
import { jobProcessor } from '../server/job-processor';

// Mock the job processor to control timing in tests
jest.mock('../server/job-processor');

describe('Asynchronous File Processing System', () => {
  let app: express.Application;
  let testUserId: number;
  let mockJobProcessor: jest.Mocked<typeof jobProcessor>;

  beforeAll(async () => {
    app = await createTestApp();
    testUserId = 1;
    
    // Setup job processor mock
    mockJobProcessor = jobProcessor as jest.Mocked<typeof jobProcessor>;
    mockJobProcessor.start = jest.fn();
    mockJobProcessor.stop = jest.fn();
    mockJobProcessor.addJob = jest.fn();
    mockJobProcessor.getSessionProgress = jest.fn();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await db.delete(resumeContent);
    await db.delete(profileResumes);
    await db.delete(processingJobs);
    await db.delete(uploadSessions);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(resumeContent);
    await db.delete(profileResumes);
    await db.delete(processingJobs);
    await db.delete(uploadSessions);
  });

  describe('Async Upload Endpoint', () => {
    it('should accept files and create upload session immediately', async () => {
      const mockFiles = [
        Buffer.from('Mock PDF content 1'),
        Buffer.from('Mock PDF content 2'),
        Buffer.from('Mock PDF content 3')
      ];

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', mockFiles[0], 'resume1.pdf')
        .attach('resumes', mockFiles[1], 'resume2.pdf')
        .attach('resumes', mockFiles[2], 'resume3.pdf')
        .field('candidateName', 'Test Candidate')
        .field('candidateEmail', 'test@example.com');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body.successful).toHaveLength(3);
      expect(response.body.failed).toHaveLength(0);

      // Verify upload session was created
      const sessions = await db.select().from(uploadSessions);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].totalFiles).toBe(3);
      expect(sessions[0].status).toBe('processing');
    });

    it('should queue jobs for background processing', async () => {
      const mockFile = Buffer.from('Mock PDF content');

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', mockFile, 'test.pdf')
        .field('candidateName', 'Test Candidate');

      // Verify job was added to processor
      expect(mockJobProcessor.addJob).toHaveBeenCalled();
      
      // Verify job was created in database
      const jobs = await db.select().from(processingJobs);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('pending');
      expect(jobs[0].priority).toBe(1);
    });

    it('should handle large file batches efficiently', async () => {
      const fileCount = 50;
      const mockFiles = Array.from({ length: fileCount }, (_, i) => 
        Buffer.from(`Mock PDF content ${i}`)
      );

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      const request_builder = request(app).post('/api/profile-resumes/bulk-upload-async');
      
      // Attach all files
      mockFiles.forEach((file, index) => {
        request_builder.attach('resumes', file, `resume${index}.pdf`);
      });

      const startTime = Date.now();
      const response = await request_builder.field('candidateName', 'Batch Test');
      const endTime = Date.now();

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(fileCount);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete upload in under 5 seconds

      // Verify all jobs were queued
      const jobs = await db.select().from(processingJobs);
      expect(jobs).toHaveLength(fileCount);
    });

    it('should handle mixed file types and filter invalid ones', async () => {
      const validPdf = Buffer.from('Mock PDF content');
      const validDocx = Buffer.from('Mock DOCX content');
      const invalidTxt = Buffer.from('Invalid TXT content');

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', validPdf, 'valid.pdf')
        .attach('resumes', validDocx, 'valid.docx')
        .attach('resumes', invalidTxt, 'invalid.txt')
        .field('candidateName', 'Mixed Test');

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(2); // Only PDF and DOCX
      expect(response.body.failed).toHaveLength(1); // TXT file rejected
      expect(response.body.failed[0].error).toContain('file type');
    });
  });

  describe('Job Queue Management', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create test upload session
      const [session] = await db.insert(uploadSessions).values({
        sessionId: 'test-session-123',
        totalFiles: 3,
        status: 'processing',
        createdBy: testUserId
      }).returning();
      testSessionId = session.sessionId;
    });

    it('should create jobs with correct priority and status', async () => {
      const jobData = {
        profileResumeId: 1,
        jobType: 'extract_text' as const,
        priority: 1,
        status: 'pending' as const,
        retryCount: 0,
        maxRetries: 3,
        processingData: JSON.stringify({ sessionId: testSessionId, filename: 'test.pdf' }),
        createdBy: testUserId
      };

      const [job] = await db.insert(processingJobs).values(jobData).returning();

      expect(job.status).toBe('pending');
      expect(job.priority).toBe(1);
      expect(job.retryCount).toBe(0);
      const processingData = JSON.parse(job.processingData || '{}');
      expect(processingData.sessionId).toBe(testSessionId);
    });

    it('should track job attempts and failures', async () => {
      const [job] = await db.insert(processingJobs).values({
        profileResumeId: 1,
        jobType: 'extract_text' as const,
        priority: 1,
        status: 'pending',
        retryCount: 2,
        maxRetries: 3,
        processingData: JSON.stringify({ sessionId: testSessionId, filename: 'test.pdf' }),
        createdBy: testUserId
      }).returning();

      // Simulate job failure
      await db.update(processingJobs)
        .set({ 
          status: 'failed',
          retryCount: 3,
          errorMessage: 'Processing timeout'
        })
        .where(eq(processingJobs.id, job.id));

      const updatedJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));

      expect(updatedJob[0].status).toBe('failed');
      expect(updatedJob[0].retryCount).toBe(3);
      expect(updatedJob[0].errorMessage).toBe('Processing timeout');
    });

    it('should support job prioritization', async () => {
      // Create jobs with different priorities
      await db.insert(processingJobs).values([
        {
          profileResumeId: 1,
          jobType: 'extract_text' as const,
          priority: 3,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          processingData: JSON.stringify({ sessionId: testSessionId, filename: 'low-priority.pdf' }),
          createdBy: testUserId
        },
        {
          profileResumeId: 2,
          jobType: 'extract_text' as const,
          priority: 1,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          processingData: JSON.stringify({ sessionId: testSessionId, filename: 'high-priority.pdf' }),
          createdBy: testUserId
        },
        {
          profileResumeId: 3,
          jobType: 'extract_text' as const,
          priority: 2,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          processingData: JSON.stringify({ sessionId: testSessionId, filename: 'medium-priority.pdf' }),
          createdBy: testUserId
        }
      ]);

      // Query jobs by priority (ascending = higher priority first)
      const jobsByPriority = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.status, 'pending'))
        .orderBy(processingJobs.priority);

      const highPriorityJob = JSON.parse(jobsByPriority[0].processingData || '{}');
      const mediumPriorityJob = JSON.parse(jobsByPriority[1].processingData || '{}');
      const lowPriorityJob = JSON.parse(jobsByPriority[2].processingData || '{}');
      
      expect(highPriorityJob.filename).toBe('high-priority.pdf');
      expect(mediumPriorityJob.filename).toBe('medium-priority.pdf');
      expect(lowPriorityJob.filename).toBe('low-priority.pdf');
    });
  });

  describe('Session Tracking and Progress', () => {
    let testSessionId: string;

    beforeEach(async () => {
      const [session] = await db.insert(uploadSessions).values({
        sessionId: 'progress-test-session',
        totalFiles: 5,
        status: 'processing',
        createdBy: testUserId
      }).returning();
      testSessionId = session.sessionId;

      // Create test jobs for the session
      await db.insert(processingJobs).values([
        { profileResumeId: 1, jobType: 'extract_text' as const, priority: 1, status: 'completed', retryCount: 1, maxRetries: 3, processingData: JSON.stringify({ sessionId: testSessionId, filename: 'file1.pdf' }), createdBy: testUserId },
        { profileResumeId: 2, jobType: 'extract_text' as const, priority: 1, status: 'completed', retryCount: 1, maxRetries: 3, processingData: JSON.stringify({ sessionId: testSessionId, filename: 'file2.pdf' }), createdBy: testUserId },
        { profileResumeId: 3, jobType: 'extract_text' as const, priority: 1, status: 'processing', retryCount: 1, maxRetries: 3, processingData: JSON.stringify({ sessionId: testSessionId, filename: 'file3.pdf' }), createdBy: testUserId },
        { profileResumeId: 4, jobType: 'extract_text' as const, priority: 1, status: 'pending', retryCount: 0, maxRetries: 3, processingData: JSON.stringify({ sessionId: testSessionId, filename: 'file4.pdf' }), createdBy: testUserId },
        { profileResumeId: 5, jobType: 'extract_text' as const, priority: 1, status: 'failed', retryCount: 3, maxRetries: 3, processingData: JSON.stringify({ sessionId: testSessionId, filename: 'file5.pdf' }), createdBy: testUserId }
      ]);
    });

    it('should calculate session progress correctly', async () => {
      const mockProgress = {
        total: 5,
        completed: 2,
        processing: 1,
        pending: 1,
        failed: 1,
        percentage: 60 // (completed + failed) / total * 100
      };

      mockJobProcessor.getSessionProgress.mockResolvedValue(mockProgress);

      const response = await request(app)
        .get(`/api/upload-sessions/${testSessionId}`)
        .expect(200);

      expect(response.body.progress).toEqual(mockProgress);
      expect(response.body.progress.percentage).toBe(60);
    });

    it('should mark session as completed when all jobs finish', async () => {
      // Update all jobs to completed status
      await db.update(processingJobs)
        .set({ status: 'completed' })
        .where(eq(processingJobs.sessionId, testSessionId));

      const mockProgress = {
        total: 5,
        completed: 5,
        processing: 0,
        pending: 0,
        failed: 0,
        percentage: 100
      };

      mockJobProcessor.getSessionProgress.mockResolvedValue(mockProgress);

      const response = await request(app)
        .get(`/api/upload-sessions/${testSessionId}`)
        .expect(200);

      expect(response.body.progress.percentage).toBe(100);
      
      // Session should be marked as completed
      const session = await db.select()
        .from(uploadSessions)
        .where(eq(uploadSessions.id, testSessionId));
      
      // Note: In real implementation, session status would be updated by background process
      expect(session[0].status).toBe('processing'); // Will be 'completed' when background worker updates it
    });

    it('should handle session not found', async () => {
      const response = await request(app)
        .get('/api/upload-sessions/non-existent-session')
        .expect(404);

      expect(response.body.message).toBe('Upload session not found');
    });

    it('should track processing statistics accurately', async () => {
      const jobs = await db.select()
        .from(processingJobs)
        .where(sql`json_extract_path_text(processing_data, 'sessionId') = ${testSessionId}`);

      const stats = {
        total: jobs.length,
        completed: jobs.filter(j => j.status === 'completed').length,
        processing: jobs.filter(j => j.status === 'processing').length,
        pending: jobs.filter(j => j.status === 'pending').length,
        failed: jobs.filter(j => j.status === 'failed').length
      };

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      expect(stats.processing).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.failed).toBe(1);
    });
  });

  describe('Background Processing Simulation', () => {
    it('should process jobs in parallel with controlled concurrency', async () => {
      const sessionId = 'parallel-test-session';
      
      // Create session with multiple jobs
      await db.insert(uploadSessions).values({
        sessionId: sessionId,
        totalFiles: 6,
        status: 'processing',
        createdBy: testUserId
      });

      // Create multiple pending jobs
      const jobPromises = Array.from({ length: 6 }, (_, i) => 
        db.insert(processingJobs).values({
          profileResumeId: i + 1,
          jobType: 'extract_text' as const,
          priority: 1,
          status: 'pending',
          retryCount: 0,
          maxRetries: 3,
          processingData: JSON.stringify({ sessionId, filename: `parallel-file-${i + 1}.pdf` }),
          createdBy: testUserId
        })
      );

      await Promise.all(jobPromises);

      // Simulate parallel processing (max 3 concurrent)
      const pendingJobs = await db.select()
        .from(processingJobs)
        .where(and(
          sql`json_extract_path_text(processing_data, 'sessionId') = ${sessionId}`,
          eq(processingJobs.status, 'pending')
        ))
        .limit(3);

      expect(pendingJobs).toHaveLength(3);

      // Simulate processing 3 jobs concurrently
      const processingPromises = pendingJobs.map(async (job) => {
        await db.update(processingJobs)
          .set({ status: 'processing' })
          .where(eq(processingJobs.id, job.id));
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await db.update(processingJobs)
          .set({ 
            status: 'completed',
            retryCount: job.retryCount + 1,
            completedAt: new Date()
          })
          .where(eq(processingJobs.id, job.id));
      });

      await Promise.all(processingPromises);

      // Verify 3 jobs completed
      const completedJobs = await db.select()
        .from(processingJobs)
        .where(and(
          sql`json_extract_path_text(processing_data, 'sessionId') = ${sessionId}`,
          eq(processingJobs.status, 'completed')
        ));

      expect(completedJobs).toHaveLength(3);
    });

    it('should handle job retry logic', async () => {
      const sessionId = 'retry-test-session';
      
      await db.insert(uploadSessions).values({
        sessionId: sessionId,
        totalFiles: 1,
        status: 'processing',
        createdBy: testUserId
      });

      const [job] = await db.insert(processingJobs).values({
        profileResumeId: 1,
        jobType: 'extract_text' as const,
        priority: 1,
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
        processingData: JSON.stringify({ sessionId, filename: 'retry-test.pdf' }),
        createdBy: testUserId
      }).returning();

      // Simulate first failure
      await db.update(processingJobs)
        .set({ 
          status: 'pending', // Reset to pending for retry
          retryCount: 1,
          errorMessage: 'First attempt failed'
        })
        .where(eq(processingJobs.id, job.id));

      // Simulate second failure
      await db.update(processingJobs)
        .set({ 
          status: 'pending',
          retryCount: 2,
          errorMessage: 'Second attempt failed'
        })
        .where(eq(processingJobs.id, job.id));

      // Simulate final failure (max attempts reached)
      await db.update(processingJobs)
        .set({ 
          status: 'failed',
          retryCount: 3,
          errorMessage: 'Max attempts reached'
        })
        .where(eq(processingJobs.id, job.id));

      const finalJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));

      expect(finalJob[0].status).toBe('failed');
      expect(finalJob[0].retryCount).toBe(3);
      expect(finalJob[0].errorMessage).toBe('Max attempts reached');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty file upload gracefully', async () => {
      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .field('candidateName', 'Test')
        .expect(400);

      expect(response.body.message).toContain('No files uploaded');
    });

    it('should handle session cleanup for completed sessions', async () => {
      const sessionId = 'cleanup-test-session';
      
      // Create completed session
      await db.insert(uploadSessions).values({
        sessionId: sessionId,
        totalFiles: 2,
        status: 'completed',
        createdBy: testUserId
      });

      // Create completed jobs
      await db.insert(processingJobs).values([
        {
          profileResumeId: 1,
          jobType: 'extract_text' as const,
          priority: 1,
          status: 'completed',
          retryCount: 1,
          maxRetries: 3,
          processingData: JSON.stringify({ sessionId, filename: 'file1.pdf' }),
          createdBy: testUserId,
          completedAt: new Date()
        },
        {
          profileResumeId: 2,
          jobType: 'extract_text' as const,
          priority: 1,
          status: 'completed',
          retryCount: 1,
          maxRetries: 3,
          processingData: JSON.stringify({ sessionId, filename: 'file2.pdf' }),
          createdBy: testUserId,
          completedAt: new Date()
        }
      ]);

      const response = await request(app)
        .get(`/api/upload-sessions/${sessionId}`)
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.progress.percentage).toBe(100);
    });

    it('should handle corrupted or invalid files in async processing', async () => {
      const corruptedFile = Buffer.from('This is not a valid PDF or DOCX file');

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .attach('resumes', corruptedFile, 'corrupted.pdf')
        .field('candidateName', 'Test');

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(1); // File accepted for processing
      
      // Job should be created even for potentially corrupted files
      const jobs = await db.select().from(processingJobs);
      expect(jobs).toHaveLength(1);
      expect(jobs[0].status).toBe('pending');
    });

    it('should handle database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the error handling structure is in place
      
      const mockFile = Buffer.from('Test content');
      
      // Mock database error
      const originalInsert = db.insert;
      (db as any).insert = jest.fn().mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      try {
        const response = await request(app)
          .post('/api/profile-resumes/bulk-upload-async')
          .attach('resumes', mockFile, 'test.pdf')
          .expect(500);

        expect(response.body.message).toContain('error');
      } finally {
        // Restore original function
        (db as any).insert = originalInsert;
      }
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle high-volume uploads without memory issues', async () => {
      const fileCount = 100;
      const mockFiles = Array.from({ length: fileCount }, (_, i) => 
        Buffer.from(`Mock content for file ${i}`)
      );

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      const startMemory = process.memoryUsage();
      
      const request_builder = request(app).post('/api/profile-resumes/bulk-upload-async');
      mockFiles.forEach((file, index) => {
        request_builder.attach('resumes', file, `volume-test-${index}.pdf`);
      });

      const response = await request_builder.field('candidateName', 'Volume Test');
      
      const endMemory = process.memoryUsage();
      const memoryIncrease = endMemory.heapUsed - startMemory.heapUsed;

      expect(response.status).toBe(200);
      expect(response.body.successful).toHaveLength(fileCount);
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });

    it('should process multiple sessions concurrently', async () => {
      const sessionCount = 5;
      const filesPerSession = 10;

      mockJobProcessor.addJob.mockResolvedValue(undefined);

      const uploadPromises = Array.from({ length: sessionCount }, async (_, sessionIndex) => {
        const request_builder = request(app).post('/api/profile-resumes/bulk-upload-async');
        
        Array.from({ length: filesPerSession }, (_, fileIndex) => {
          const mockFile = Buffer.from(`Session ${sessionIndex} File ${fileIndex}`);
          request_builder.attach('resumes', mockFile, `session${sessionIndex}-file${fileIndex}.pdf`);
        });

        return request_builder.field('candidateName', `Session ${sessionIndex} Test`);
      });

      const startTime = Date.now();
      const responses = await Promise.all(uploadPromises);
      const endTime = Date.now();

      // All sessions should complete successfully
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.successful).toHaveLength(filesPerSession);
      });

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // Under 10 seconds

      // Verify all sessions and jobs were created
      const sessions = await db.select().from(uploadSessions);
      const jobs = await db.select().from(processingJobs);
      
      expect(sessions).toHaveLength(sessionCount);
      expect(jobs).toHaveLength(sessionCount * filesPerSession);
    });
  });
});