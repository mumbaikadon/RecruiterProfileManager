import request from 'supertest';
import express from 'express';
import { setupAuth, requireAuth } from '../server/auth';

describe('Authentication Service', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    setupAuth(app);
    
    // Test route that requires auth
    app.get('/api/test-protected', requireAuth, (req, res) => {
      res.json({ message: 'Protected route accessed', user: req.user });
    });
  });

  describe('Login Endpoint', () => {
    it('should successfully login with valid admin credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: 'VelocityAdmin2025!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('admin');
      expect(response.body.user.role).toBe('admin');
    });

    it('should successfully login with valid recruiter credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'recruiter',
          password: 'VelocityRecruit2025!'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('recruiter');
      expect(response.body.user.role).toBe('recruiter');
    });

    it('should fail login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'invalid',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should fail login with empty username', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: '',
          password: 'somepassword'
        });

      expect(response.status).toBe(400);
    });

    it('should fail login with empty password', async () => {
      const response = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: ''
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Protected Routes', () => {
    it('should deny access to protected routes without authentication', async () => {
      const response = await request(app)
        .get('/api/test-protected');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authentication required');
    });

    it('should allow access to protected routes with valid session', async () => {
      // First login
      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: 'VelocityAdmin2025!'
        });

      expect(loginResponse.status).toBe(200);
      
      // Extract session cookie and use it for protected route
      const cookies = loginResponse.headers['set-cookie'];
      
      const protectedResponse = await request(app)
        .get('/api/test-protected')
        .set('Cookie', cookies);

      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.body.message).toBe('Protected route accessed');
    });
  });

  describe('User Info Endpoint', () => {
    it('should return user info when authenticated', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: 'VelocityAdmin2025!'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Get user info
      const userResponse = await request(app)
        .get('/api/user')
        .set('Cookie', cookies);

      expect(userResponse.status).toBe(200);
      expect(userResponse.body.username).toBe('admin');
      expect(userResponse.body.role).toBe('admin');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/user');

      expect(response.status).toBe(401);
    });
  });

  describe('Logout Endpoint', () => {
    it('should successfully logout authenticated user', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/login')
        .send({
          username: 'admin',
          password: 'VelocityAdmin2025!'
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      const logoutResponse = await request(app)
        .post('/api/logout')
        .set('Cookie', cookies);

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);

      // Verify user is logged out by trying to access protected route
      const protectedResponse = await request(app)
        .get('/api/user')
        .set('Cookie', cookies);

      expect(protectedResponse.status).toBe(401);
    });

    it('should handle logout when not authenticated', async () => {
      const response = await request(app)
        .post('/api/logout');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});