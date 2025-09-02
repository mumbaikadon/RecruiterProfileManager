import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { storage } from '../storage';

// Mock storage for testing
jest.mock('../storage');
const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Status Tracking Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Batch Status Endpoint', () => {
    describe('Success Scenarios', () => {
      it('should return batch status with detailed information', async () => {
        const mockBatch = {
          batchId: 'test-batch-123',
          totalFiles: 5,
          completedFiles: 3,
          failedFiles: 1,
          status: 'processing' as const,
          createdAt: new Date('2025-09-02T10:00:00Z'),
          completedAt: null,
          uploadedBy: 1
        };

        mockStorage.getUploadBatchStatus.mockResolvedValue(mockBatch);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/batch/test-batch-123/status')
          .expect(200);

        expect(response.body).toMatchObject({
          batch: {
            batchId: 'test-batch-123',
            totalFiles: 5,
            completedFiles: 3,
            failedFiles: 1,
            status: 'processing'
          },
          statusCounts: {
            pending: 1, // totalFiles - completedFiles - failedFiles
            processing: 0,
            processed: 3,
            failed: 1
          }
        });

        expect(mockStorage.getUploadBatchStatus).toHaveBeenCalledWith('test-batch-123');
      });

      it('should return completed batch status', async () => {
        const mockCompletedBatch = {
          batchId: 'completed-batch',
          totalFiles: 10,
          completedFiles: 8,
          failedFiles: 2,
          status: 'completed' as const,
          createdAt: new Date('2025-09-02T09:00:00Z'),
          completedAt: new Date('2025-09-02T09:15:00Z'),
          uploadedBy: 1
        };

        mockStorage.getUploadBatchStatus.mockResolvedValue(mockCompletedBatch);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/batch/completed-batch/status')
          .expect(200);

        expect(response.body.batch.status).toBe('completed');
        expect(response.body.batch.completedAt).not.toBeNull();
        expect(response.body.statusCounts.pending).toBe(0);
        expect(response.body.statusCounts.processed).toBe(8);
        expect(response.body.statusCounts.failed).toBe(2);
      });

      it('should return pending batch status', async () => {
        const mockPendingBatch = {
          batchId: 'pending-batch',
          totalFiles: 20,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending' as const,
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        mockStorage.getUploadBatchStatus.mockResolvedValue(mockPendingBatch);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/batch/pending-batch/status')
          .expect(200);

        expect(response.body.batch.status).toBe('pending');
        expect(response.body.statusCounts.pending).toBe(20);
        expect(response.body.statusCounts.processed).toBe(0);
        expect(response.body.statusCounts.failed).toBe(0);
      });
    });

    describe('Failure Scenarios', () => {
      it('should return 404 for non-existent batch', async () => {
        mockStorage.getUploadBatchStatus.mockResolvedValue(undefined);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/batch/non-existent-batch/status')
          .expect(404);

        expect(response.body).toMatchObject({
          message: 'Batch not found'
        });
      });

      it('should handle invalid batch ID format', async () => {
        mockStorage.getUploadBatchStatus.mockResolvedValue(undefined);

        await request(require('../index').default)
          .get('/api/profile-resumes/batch//status') // Empty batch ID
          .expect(404);
      });

      it('should handle database errors', async () => {
        mockStorage.getUploadBatchStatus.mockRejectedValue(new Error('Database connection failed'));

        await request(require('../index').default)
          .get('/api/profile-resumes/batch/error-batch/status')
          .expect(500);
      });

      it('should handle storage timeout errors', async () => {
        mockStorage.getUploadBatchStatus.mockRejectedValue(new Error('Query timeout'));

        await request(require('../index').default)
          .get('/api/profile-resumes/batch/timeout-batch/status')
          .expect(500);
      });
    });
  });

  describe('Background Processor Status Endpoint', () => {
    describe('Success Scenarios', () => {
      it('should return processor status with pending uploads count', async () => {
        const mockPendingUploads = [
          { id: 1, filename: 'pending1.pdf', uploadStatus: 'pending' },
          { id: 2, filename: 'pending2.pdf', uploadStatus: 'pending' },
          { id: 3, filename: 'pending3.docx', uploadStatus: 'pending' }
        ];

        mockStorage.getPendingTempUploads.mockResolvedValue(mockPendingUploads as any);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/processor/status')
          .expect(200);

        expect(response.body).toMatchObject({
          pendingUploads: 3,
          isRunning: expect.any(Boolean)
        });

        expect(mockStorage.getPendingTempUploads).toHaveBeenCalled();
      });

      it('should return status when no pending uploads', async () => {
        mockStorage.getPendingTempUploads.mockResolvedValue([]);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/processor/status')
          .expect(200);

        expect(response.body.pendingUploads).toBe(0);
        expect(response.body).toHaveProperty('isRunning');
      });

      it('should include processor runtime information', async () => {
        mockStorage.getPendingTempUploads.mockResolvedValue([]);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/processor/status')
          .expect(200);

        expect(response.body).toHaveProperty('isRunning');
        expect(typeof response.body.isRunning).toBe('boolean');
      });
    });

    describe('Failure Scenarios', () => {
      it('should handle database errors when getting pending uploads', async () => {
        mockStorage.getPendingTempUploads.mockRejectedValue(new Error('Database error'));

        await request(require('../index').default)
          .get('/api/profile-resumes/processor/status')
          .expect(500);
      });

      it('should handle storage connection failures', async () => {
        mockStorage.getPendingTempUploads.mockRejectedValue(new Error('Connection refused'));

        await request(require('../index').default)
          .get('/api/profile-resumes/processor/status')
          .expect(500);
      });
    });
  });

  describe('Integration Status Tests', () => {
    it('should track batch progress through complete workflow', async () => {
      // Initial batch creation
      const batchId = 'integration-test-batch';
      
      // Step 1: Batch starts as pending
      mockStorage.getUploadBatchStatus.mockResolvedValueOnce({
        batchId,
        totalFiles: 3,
        completedFiles: 0,
        failedFiles: 0,
        status: 'pending',
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      });

      let response = await request(require('../index').default)
        .get(`/api/profile-resumes/batch/${batchId}/status`)
        .expect(200);

      expect(response.body.batch.status).toBe('pending');
      expect(response.body.statusCounts.pending).toBe(3);

      // Step 2: Batch moves to processing
      mockStorage.getUploadBatchStatus.mockResolvedValueOnce({
        batchId,
        totalFiles: 3,
        completedFiles: 1,
        failedFiles: 0,
        status: 'processing',
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      });

      response = await request(require('../index').default)
        .get(`/api/profile-resumes/batch/${batchId}/status`)
        .expect(200);

      expect(response.body.batch.status).toBe('processing');
      expect(response.body.statusCounts.processed).toBe(1);
      expect(response.body.statusCounts.pending).toBe(2);

      // Step 3: Batch completes with mixed results
      mockStorage.getUploadBatchStatus.mockResolvedValueOnce({
        batchId,
        totalFiles: 3,
        completedFiles: 2,
        failedFiles: 1,
        status: 'failed', // Has failures
        createdAt: new Date(),
        completedAt: new Date(),
        uploadedBy: 1
      });

      response = await request(require('../index').default)
        .get(`/api/profile-resumes/batch/${batchId}/status`)
        .expect(200);

      expect(response.body.batch.status).toBe('failed');
      expect(response.body.statusCounts.processed).toBe(2);
      expect(response.body.statusCounts.failed).toBe(1);
      expect(response.body.statusCounts.pending).toBe(0);
    });

    it('should show processor status changes during active processing', async () => {
      // Step 1: High pending uploads
      mockStorage.getPendingTempUploads.mockResolvedValueOnce(
        Array.from({ length: 15 }, (_, i) => ({ id: i + 1, filename: `file${i + 1}.pdf` })) as any
      );

      let response = await request(require('../index').default)
        .get('/api/profile-resumes/processor/status')
        .expect(200);

      expect(response.body.pendingUploads).toBe(15);

      // Step 2: Processing reduces pending uploads
      mockStorage.getPendingTempUploads.mockResolvedValueOnce(
        Array.from({ length: 8 }, (_, i) => ({ id: i + 1, filename: `file${i + 1}.pdf` })) as any
      );

      response = await request(require('../index').default)
        .get('/api/profile-resumes/processor/status')
        .expect(200);

      expect(response.body.pendingUploads).toBe(8);

      // Step 3: All uploads processed
      mockStorage.getPendingTempUploads.mockResolvedValueOnce([]);

      response = await request(require('../index').default)
        .get('/api/profile-resumes/processor/status')
        .expect(200);

      expect(response.body.pendingUploads).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed batch IDs gracefully', async () => {
      mockStorage.getUploadBatchStatus.mockResolvedValue(undefined);

      const malformedIds = ['', '  ', 'batch with spaces', 'batch/with/slashes'];

      for (const batchId of malformedIds) {
        await request(require('../index').default)
          .get(`/api/profile-resumes/batch/${encodeURIComponent(batchId)}/status`)
          .expect(404);
      }
    });

    it('should handle concurrent status requests', async () => {
      const batchId = 'concurrent-test-batch';
      const mockBatch = {
        batchId,
        totalFiles: 5,
        completedFiles: 3,
        failedFiles: 0,
        status: 'processing' as const,
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      };

      mockStorage.getUploadBatchStatus.mockResolvedValue(mockBatch);

      // Make multiple concurrent requests
      const requests = Array.from({ length: 5 }, () =>
        request(require('../index').default)
          .get(`/api/profile-resumes/batch/${batchId}/status`)
          .expect(200)
      );

      const responses = await Promise.all(requests);

      // All responses should be identical
      responses.forEach(response => {
        expect(response.body.batch.batchId).toBe(batchId);
        expect(response.body.batch.status).toBe('processing');
      });
    });

    it('should handle very large batch status requests', async () => {
      const largeBatch = {
        batchId: 'large-batch',
        totalFiles: 10000,
        completedFiles: 7500,
        failedFiles: 500,
        status: 'processing' as const,
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      };

      mockStorage.getUploadBatchStatus.mockResolvedValue(largeBatch);

      const response = await request(require('../index').default)
        .get('/api/profile-resumes/batch/large-batch/status')
        .expect(200);

      expect(response.body.batch.totalFiles).toBe(10000);
      expect(response.body.statusCounts.pending).toBe(2000); // 10000 - 7500 - 500
      expect(response.body.statusCounts.processed).toBe(7500);
      expect(response.body.statusCounts.failed).toBe(500);
    });

    it('should validate status calculation accuracy', async () => {
      const testCases = [
        {
          batch: { totalFiles: 10, completedFiles: 6, failedFiles: 2 },
          expected: { pending: 2, processed: 6, failed: 2 }
        },
        {
          batch: { totalFiles: 1, completedFiles: 1, failedFiles: 0 },
          expected: { pending: 0, processed: 1, failed: 0 }
        },
        {
          batch: { totalFiles: 100, completedFiles: 0, failedFiles: 0 },
          expected: { pending: 100, processed: 0, failed: 0 }
        },
        {
          batch: { totalFiles: 50, completedFiles: 25, failedFiles: 25 },
          expected: { pending: 0, processed: 25, failed: 25 }
        }
      ];

      for (const testCase of testCases) {
        const mockBatch = {
          batchId: `test-${testCase.batch.totalFiles}`,
          totalFiles: testCase.batch.totalFiles,
          completedFiles: testCase.batch.completedFiles,
          failedFiles: testCase.batch.failedFiles,
          status: 'processing' as const,
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        mockStorage.getUploadBatchStatus.mockResolvedValue(mockBatch);

        const response = await request(require('../index').default)
          .get(`/api/profile-resumes/batch/${mockBatch.batchId}/status`)
          .expect(200);

        expect(response.body.statusCounts).toMatchObject(testCase.expected);
      }
    });
  });

  describe('Performance and Reliability', () => {
    it('should respond within reasonable time limits', async () => {
      const startTime = Date.now();
      
      mockStorage.getUploadBatchStatus.mockResolvedValue({
        batchId: 'performance-test',
        totalFiles: 1000,
        completedFiles: 500,
        failedFiles: 50,
        status: 'processing',
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      });

      await request(require('../index').default)
        .get('/api/profile-resumes/batch/performance-test/status')
        .expect(200);

      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle rapid successive status checks', async () => {
      const batchId = 'rapid-test-batch';
      mockStorage.getUploadBatchStatus.mockResolvedValue({
        batchId,
        totalFiles: 10,
        completedFiles: 5,
        failedFiles: 1,
        status: 'processing',
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      });

      // Make 10 rapid requests
      const rapidRequests = Array.from({ length: 10 }, () =>
        request(require('../index').default)
          .get(`/api/profile-resumes/batch/${batchId}/status`)
      );

      const responses = await Promise.all(rapidRequests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.batch.batchId).toBe(batchId);
      });
    });
  });
});