import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';

describe('Jobs Service', () => {
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

  describe('GET /api/jobs', () => {
    it('should return all jobs when authenticated', async () => {
      const response = await request(app)
        .get('/api/jobs')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/jobs');

      expect(response.status).toBe(401);
    });

    it('should filter jobs by status when provided', async () => {
      const response = await request(app)
        .get('/api/jobs?status=Active')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle search parameter', async () => {
      const response = await request(app)
        .get('/api/jobs?search=developer')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/jobs/:id', () => {
    it('should return job details for valid ID', async () => {
      // First get all jobs to find a valid ID
      const jobsResponse = await request(app)
        .get('/api/jobs')
        .set('Cookie', authCookies);

      if (jobsResponse.body.length > 0) {
        const jobId = jobsResponse.body[0].id;
        
        const response = await request(app)
          .get(`/api/jobs/${jobId}`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(jobId);
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('description');
        expect(response.body).toHaveProperty('assignedRecruiters');
        expect(response.body).toHaveProperty('submissions');
      }
    });

    it('should return 400 for invalid job ID', async () => {
      const response = await request(app)
        .get('/api/jobs/invalid')
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid job ID');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/jobs/99999')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Job not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/jobs/1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/jobs', () => {
    const validJobData = {
      jobId: 'TEST-JOB-001',
      title: 'Test Software Engineer',
      description: 'Test job description for a software engineer position',
      requirements: 'JavaScript, React, Node.js',
      location: 'New York, NY',
      salaryRange: '$80,000 - $120,000',
      status: 'Active',
      priority: 'High',
      clientName: 'Test Client Corp',
      assignedRecruiters: []
    };

    it('should create a new job with valid data', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send(validJobData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(validJobData.title);
      expect(response.body.jobId).toBe(validJobData.jobId);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        title: 'Test Job'
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for duplicate job ID', async () => {
      // Try to create the same job again
      const response = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send(validJobData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/jobs')
        .send(validJobData);

      expect(response.status).toBe(401);
    });

    it('should validate job status values', async () => {
      const invalidStatusData = {
        ...validJobData,
        jobId: 'TEST-JOB-002',
        status: 'InvalidStatus'
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send(invalidStatusData);

      expect(response.status).toBe(400);
    });

    it('should validate priority values', async () => {
      const invalidPriorityData = {
        ...validJobData,
        jobId: 'TEST-JOB-003',
        priority: 'InvalidPriority'
      };

      const response = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send(invalidPriorityData);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/jobs/:id', () => {
    let testJobId: number;

    beforeAll(async () => {
      // Create a test job for updating
      const createResponse = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send({
          jobId: 'TEST-UPDATE-001',
          title: 'Job to Update',
          description: 'This job will be updated',
          requirements: 'Initial requirements',
          location: 'Initial Location',
          salaryRange: '$50,000 - $70,000',
          status: 'Active',
          priority: 'Medium',
          clientName: 'Update Test Client',
          assignedRecruiters: []
        });

      testJobId = createResponse.body.id;
    });

    it('should update job with valid data', async () => {
      const updateData = {
        title: 'Updated Job Title',
        description: 'Updated job description',
        status: 'Closed',
        priority: 'High'
      };

      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .set('Cookie', authCookies)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.title).toBe(updateData.title);
      expect(response.body.status).toBe(updateData.status);
    });

    it('should return 400 for invalid job ID', async () => {
      const response = await request(app)
        .put('/api/jobs/invalid')
        .set('Cookie', authCookies)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid job ID');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .put('/api/jobs/99999')
        .set('Cookie', authCookies)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Job not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(401);
    });

    it('should validate status values on update', async () => {
      const response = await request(app)
        .put(`/api/jobs/${testJobId}`)
        .set('Cookie', authCookies)
        .send({ status: 'InvalidStatus' });

      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/jobs/:id', () => {
    let testJobId: number;

    beforeEach(async () => {
      // Create a test job for deletion
      const createResponse = await request(app)
        .post('/api/jobs')
        .set('Cookie', authCookies)
        .send({
          jobId: `TEST-DELETE-${Date.now()}`,
          title: 'Job to Delete',
          description: 'This job will be deleted',
          requirements: 'Test requirements',
          location: 'Test Location',
          salaryRange: '$50,000 - $70,000',
          status: 'Active',
          priority: 'Medium',
          clientName: 'Delete Test Client',
          assignedRecruiters: []
        });

      testJobId = createResponse.body.id;
    });

    it('should delete job successfully', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${testJobId}`)
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted');

      // Verify job is deleted by trying to fetch it
      const getResponse = await request(app)
        .get(`/api/jobs/${testJobId}`)
        .set('Cookie', authCookies);

      expect(getResponse.status).toBe(404);
    });

    it('should return 400 for invalid job ID', async () => {
      const response = await request(app)
        .delete('/api/jobs/invalid')
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid job ID');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .delete('/api/jobs/99999')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Job not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .delete(`/api/jobs/${testJobId}`);

      expect(response.status).toBe(401);
    });
  });
});