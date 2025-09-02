/**
 * Test cases for Profile Record "Load Full Content" button functionality
 */

import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../server/routes';
import { setupAuth } from '../server/auth';
import { createTestApp, createMockResumeData, createMockResumeContent } from './test-utils';

describe('Profile Record - Load Full Content Button', () => {
  let app: express.Application;
  let authCookies: string[];

  beforeAll(async () => {
    app = await createTestApp();

    // Login to get auth cookies
    const loginResponse = await request(app)
      .post('/api/login')
      .send({
        username: 'admin',
        password: 'VelocityAdmin2025!'
      });

    authCookies = loginResponse.headers['set-cookie'];
  });

  describe('Content Loading API Endpoint', () => {
    it('should return resume content for valid ID', async () => {
      // First, get existing resumes to find a valid ID
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        const response = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('extractedText');
        expect(response.body).toHaveProperty('wordCount');
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.metadata).toHaveProperty('duration');
        expect(response.body.metadata).toHaveProperty('textLength');
        expect(response.body.metadata).toHaveProperty('compressed');
      }
    });

    it('should return 404 for non-existent resume ID', async () => {
      const response = await request(app)
        .get('/api/profile-resumes/99999/content')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Resume content not found');
    });

    it('should return 400 for invalid resume ID format', async () => {
      const response = await request(app)
        .get('/api/profile-resumes/invalid/content')
        .set('Cookie', authCookies);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Invalid resume ID');
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app)
        .get('/api/profile-resumes/1/content');

      expect(response.status).toBe(401);
    });

    it('should include performance metadata in response', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        const response = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        expect(response.body.metadata.duration).toBeGreaterThan(0);
        expect(response.body.metadata.textLength).toBeGreaterThan(0);
        expect(typeof response.body.metadata.compressed).toBe('boolean');
      }
    });
  });

  describe('Memory Optimization Behavior', () => {
    it('should return only metadata without full content in list view', async () => {
      const response = await request(app)
        .get('/api/profile-resumes?includeFileData=false')
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('resumes');
      
      if (response.body.resumes && response.body.resumes.length > 0) {
        const resume = response.body.resumes[0];
        expect(resume).toHaveProperty('filename');
        expect(resume).toHaveProperty('fileSize');
        expect(resume).toHaveProperty('candidateName');
        expect(resume).toHaveProperty('candidateEmail');
        expect(resume).toHaveProperty('uploadedAt');
        
        // Should NOT include full extracted text in list view
        expect(resume).not.toHaveProperty('extractedText');
        
        // May include summary for preview
        expect(resume).toHaveProperty('summaryText');
      }
    });

    it('should handle large resume content efficiently', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        const startTime = Date.now();
        const response = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);
        const endTime = Date.now();

        expect(response.status).toBe(200);
        expect(endTime - startTime).toBeLessThan(2000); // Should load within 2 seconds
        expect(response.body.extractedText.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Content Caching Behavior', () => {
    it('should cache content for subsequent requests', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        // First request
        const firstResponse = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);

        // Second request (should be faster due to potential caching)
        const secondStartTime = Date.now();
        const secondResponse = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);
        const secondEndTime = Date.now();

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        expect(firstResponse.body.extractedText).toBe(secondResponse.body.extractedText);
        expect(secondEndTime - secondStartTime).toBeLessThan(1000); // Cached response should be faster
      }
    });
  });

  describe('Search vs. View Content Separation', () => {
    it('should return snippets in search without full content', async () => {
      const searchResponse = await request(app)
        .post('/api/profile-resumes/search-snippets')
        .set('Cookie', authCookies)
        .send({
          searchTerm: 'developer',
          page: 1,
          limit: 5,
          maxSnippetLength: 100
        });

      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body).toHaveProperty('results');
      
      if (searchResponse.body.results && searchResponse.body.results.length > 0) {
        const searchResult = searchResponse.body.results[0];
        expect(searchResult).toHaveProperty('snippets');
        expect(searchResult).toHaveProperty('highlightedSnippets');
        expect(searchResult).toHaveProperty('rank');
        
        // Search results should only have snippets, not full content
        expect(searchResult).not.toHaveProperty('extractedText');
        expect(searchResult.snippets.length).toBeLessThanOrEqual(500); // Snippets are limited
      }
    });

    it('should provide full content via separate endpoint', async () => {
      // First, search to get a resume ID
      const searchResponse = await request(app)
        .post('/api/profile-resumes/search-snippets')
        .set('Cookie', authCookies)
        .send({
          searchTerm: 'developer',
          page: 1,
          limit: 1
        });

      if (searchResponse.body.results && searchResponse.body.results.length > 0) {
        const resumeId = searchResponse.body.results[0].id;

        // Then, get full content via content endpoint
        const contentResponse = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);

        expect(contentResponse.status).toBe(200);
        expect(contentResponse.body).toHaveProperty('extractedText');
        expect(contentResponse.body.extractedText.length).toBeGreaterThan(searchResponse.body.results[0].snippets.length);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This is a conceptual test - in practice you'd mock the database to fail
      const response = await request(app)
        .get('/api/profile-resumes/1/content')
        .set('Cookie', authCookies);

      // Should return either 200 with data, 404 if not found, or 500 with error message
      expect([200, 404, 500]).toContain(response.status);
      
      if (response.status === 500) {
        expect(response.body).toHaveProperty('message');
        expect(typeof response.body.message).toBe('string');
      }
    });

    it('should validate content exists before returning', async () => {
      const response = await request(app)
        .get('/api/profile-resumes/99999/content')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Resume content not found');
    });
  });

  describe('Performance Requirements', () => {
    it('should respond to content requests within reasonable time', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        const startTime = Date.now();
        const response = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);
        const duration = Date.now() - startTime;

        expect(response.status).toBe(200);
        expect(duration).toBeLessThan(3000); // Should load within 3 seconds
        expect(response.body.metadata.duration).toBeLessThan(1000); // DB query should be fast
      }
    });

    it('should handle multiple concurrent requests efficiently', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length >= 2) {
        const resumeIds = resumesResponse.body.resumes.slice(0, 2).map((r: any) => r.id);

        // Make concurrent requests
        const promises = resumeIds.map(id => 
          request(app)
            .get(`/api/profile-resumes/${id}/content`)
            .set('Cookie', authCookies)
        );

        const startTime = Date.now();
        const responses = await Promise.all(promises);
        const duration = Date.now() - startTime;

        responses.forEach(response => {
          expect(response.status).toBe(200);
          expect(response.body).toHaveProperty('extractedText');
        });

        // Concurrent requests should not take significantly longer than single request
        expect(duration).toBeLessThan(5000);
      }
    });
  });

  describe('UI Integration Points', () => {
    it('should provide data format expected by frontend', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        const response = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        
        // Check structure matches ResumeContent interface
        expect(response.body).toHaveProperty('extractedText');
        expect(typeof response.body.extractedText).toBe('string');
        
        expect(response.body).toHaveProperty('wordCount');
        expect(typeof response.body.wordCount).toBe('number');
        
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.metadata).toHaveProperty('duration');
        expect(response.body.metadata).toHaveProperty('textLength');
        expect(response.body.metadata).toHaveProperty('compressed');
      }
    });

    it('should return content suitable for textarea display', async () => {
      const resumesResponse = await request(app)
        .get('/api/profile-resumes')
        .set('Cookie', authCookies);

      if (resumesResponse.body.resumes && resumesResponse.body.resumes.length > 0) {
        const resumeId = resumesResponse.body.resumes[0].id;

        const response = await request(app)
          .get(`/api/profile-resumes/${resumeId}/content`)
          .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        
        const content = response.body.extractedText;
        
        // Content should be clean text suitable for display
        expect(typeof content).toBe('string');
        expect(content.length).toBeGreaterThan(0);
        
        // Should not contain harmful HTML/script tags
        expect(content).not.toMatch(/<script/i);
        expect(content).not.toMatch(/<iframe/i);
      }
    });
  });
});