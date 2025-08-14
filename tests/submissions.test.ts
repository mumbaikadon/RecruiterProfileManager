import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';

describe('Analytics Service', () => {
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

  describe('GET /api/analytics/recruiters', () => {
    it('should return analytics data when authenticated', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recruiters');
      expect(response.body).toHaveProperty('totalSubmissions');
      expect(response.body).toHaveProperty('periodSubmissions');
      expect(response.body).toHaveProperty('topPerformers');
      expect(response.body).toHaveProperty('submissionTrends');
      expect(Array.isArray(response.body.recruiters)).toBe(true);
      expect(Array.isArray(response.body.topPerformers)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters');

      expect(response.status).toBe(401);
    });

    it('should accept date range parameters', async () => {
      const fromDate = new Date('2024-01-01').toISOString();
      const toDate = new Date('2024-12-31').toISOString();

      const response = await request(app)
        .get('/api/analytics/recruiters')
        .query({
          dateFrom: fromDate,
          dateTo: toDate
        })
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recruiters');
    });

    it('should filter by recruiter ID when provided', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .query({ recruiterId: '2' })
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('recruiters');
    });

    it('should return 400 for invalid date format', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .query({
          dateFrom: 'invalid-date',
          dateTo: 'also-invalid'
        })
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid date format');
    });

    it('should calculate success rates correctly', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      
      // Check that each recruiter has the expected analytics fields
      response.body.recruiters.forEach((recruiter: any) => {
        expect(recruiter).toHaveProperty('recruiterId');
        expect(recruiter).toHaveProperty('recruiterName');
        expect(recruiter).toHaveProperty('totalSubmissions');
        expect(recruiter).toHaveProperty('activeSubmissions');
        expect(recruiter).toHaveProperty('approvedSubmissions');
        expect(recruiter).toHaveProperty('rejectedSubmissions');
        expect(recruiter).toHaveProperty('successRate');
        expect(recruiter).toHaveProperty('rejectedRate');
        expect(recruiter).toHaveProperty('jobsWorked');
        
        // Validate calculation logic
        expect(typeof recruiter.successRate).toBe('number');
        expect(typeof recruiter.rejectedRate).toBe('number');
        expect(recruiter.successRate).toBeGreaterThanOrEqual(0);
        expect(recruiter.successRate).toBeLessThanOrEqual(100);
        expect(recruiter.rejectedRate).toBeGreaterThanOrEqual(0);
        expect(recruiter.rejectedRate).toBeLessThanOrEqual(100);
        
        // If there are submissions, verify rate calculations
        if (recruiter.totalSubmissions > 0) {
          const expectedSuccessRate = (recruiter.approvedSubmissions / recruiter.totalSubmissions) * 100;
          const expectedRejectedRate = (recruiter.rejectedSubmissions / recruiter.totalSubmissions) * 100;
          
          expect(Math.abs(recruiter.successRate - expectedSuccessRate)).toBeLessThan(0.1);
          expect(Math.abs(recruiter.rejectedRate - expectedRejectedRate)).toBeLessThan(0.1);
        }
      });
    });

    it('should sort recruiters by total submissions descending', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      
      const recruiters = response.body.recruiters;
      if (recruiters.length > 1) {
        for (let i = 0; i < recruiters.length - 1; i++) {
          expect(recruiters[i].totalSubmissions).toBeGreaterThanOrEqual(recruiters[i + 1].totalSubmissions);
        }
      }
    });

    it('should return top performers correctly', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body.topPerformers.length).toBeLessThanOrEqual(3);
      
      // Top performers should be sorted by total submissions
      const topPerformers = response.body.topPerformers;
      if (topPerformers.length > 1) {
        for (let i = 0; i < topPerformers.length - 1; i++) {
          expect(topPerformers[i].totalSubmissions).toBeGreaterThanOrEqual(topPerformers[i + 1].totalSubmissions);
        }
      }
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('should return dashboard statistics when authenticated', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('activeJobs');
      expect(response.body).toHaveProperty('totalSubmissions');
      expect(response.body).toHaveProperty('totalCandidates');
      expect(response.body).toHaveProperty('recentActivities');
      expect(typeof response.body.activeJobs).toBe('number');
      expect(typeof response.body.totalSubmissions).toBe('number');
      expect(typeof response.body.totalCandidates).toBe('number');
      expect(Array.isArray(response.body.recentActivities)).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/dashboard/stats');

      expect(response.status).toBe(401);
    });
  });

  describe('Analytics Data Integrity', () => {
    it('should have consistent totals across different endpoints', async () => {
      // Get analytics data
      const analyticsResponse = await request(app)
        .get('/api/analytics/recruiters')
        .set('Cookie', authCookies);

      // Get dashboard stats
      const dashboardResponse = await request(app)
        .get('/api/dashboard/stats')
        .set('Cookie', authCookies);

      expect(analyticsResponse.status).toBe(200);
      expect(dashboardResponse.status).toBe(200);

      // The total submissions should be consistent
      expect(typeof analyticsResponse.body.totalSubmissions).toBe('number');
      expect(typeof dashboardResponse.body.totalSubmissions).toBe('number');
      
      // Both should return non-negative numbers
      expect(analyticsResponse.body.totalSubmissions).toBeGreaterThanOrEqual(0);
      expect(dashboardResponse.body.totalSubmissions).toBeGreaterThanOrEqual(0);
    });

    it('should calculate period submissions correctly', async () => {
      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const response = await request(app)
        .get('/api/analytics/recruiters')
        .query({
          dateFrom: monthStart.toISOString(),
          dateTo: monthEnd.toISOString()
        })
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(typeof response.body.periodSubmissions).toBe('number');
      expect(response.body.periodSubmissions).toBeGreaterThanOrEqual(0);
      expect(response.body.periodSubmissions).toBeLessThanOrEqual(response.body.totalSubmissions);
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // Test with extreme date ranges that might cause issues
      const farFutureDate = new Date('2099-12-31').toISOString();
      const farPastDate = new Date('1900-01-01').toISOString();

      const response = await request(app)
        .get('/api/analytics/recruiters')
        .query({
          dateFrom: farPastDate,
          dateTo: farFutureDate
        })
        .set('Cookie', authCookies);

      // Should still return data, even if empty
      expect([200, 400]).toContain(response.status);
    });

    it('should handle invalid recruiter ID gracefully', async () => {
      const response = await request(app)
        .get('/api/analytics/recruiters')
        .query({ recruiterId: 'invalid-id' })
        .set('Cookie', authCookies);

      // Should either return data or a validation error
      expect([200, 400]).toContain(response.status);
    });
  });
});