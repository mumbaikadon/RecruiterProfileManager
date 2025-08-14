import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';

describe('Candidates Service', () => {
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

  describe('GET /api/candidates', () => {
    it('should return all candidates when authenticated', async () => {
      const response = await request(app)
        .get('/api/candidates')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/candidates');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/candidates/:id', () => {
    it('should return candidate details for valid ID', async () => {
      // First get all candidates to find a valid ID
      const candidatesResponse = await request(app)
        .get('/api/candidates')
        .set('Cookie', authCookies);

      if (candidatesResponse.body.length > 0) {
        const candidateId = candidatesResponse.body[0].id;
        
        const response = await request(app)
          .get(`/api/candidates/${candidateId}`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        expect(response.body.id).toBe(candidateId);
        expect(response.body).toHaveProperty('firstName');
        expect(response.body).toHaveProperty('lastName');
        expect(response.body).toHaveProperty('email');
        expect(response.body).toHaveProperty('phone');
        expect(response.body).toHaveProperty('submissions');
      }
    });

    it('should return 400 for invalid candidate ID', async () => {
      const response = await request(app)
        .get('/api/candidates/invalid')
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid candidate ID');
    });

    it('should return 404 for non-existent candidate', async () => {
      const response = await request(app)
        .get('/api/candidates/99999')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Candidate not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/candidates/1');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/candidates', () => {
    const validCandidateData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1-555-0123',
      dobMonth: 6,
      dobDay: 15,
      ssn4: '1234',
      location: 'New York, NY',
      workAuthorization: 'US Citizen',
      source: 'LinkedIn',
      notes: 'Excellent candidate for software engineering roles',
      skills: ['JavaScript', 'React', 'Node.js'],
      experience: 5
    };

    it('should create a new candidate with valid data', async () => {
      const response = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(validCandidateData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.firstName).toBe(validCandidateData.firstName);
      expect(response.body.lastName).toBe(validCandidateData.lastName);
      expect(response.body.email).toBe(validCandidateData.email);
    });

    it('should return 400 for missing required fields', async () => {
      const incompleteData = {
        firstName: 'Jane',
        lastName: 'Smith'
        // Missing other required fields like email, phone, etc.
      };

      const response = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(incompleteData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
    });

    it('should return 400 for duplicate email', async () => {
      // Try to create candidate with same email
      const response = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(validCandidateData);

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already exists');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/candidates')
        .send(validCandidateData);

      expect(response.status).toBe(401);
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        ...validCandidateData,
        email: 'invalid-email'
      };

      const response = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(invalidEmailData);

      expect(response.status).toBe(400);
    });

    it('should validate phone format', async () => {
      const invalidPhoneData = {
        ...validCandidateData,
        email: 'test2@example.com',
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(invalidPhoneData);

      expect(response.status).toBe(400);
    });

    it('should validate work authorization values', async () => {
      const invalidWorkAuthData = {
        ...validCandidateData,
        email: 'test3@example.com',
        workAuthorization: 'Invalid Status'
      };

      const response = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(invalidWorkAuthData);

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/candidates/:id', () => {
    let testCandidateId: number;

    beforeAll(async () => {
      // Create a test candidate for updating
      const createResponse = await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send({
          firstName: 'Update',
          lastName: 'Test',
          email: 'update.test@example.com',
          phone: '+1-555-0199',
          dobMonth: 3,
          dobDay: 20,
          ssn4: '9999',
          location: 'Update City, CA',
          workAuthorization: 'H1B',
          source: 'Referral',
          notes: 'Candidate for testing updates'
        });

      testCandidateId = createResponse.body.id;
    });

    it('should update candidate with valid data', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        location: 'San Francisco, CA',
        notes: 'Updated notes for candidate'
      };

      const response = await request(app)
        .put(`/api/candidates/${testCandidateId}`)
        .set('Cookie', authCookies)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe(updateData.firstName);
      expect(response.body.lastName).toBe(updateData.lastName);
      expect(response.body.location).toBe(updateData.location);
    });

    it('should return 400 for invalid candidate ID', async () => {
      const response = await request(app)
        .put('/api/candidates/invalid')
        .set('Cookie', authCookies)
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid candidate ID');
    });

    it('should return 404 for non-existent candidate', async () => {
      const response = await request(app)
        .put('/api/candidates/99999')
        .set('Cookie', authCookies)
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Candidate not found');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .put(`/api/candidates/${testCandidateId}`)
        .send({ firstName: 'Updated' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/candidates/validate', () => {
    it('should validate candidate data successfully', async () => {
      const validationData = {
        firstName: 'Test',
        lastName: 'Validation',
        email: 'test.validation@example.com',
        phone: '+1-555-0188',
        dobMonth: 8,
        dobDay: 25,
        ssn4: '5678'
      };

      const response = await request(app)
        .post('/api/candidates/validate')
        .set('Cookie', authCookies)
        .send(validationData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('isValid');
      expect(response.body).toHaveProperty('duplicates');
      expect(response.body).toHaveProperty('potentialMatches');
    });

    it('should detect duplicate candidates', async () => {
      // First create a candidate
      const candidateData = {
        firstName: 'Duplicate',
        lastName: 'Test',
        email: 'duplicate.test@example.com',
        phone: '+1-555-0177',
        dobMonth: 12,
        dobDay: 10,
        ssn4: '4321',
        location: 'Test City, TX',
        workAuthorization: 'US Citizen',
        source: 'Test'
      };

      await request(app)
        .post('/api/candidates')
        .set('Cookie', authCookies)
        .send(candidateData);

      // Now validate with same data
      const response = await request(app)
        .post('/api/candidates/validate')
        .set('Cookie', authCookies)
        .send(candidateData);

      expect(response.status).toBe(200);
      expect(response.body.duplicates.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing validation data', async () => {
      const response = await request(app)
        .post('/api/candidates/validate')
        .set('Cookie', authCookies)
        .send({});

      expect(response.status).toBe(400);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .post('/api/candidates/validate')
        .send({
          firstName: 'Test',
          lastName: 'User'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Candidate Search and Filtering', () => {
    it('should search candidates by name', async () => {
      const response = await request(app)
        .get('/api/candidates?search=John')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter candidates by work authorization', async () => {
      const response = await request(app)
        .get('/api/candidates?workAuth=US Citizen')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter candidates by location', async () => {
      const response = await request(app)
        .get('/api/candidates?location=New York')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});