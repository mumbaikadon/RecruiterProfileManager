/**
 * Simple test suite for Asynchronous File Processing System
 * Tests core database operations and API endpoints for async functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { db } from '../server/db';
import { profileResumes, resumeContent, processingJobs, uploadSessions } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { createTestApp } from './test-utils';

describe('Async Processing System - Core Tests', () => {
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

  describe('Upload Sessions Table Operations', () => {
    it('should create upload session with correct fields', async () => {
      const sessionData = {
        sessionId: 'test-session-123',
        totalFiles: 5,
        uploadedFiles: 0,
        processedFiles: 0,
        failedFiles: 0,
        status: 'uploading' as const,
        candidateName: 'Test Candidate',
        candidateEmail: 'test@example.com',
        createdBy: testUserId
      };

      const [session] = await db.insert(uploadSessions).values(sessionData).returning();

      expect(session.sessionId).toBe(sessionData.sessionId);
      expect(session.totalFiles).toBe(5);
      expect(session.status).toBe('uploading');
      expect(session.createdBy).toBe(testUserId);
    });

    it('should update session progress fields', async () => {
      const [session] = await db.insert(uploadSessions).values({
        sessionId: 'progress-test',
        totalFiles: 3,
        uploadedFiles: 0,
        processedFiles: 0,
        failedFiles: 0,
        status: 'uploading',
        createdBy: testUserId
      }).returning();

      // Update progress
      await db.update(uploadSessions)
        .set({ 
          uploadedFiles: 3,
          processedFiles: 2,
          failedFiles: 1,
          status: 'processing'
        })
        .where(eq(uploadSessions.sessionId, 'progress-test'));

      const updatedSession = await db.select()
        .from(uploadSessions)
        .where(eq(uploadSessions.sessionId, 'progress-test'));

      expect(updatedSession[0].uploadedFiles).toBe(3);
      expect(updatedSession[0].processedFiles).toBe(2);
      expect(updatedSession[0].failedFiles).toBe(1);
      expect(updatedSession[0].status).toBe('processing');
    });

    it('should handle session status transitions', async () => {
      const sessionId = 'status-test';
      
      // Create session
      await db.insert(uploadSessions).values({
        sessionId,
        totalFiles: 2,
        status: 'uploading',
        createdBy: testUserId
      });

      // uploading -> processing
      await db.update(uploadSessions)
        .set({ status: 'processing' })
        .where(eq(uploadSessions.sessionId, sessionId));

      let session = await db.select()
        .from(uploadSessions)
        .where(eq(uploadSessions.sessionId, sessionId));
      expect(session[0].status).toBe('processing');

      // processing -> completed
      await db.update(uploadSessions)
        .set({ status: 'completed' })
        .where(eq(uploadSessions.sessionId, sessionId));

      session = await db.select()
        .from(uploadSessions)
        .where(eq(uploadSessions.sessionId, sessionId));
      expect(session[0].status).toBe('completed');
    });
  });

  describe('Processing Jobs Table Operations', () => {
    let testResumeId: number;

    beforeEach(async () => {
      // Create a test resume first
      const [resume] = await db.insert(profileResumes).values({
        filename: 'test-job.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'test-data',
        uploadedBy: testUserId
      }).returning();
      testResumeId = resume.id;
    });

    it('should create processing job with all required fields', async () => {
      const jobData = {
        profileResumeId: testResumeId,
        jobType: 'extract_text' as const,
        status: 'pending' as const,
        priority: 1,
        retryCount: 0,
        maxRetries: 3,
        processingData: JSON.stringify({ 
          sessionId: 'test-session',
          filename: 'test.pdf',
          uploadPath: '/tmp/test.pdf'
        }),
        createdBy: testUserId
      };

      const [job] = await db.insert(processingJobs).values(jobData).returning();

      expect(job.profileResumeId).toBe(testResumeId);
      expect(job.jobType).toBe('extract_text');
      expect(job.status).toBe('pending');
      expect(job.priority).toBe(1);
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
      
      const processingData = JSON.parse(job.processingData || '{}');
      expect(processingData.sessionId).toBe('test-session');
      expect(processingData.filename).toBe('test.pdf');
    });

    it('should handle job status transitions and retry logic', async () => {
      const [job] = await db.insert(processingJobs).values({
        profileResumeId: testResumeId,
        jobType: 'extract_text',
        status: 'pending',
        priority: 1,
        retryCount: 0,
        maxRetries: 3,
        processingData: JSON.stringify({ sessionId: 'retry-test' }),
        createdBy: testUserId
      }).returning();

      // Start processing
      await db.update(processingJobs)
        .set({ 
          status: 'processing',
          startedAt: new Date()
        })
        .where(eq(processingJobs.id, job.id));

      let updatedJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));
      
      expect(updatedJob[0].status).toBe('processing');
      expect(updatedJob[0].startedAt).toBeDefined();

      // Simulate failure and retry
      await db.update(processingJobs)
        .set({ 
          status: 'retrying',
          retryCount: 1,
          errorMessage: 'Temporary processing error'
        })
        .where(eq(processingJobs.id, job.id));

      updatedJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));
      
      expect(updatedJob[0].status).toBe('retrying');
      expect(updatedJob[0].retryCount).toBe(1);
      expect(updatedJob[0].errorMessage).toBe('Temporary processing error');

      // Complete successfully
      await db.update(processingJobs)
        .set({ 
          status: 'completed',
          completedAt: new Date()
        })
        .where(eq(processingJobs.id, job.id));

      updatedJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));
      
      expect(updatedJob[0].status).toBe('completed');
      expect(updatedJob[0].completedAt).toBeDefined();
    });

    it('should handle max retries exceeded scenario', async () => {
      const [job] = await db.insert(processingJobs).values({
        profileResumeId: testResumeId,
        jobType: 'extract_text',
        status: 'pending',
        priority: 1,
        retryCount: 0,
        maxRetries: 2,
        processingData: JSON.stringify({ sessionId: 'max-retry-test' }),
        createdBy: testUserId
      }).returning();

      // First failure
      await db.update(processingJobs)
        .set({ 
          status: 'retrying',
          retryCount: 1,
          errorMessage: 'First failure'
        })
        .where(eq(processingJobs.id, job.id));

      // Second failure
      await db.update(processingJobs)
        .set({ 
          status: 'retrying',
          retryCount: 2,
          errorMessage: 'Second failure'
        })
        .where(eq(processingJobs.id, job.id));

      // Final failure - max retries exceeded
      await db.update(processingJobs)
        .set({ 
          status: 'failed',
          retryCount: 2,
          errorMessage: 'Max retries exceeded: Second failure'
        })
        .where(eq(processingJobs.id, job.id));

      const finalJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));

      expect(finalJob[0].status).toBe('failed');
      expect(finalJob[0].retryCount).toBe(2);
      expect(finalJob[0].errorMessage).toContain('Max retries exceeded');
    });

    it('should support different job types', async () => {
      const jobTypes = ['extract_text', 'generate_summary', 'analyze_content'] as const;
      
      for (const jobType of jobTypes) {
        const [job] = await db.insert(processingJobs).values({
          profileResumeId: testResumeId,
          jobType,
          status: 'pending',
          priority: 1,
          retryCount: 0,
          maxRetries: 3,
          processingData: JSON.stringify({ jobType }),
          createdBy: testUserId
        }).returning();

        expect(job.jobType).toBe(jobType);
      }
    });

    it('should handle job prioritization correctly', async () => {
      // Create jobs with different priorities
      const priorities = [5, 1, 3, 2, 4];
      
      for (const priority of priorities) {
        await db.insert(processingJobs).values({
          profileResumeId: testResumeId,
          jobType: 'extract_text',
          status: 'pending',
          priority,
          retryCount: 0,
          maxRetries: 3,
          processingData: JSON.stringify({ priority }),
          createdBy: testUserId
        });
      }

      // Query jobs by priority (ascending = higher priority first)
      const jobsByPriority = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.status, 'pending'))
        .orderBy(processingJobs.priority);

      expect(jobsByPriority).toHaveLength(5);
      expect(jobsByPriority[0].priority).toBe(1); // Highest priority
      expect(jobsByPriority[1].priority).toBe(2);
      expect(jobsByPriority[2].priority).toBe(3);
      expect(jobsByPriority[3].priority).toBe(4);
      expect(jobsByPriority[4].priority).toBe(5); // Lowest priority
    });
  });

  describe('Session Progress Calculation', () => {
    let sessionId: string;
    let testResumeIds: number[];

    beforeEach(async () => {
      sessionId = 'progress-calc-test';
      
      // Create test session
      await db.insert(uploadSessions).values({
        sessionId,
        totalFiles: 5,
        status: 'processing',
        createdBy: testUserId
      });

      // Create test resumes
      testResumeIds = [];
      for (let i = 0; i < 5; i++) {
        const [resume] = await db.insert(profileResumes).values({
          filename: `test-${i + 1}.pdf`,
          fileType: 'pdf',
          fileSize: 1024,
          fileData: `test-data-${i + 1}`,
          uploadedBy: testUserId
        }).returning();
        testResumeIds.push(resume.id);
      }
    });

    it('should calculate progress correctly with mixed job states', async () => {
      // Create jobs with different statuses
      const jobStatuses = ['completed', 'completed', 'processing', 'pending', 'failed'] as const;
      
      for (let i = 0; i < 5; i++) {
        await db.insert(processingJobs).values({
          profileResumeId: testResumeIds[i],
          jobType: 'extract_text',
          status: jobStatuses[i],
          priority: 1,
          retryCount: jobStatuses[i] === 'failed' ? 3 : 0,
          maxRetries: 3,
          processingData: JSON.stringify({ 
            sessionId,
            filename: `test-${i + 1}.pdf`,
            index: i + 1
          }),
          createdBy: testUserId
        });
      }

      // Calculate progress statistics
      const allJobs = await db.select().from(processingJobs);
      const sessionJobs = allJobs.filter(job => {
        try {
          const data = JSON.parse(job.processingData || '{}');
          return data.sessionId === sessionId;
        } catch {
          return false;
        }
      });

      const stats = {
        total: sessionJobs.length,
        completed: sessionJobs.filter(j => j.status === 'completed').length,
        processing: sessionJobs.filter(j => j.status === 'processing').length,
        pending: sessionJobs.filter(j => j.status === 'pending').length,
        failed: sessionJobs.filter(j => j.status === 'failed').length
      };

      const progressPercentage = Math.round(((stats.completed + stats.failed) / stats.total) * 100);

      expect(stats.total).toBe(5);
      expect(stats.completed).toBe(2);
      expect(stats.processing).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.failed).toBe(1);
      expect(progressPercentage).toBe(60); // (2 completed + 1 failed) / 5 * 100
    });

    it('should handle 100% completion correctly', async () => {
      // Create all completed jobs
      for (let i = 0; i < 5; i++) {
        await db.insert(processingJobs).values({
          profileResumeId: testResumeIds[i],
          jobType: 'extract_text',
          status: 'completed',
          priority: 1,
          retryCount: 1,
          maxRetries: 3,
          processingData: JSON.stringify({ 
            sessionId,
            filename: `test-${i + 1}.pdf`
          }),
          createdBy: testUserId,
          completedAt: new Date()
        });
      }

      const allJobs = await db.select().from(processingJobs);
      const sessionJobs = allJobs.filter(job => {
        try {
          const data = JSON.parse(job.processingData || '{}');
          return data.sessionId === sessionId;
        } catch {
          return false;
        }
      });

      const completedJobs = sessionJobs.filter(j => j.status === 'completed');
      const progressPercentage = Math.round((completedJobs.length / sessionJobs.length) * 100);

      expect(sessionJobs.length).toBe(5);
      expect(completedJobs.length).toBe(5);
      expect(progressPercentage).toBe(100);
    });
  });

  describe('API Integration Tests', () => {
    it('should handle upload session status endpoint', async () => {
      const sessionId = 'api-test-session';
      
      // Create test session
      await db.insert(uploadSessions).values({
        sessionId,
        totalFiles: 3,
        uploadedFiles: 3,
        processedFiles: 2,
        failedFiles: 1,
        status: 'processing',
        createdBy: testUserId
      });

      const response = await request(app)
        .get(`/api/upload-sessions/${sessionId}`)
        .expect(200);

      expect(response.body).toHaveProperty('sessionId');
      expect(response.body).toHaveProperty('totalFiles');
      expect(response.body).toHaveProperty('status');
      expect(response.body.sessionId).toBe(sessionId);
      expect(response.body.totalFiles).toBe(3);
      expect(response.body.status).toBe('processing');
    });

    it('should handle non-existent session gracefully', async () => {
      const response = await request(app)
        .get('/api/upload-sessions/non-existent-session')
        .expect(404);

      expect(response.body.message).toBe('Upload session not found');
    });

    it('should validate async upload endpoint structure', async () => {
      // Test with no files (should fail)
      const response = await request(app)
        .post('/api/profile-resumes/bulk-upload-async')
        .field('candidateName', 'Test Candidate')
        .expect(400);

      expect(response.body.message).toContain('No files uploaded');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid JSON in processingData gracefully', async () => {
      const [resume] = await db.insert(profileResumes).values({
        filename: 'invalid-json-test.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'test-data',
        uploadedBy: testUserId
      }).returning();

      // Insert job with invalid JSON
      const [job] = await db.insert(processingJobs).values({
        profileResumeId: resume.id,
        jobType: 'extract_text',
        status: 'pending',
        priority: 1,
        retryCount: 0,
        maxRetries: 3,
        processingData: 'invalid json string',
        createdBy: testUserId
      }).returning();

      // Should be able to query the job even with invalid JSON
      const retrievedJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));

      expect(retrievedJob).toHaveLength(1);
      expect(retrievedJob[0].processingData).toBe('invalid json string');
    });

    it('should handle concurrent job updates correctly', async () => {
      const [resume] = await db.insert(profileResumes).values({
        filename: 'concurrent-test.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        fileData: 'test-data',
        uploadedBy: testUserId
      }).returning();

      const [job] = await db.insert(processingJobs).values({
        profileResumeId: resume.id,
        jobType: 'extract_text',
        status: 'pending',
        priority: 1,
        retryCount: 0,
        maxRetries: 3,
        processingData: JSON.stringify({ sessionId: 'concurrent-test' }),
        createdBy: testUserId
      }).returning();

      // Simulate concurrent updates
      const updatePromises = [
        db.update(processingJobs)
          .set({ status: 'processing', startedAt: new Date() })
          .where(eq(processingJobs.id, job.id)),
        db.update(processingJobs)
          .set({ retryCount: 1 })
          .where(eq(processingJobs.id, job.id))
      ];

      await Promise.all(updatePromises);

      const finalJob = await db.select()
        .from(processingJobs)
        .where(eq(processingJobs.id, job.id));

      expect(finalJob).toHaveLength(1);
      // One of the updates should have been applied
      expect(finalJob[0].status === 'processing' || finalJob[0].retryCount === 1).toBe(true);
    });
  });
});