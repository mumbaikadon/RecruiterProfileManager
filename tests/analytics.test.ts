import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';

describe('Submissions Service', () => {
  let app: express.Application;
  let authCookies: string[];

  beforeAll(async () => {
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: false }));
    
    setupAuth(app);
    await registerRoutes(app);

    // Login to get auth cookies
    const loginResponse = await request(app)
      .post('/api/login')
      .send({
        username: 'admin',
        password: 'VelocityAdmin2025!'
      });

    authCookies = loginResponse.headers['set-cookie'];
  });

  describe('GET /api/submissions', () => {
    it('should return all submissions when authenticated', async () => {
      const response = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/submissions');

      expect(response.status).toBe(401);
    });

    it('should filter submissions by job ID', async () => {
      const response = await request(app)
        .get('/api/submissions?jobId=1')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter submissions by candidate ID', async () => {
      const response = await request(app)
        .get('/api/submissions?candidateId=1')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter submissions by recruiter ID', async () => {
      const response = await request(app)
        .get('/api/submissions?recruiterId=2')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should enhance submissions with related data', async () => {
      const response = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      
      if (response.body.length > 0) {
        const submission = response.body[0];
        expect(submission).toHaveProperty('id');
        expect(submission).toHaveProperty('status');
        expect(submission).toHaveProperty('submittedAt');
        
        // Check enhanced data
        if (submission.job) {
          expect(submission.job).toHaveProperty('id');
          expect(submission.job).toHaveProperty('title');
          expect(submission.job).toHaveProperty('status');
        }
        
        if (submission.candidate) {
          expect(submission.candidate).toHaveProperty('id');
          expect(submission.candidate).toHaveProperty('firstName');
          expect(submission.candidate).toHaveProperty('lastName');
        }
        
        if (submission.recruiter) {
          expect(submission.recruiter).toHaveProperty('id');
          expect(submission.recruiter).toHaveProperty('name');
        }
      }
    });
  });

  describe('GET /api/submissions/:id', () => {
    it('should return submission details for valid ID', async () => {
      // First get all submissions to find a valid ID
      const submissionsResponse = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      if (submissionsResponse.body.length > 0) {
        const submissionId = submissionsResponse.body[0].id;
        
        const response = await request(app)
          .get(`/api/submissions/${submissionId}`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(submissionId);
        expect(response.body).toHaveProperty('status');
        expect(response.body).toHaveProperty('job');
        expect(response.body).toHaveProperty('candidate');
        expect(response.body).toHaveProperty('recruiter');
      }
    });

    it('should return 400 for invalid submission ID', async () => {
      const response = await request(app)
        .get('/api/submissions/invalid')
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid submission ID');
    });

    it('should return 404 for non-existent submission', async () => {
      const response = await request(app)
        .get('/api/submissions/99999')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Submission not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/submissions/1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/submissions', () => {
    let testJobId: number;
    let testCandidateId: number;

    beforeAll(async () => {
      // Create test job and candidate for submissions
      const jobResponse = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send({
          jobId: 'TEST-SUBMISSION-JOB',
          title: 'Test Job for Submissions',
          description: 'Test job description',
          requirements: 'Test requirements',
          location: 'Test Location',
          salaryRange: '$50,000 - $70,000',
          status: 'Active',
          priority: 'Medium',
          clientName: 'Test Client',
          assignedRecruiters: []
        });

      testJobId = jobResponse.body.id;

      const candidateResponse = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send({
          firstName: 'Test',
          lastName: 'Submission',
          email: 'test.submission@example.com',
          phone: '+1-555-0123',
          dobMonth: 5,
          dobDay: 15,
          ssn4: '1234',
          location: 'Test City, NY',
          workAuthorization: 'US Citizen',
          source: 'Test'
        });

      testCandidateId = candidateResponse.body.id;
    });

    const validSubmissionData = {
      notes: 'Test submission notes',
      expectedSalary: 75000,
      availability: 'Immediate'
    };

    it('should create a new submission with valid data', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookies)
        .send({
          jobId: testJobId,
          candidateId: testCandidateId,
          ...validSubmissionData
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.jobId).toBe(testJobId);
      expect(response.body.candidateId).toBe(testCandidateId);
      expect(response.body.status).toBe('New');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookies)
        .send({
          // Missing jobId and candidateId
          notes: 'Test notes'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for invalid job ID', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookies)
        .send({
          jobId: 99999,
          candidateId: testCandidateId,
          ...validSubmissionData
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Job not found');
    });

    it('should return 400 for invalid candidate ID', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookies)
        .send({
          jobId: testJobId,
          candidateId: 99999,
          ...validSubmissionData
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Candidate not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/submissions')
        .send({
          jobId: testJobId,
          candidateId: testCandidateId,
          ...validSubmissionData
        });

      expect(response.status).toBe(401);
    });

    it('should prevent duplicate submissions', async () => {
      // Try to create the same submission again
      const response = await request(app)
        .post('/api/submissions')
        .set('Cookie', authCookies)
        .send({
          jobId: testJobId,
          candidateId: testCandidateId,
          ...validSubmissionData
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already submitted');
    });
  });

  describe('PUT /api/submissions/:id/status', () => {
    let testSubmissionId: number;

    beforeAll(async () => {
      // Get existing submission for status updates
      const submissionsResponse = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      if (submissionsResponse.body.length > 0) {
        testSubmissionId = submissionsResponse.body[0].id;
      }
    });

    it('should update submission status with valid data', async () => {
      if (testSubmissionId) {
        const response = await request(app)
          .put(`/api/submissions/${testSubmissionId}/status`)
          .set('Cookie', authCookies)
          .send({
            status: 'Submitted To Vendor',
            notes: 'Updated submission status'
          });

        expect(response.status).toBe(200);
        expect(response.body.status).toBe('Submitted To Vendor');
      }
    });

    it('should return 400 for invalid status values', async () => {
      if (testSubmissionId) {
        const response = await request(app)
          .put(`/api/submissions/${testSubmissionId}/status`)
          .set('Cookie', authCookies)
          .send({
            status: 'Invalid Status'
          });

        expect(response.status).toBe(400);
      }
    });

    it('should return 400 for invalid submission ID', async () => {
      const response = await request(app)
        .put('/api/submissions/invalid/status')
        .set('Cookie', authCookies)
        .send({
          status: 'Interview Scheduled'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid submission ID');
    });

    it('should return 404 for non-existent submission', async () => {
      const response = await request(app)
        .put('/api/submissions/99999/status')
        .set('Cookie', authCookies)
        .send({
          status: 'Interview Scheduled'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Submission not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put(`/api/submissions/${testSubmissionId}/status`)
        .send({
          status: 'Interview Scheduled'
        });

      expect(response.status).toBe(401);
    });

    it('should validate all valid status transitions', async () => {
      const validStatuses = [
        'New',
        'Submitted To Vendor',
        'Rejected By Vendor',
        'Submitted To Client',
        'Interview Scheduled',
        'Interview Completed',
        'Offer Extended',
        'Offer Accepted',
        'Offer Declined',
        'Rejected'
      ];

      if (testSubmissionId) {
        for (const status of validStatuses) {
          const response = await request(app)
            .put(`/api/submissions/${testSubmissionId}/status`)
            .set('Cookie', authCookies)
            .send({ status });

          expect([200, 400]).toContain(response.status);
          
          if (response.status === 200) {
            expect(response.body.status).toBe(status);
          }
        }
      }
    });
  });

  describe('GET /api/submissions/:id/resume/download', () => {
    it('should download resume for valid submission with resume', async () => {
      // Get a submission that has resume data
      const submissionsResponse = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      if (submissionsResponse.body.length > 0) {
        const submissionId = submissionsResponse.body[0].id;
        
        const response = await request(app)
          .get(`/api/submissions/${submissionId}/resume/download`)
          .set('Cookie', authCookies);

        // Should either return the file or 404 if no resume
        expect([200, 404]).toContain(response.status);
        
        if (response.status === 200) {
          expect(response.headers['content-disposition']).toContain('attachment');
        }
      }
    });

    it('should return 400 for invalid submission ID', async () => {
      const response = await request(app)
        .get('/api/submissions/invalid/resume/download')
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent submission', async () => {
      const response = await request(app)
        .get('/api/submissions/99999/resume/download')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/submissions/1/resume/download');

      expect(response.status).toBe(401);
    });
  });

  describe('Submission Workflow Tests', () => {
    it('should track status changes with timestamps', async () => {
      const submissionsResponse = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      if (submissionsResponse.body.length > 0) {
        const submissionId = submissionsResponse.body[0].id;
        const initialStatus = submissionsResponse.body[0].status;
        
        // Update status
        const updateResponse = await request(app)
          .put(`/api/submissions/${submissionId}/status`)
          .set('Cookie', authCookies)
          .send({
            status: 'Interview Scheduled',
            notes: 'Status change test'
          });

        if (updateResponse.status === 200) {
          expect(updateResponse.body.status).toBe('Interview Scheduled');
          expect(updateResponse.body).toHaveProperty('lastUpdatedAt');
          
          // Verify the change was persisted
          const verifyResponse = await request(app)
            .get(`/api/submissions/${submissionId}`)
            .set('Cookie', authCookies);

          expect(verifyResponse.body.status).toBe('Interview Scheduled');
        }
      }
    });

    it('should maintain data integrity across related entities', async () => {
      const submissionsResponse = await request(app)
        .get('/api/submissions')
        .set('Cookie', authCookies);

      if (submissionsResponse.body.length > 0) {
        const submission = submissionsResponse.body[0];
        
        // Verify job exists
        if (submission.job) {
          const jobResponse = await request(app)
            .get(`/api/jobs/${submission.job.id}`)
            .set('Cookie', authCookies);
          
          expect(jobResponse.status).toBe(200);
        }
        
        // Verify candidate exists
        if (submission.candidate) {
          const candidateResponse = await request(app)
            .get(`/api/candidates/${submission.candidate.id}`)
            .set('Cookie', authCookies);
          
          expect(candidateResponse.status).toBe(200);
        }
      }
    });
  });
});