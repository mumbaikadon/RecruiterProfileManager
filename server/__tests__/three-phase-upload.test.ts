import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { storage } from '../storage';
import { backgroundProcessor } from '../background-processor';

// Mock dependencies
jest.mock('../storage');
jest.mock('../background-processor');
jest.mock('../document-parser');
jest.mock('../file-utils');

const mockStorage = storage as jest.Mocked<typeof storage>;
const mockBackgroundProcessor = backgroundProcessor as jest.Mocked<typeof backgroundProcessor>;

describe('Three-Phase Upload System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Phase 1: Fast Upload Endpoint', () => {
    describe('Success Scenarios', () => {
      it('should successfully upload multiple files to temporary storage', async () => {
        // Mock successful responses
        mockStorage.createUploadBatch.mockResolvedValue({
          batchId: 'batch-123',
          totalFiles: 2,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        });

        mockStorage.createTempProfileUpload.mockResolvedValue({
          id: 1,
          batchId: 'batch-123',
          filename: 'resume1.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/resume1.pdf',
          candidateName: 'John Doe',
          candidateEmail: 'john@example.com',
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        mockStorage.updateUploadBatchProgress.mockResolvedValue({
          batchId: 'batch-123',
          totalFiles: 2,
          completedFiles: 2,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        });

        mockStorage.createActivity.mockResolvedValue({
          id: 1,
          type: 'system_integration',
          userId: 1,
          message: 'Fast upload initiated',
          timestamp: new Date(),
          metadata: null
        });

        // Mock file-utils saveFile
        const { saveFile } = await import('../file-utils');
        (saveFile as jest.Mock).mockResolvedValue('/uploads/resume1.pdf');

        // Create test file buffer
        const testFile = Buffer.from('test pdf content');
        
        // Test fast upload endpoint
        const response = await request(require('../index').default)
          .post('/api/profile-resumes/fast-upload')
          .attach('resumes', testFile, 'resume1.pdf')
          .field('candidateName', 'John Doe')
          .field('candidateEmail', 'john@example.com')
          .expect(200);

        expect(response.body).toMatchObject({
          batchId: 'batch-123',
          successful: expect.arrayContaining([
            expect.objectContaining({
              filename: 'resume1.pdf',
              status: 'uploaded'
            })
          ]),
          failed: [],
          total: 1
        });

        // Verify storage methods were called
        expect(mockStorage.createUploadBatch).toHaveBeenCalledWith(1, 1);
        expect(mockStorage.createTempProfileUpload).toHaveBeenCalled();
        expect(mockStorage.updateUploadBatchProgress).toHaveBeenCalled();
      });

      it('should handle multiple files in a single batch', async () => {
        mockStorage.createUploadBatch.mockResolvedValue({
          batchId: 'batch-456',
          totalFiles: 15,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        });

        // Mock multiple file uploads
        mockStorage.createTempProfileUpload.mockResolvedValueOnce({
          id: 1,
          batchId: 'batch-456',
          filename: 'resume1.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/resume1.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        const { saveFile } = await import('../file-utils');
        (saveFile as jest.Mock).mockResolvedValue('/uploads/resume1.pdf');

        const testFile = Buffer.from('test pdf content');
        
        const response = await request(require('../index').default)
          .post('/api/profile-resumes/fast-upload')
          .attach('resumes', testFile, 'resume1.pdf')
          .expect(200);

        expect(response.body.batchId).toBe('batch-456');
        expect(mockStorage.createUploadBatch).toHaveBeenCalledWith(1, 1);
      });
    });

    describe('Failure Scenarios', () => {
      it('should reject invalid file types', async () => {
        const testFile = Buffer.from('test content');
        
        const response = await request(require('../index').default)
          .post('/api/profile-resumes/fast-upload')
          .attach('resumes', testFile, 'invalid.txt')
          .expect(200);

        expect(response.body.failed).toContainEqual(
          expect.objectContaining({
            filename: 'invalid.txt',
            error: 'Only PDF and DOCX files are allowed'
          })
        );
      });

      it('should handle file save errors gracefully', async () => {
        mockStorage.createUploadBatch.mockResolvedValue({
          batchId: 'batch-error',
          totalFiles: 1,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        });

        const { saveFile } = await import('../file-utils');
        (saveFile as jest.Mock).mockRejectedValue(new Error('Disk full'));

        const testFile = Buffer.from('test pdf content');
        
        const response = await request(require('../index').default)
          .post('/api/profile-resumes/fast-upload')
          .attach('resumes', testFile, 'resume1.pdf')
          .expect(200);

        expect(response.body.failed).toContainEqual(
          expect.objectContaining({
            filename: 'resume1.pdf',
            error: 'Disk full'
          })
        );
      });

      it('should handle database errors', async () => {
        mockStorage.createUploadBatch.mockRejectedValue(new Error('Database connection failed'));

        const testFile = Buffer.from('test pdf content');
        
        await request(require('../index').default)
          .post('/api/profile-resumes/fast-upload')
          .attach('resumes', testFile, 'resume1.pdf')
          .expect(500);
      });

      it('should reject requests with no files', async () => {
        await request(require('../index').default)
          .post('/api/profile-resumes/fast-upload')
          .expect(400)
          .expect(res => {
            expect(res.body.message).toBe('No files uploaded');
          });
      });
    });
  });

  describe('Phase 2: Background Processor', () => {
    describe('Success Scenarios', () => {
      it('should process pending uploads successfully', async () => {
        const mockPendingUpload = {
          id: 1,
          batchId: 'batch-123',
          filename: 'resume1.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/resume1.pdf',
          candidateName: 'John Doe',
          candidateEmail: 'john@example.com',
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockPendingUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockPendingUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('test pdf content'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('Extracted resume text');
        
        mockStorage.createProfileResume.mockResolvedValue({
          id: 10,
          filename: 'resume1.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/resume1.pdf',
          candidateName: 'John Doe',
          candidateEmail: 'john@example.com',
          uploadedAt: new Date(),
          uploadedBy: 1,
          extractedText: 'Extracted resume text'
        });

        mockStorage.markTempUploadProcessed.mockResolvedValue(mockPendingUpload);
        mockStorage.getUploadBatchStatus.mockResolvedValue({
          batchId: 'batch-123',
          totalFiles: 1,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        });

        // Test background processing
        await mockBackgroundProcessor.processUploadQueue();

        expect(mockStorage.getPendingTempUploads).toHaveBeenCalledWith(5);
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(1, 'processing');
        expect(mockStorage.createProfileResume).toHaveBeenCalled();
        expect(mockStorage.markTempUploadProcessed).toHaveBeenCalledWith(1, 10);
      });

      it('should extract text from different file types', async () => {
        const mockDocxUpload = {
          id: 2,
          batchId: 'batch-456',
          filename: 'resume.docx',
          fileType: 'docx' as const,
          fileSize: 2048,
          filePath: '/uploads/resume.docx',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockDocxUpload]);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('test docx content'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('DOCX extracted text');
        
        mockStorage.createProfileResume.mockResolvedValue({
          id: 11,
          filename: 'resume.docx',
          fileType: 'docx',
          fileSize: 2048,
          filePath: '/uploads/resume.docx',
          candidateName: null,
          candidateEmail: null,
          uploadedAt: new Date(),
          uploadedBy: 1,
          extractedText: 'DOCX extracted text'
        });

        await mockBackgroundProcessor.processUploadQueue();

        expect(extractTextFromDocument).toHaveBeenCalledWith(
          expect.any(Buffer),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
      });
    });

    describe('Failure Scenarios', () => {
      it('should handle file read errors', async () => {
        const mockUpload = {
          id: 3,
          batchId: 'batch-789',
          filename: 'corrupt.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/corrupt.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

        await mockBackgroundProcessor.processUploadQueue();

        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          3,
          'pending',
          'File not found'
        );
      });

      it('should handle text extraction failures', async () => {
        const mockUpload = {
          id: 4,
          batchId: 'batch-111',
          filename: 'unreadable.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/unreadable.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('corrupted pdf'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockRejectedValue(new Error('Cannot parse PDF'));

        await mockBackgroundProcessor.processUploadQueue();

        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          4,
          'pending',
          'Failed to extract text: Cannot parse PDF'
        );
      });

      it('should handle empty text extraction', async () => {
        const mockUpload = {
          id: 5,
          batchId: 'batch-222',
          filename: 'empty.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/empty.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockUpload]);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('empty pdf'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('   '); // Empty/whitespace only

        await mockBackgroundProcessor.processUploadQueue();

        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          5,
          'pending',
          'No text content found in the document'
        );
      });

      it('should implement retry mechanism for failed uploads', async () => {
        const mockUpload = {
          id: 6,
          batchId: 'batch-333',
          filename: 'retry.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/retry.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 2, // Already tried twice
          errorMessage: 'Previous error',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockUpload]);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockRejectedValue(new Error('Persistent error'));

        await mockBackgroundProcessor.processUploadQueue();

        // Should mark as failed when max retries reached
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          6,
          'failed',
          'Max retries exceeded: Persistent error'
        );
      });
    });
  });

  describe('Phase 3: Cleanup Mechanism', () => {
    describe('Success Scenarios', () => {
      it('should clean up processed uploads older than 24 hours', async () => {
        const oldProcessedUpload = {
          id: 10,
          batchId: 'batch-old',
          filename: 'old-processed.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/old-processed.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'processed',
          uploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          processedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          profileResumeId: 100,
          processingAttempts: 1,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getProcessedTempUploads.mockResolvedValue([oldProcessedUpload]);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        await mockBackgroundProcessor.performCleanup();

        expect(mockStorage.getProcessedTempUploads).toHaveBeenCalledWith(24);
        expect(deleteFile).toHaveBeenCalledWith('/uploads/old-processed.pdf');
        expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(10);
      });

      it('should clean up expired/failed uploads older than 72 hours', async () => {
        const expiredUpload = {
          id: 11,
          batchId: 'batch-expired',
          filename: 'expired.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/expired.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'failed',
          uploadedAt: new Date(Date.now() - 73 * 60 * 60 * 1000), // 73 hours ago
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 3,
          errorMessage: 'Max retries exceeded',
          expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000) // Expired 1 hour ago
        };

        mockStorage.getProcessedTempUploads.mockResolvedValue([]);
        mockStorage.getExpiredTempUploads.mockResolvedValue([expiredUpload]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        await mockBackgroundProcessor.performCleanup();

        expect(mockStorage.getExpiredTempUploads).toHaveBeenCalledWith(72);
        expect(deleteFile).toHaveBeenCalledWith('/uploads/expired.pdf');
        expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(11);
      });

      it('should clean up orphaned batches', async () => {
        const orphanedBatch = {
          batchId: 'batch-orphaned',
          totalFiles: 5,
          completedFiles: 5,
          failedFiles: 0,
          status: 'completed' as const,
          createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
          uploadedBy: 1
        };

        mockStorage.getProcessedTempUploads.mockResolvedValue([]);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([orphanedBatch]);

        await mockBackgroundProcessor.performCleanup();

        expect(mockStorage.getOrphanedBatches).toHaveBeenCalled();
        expect(mockStorage.deleteUploadBatch).toHaveBeenCalledWith('batch-orphaned');
      });
    });

    describe('Failure Scenarios', () => {
      it('should handle file deletion errors gracefully', async () => {
        const processedUpload = {
          id: 12,
          batchId: 'batch-delete-error',
          filename: 'cannot-delete.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/cannot-delete.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'processed',
          uploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          processedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          profileResumeId: 101,
          processingAttempts: 1,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getProcessedTempUploads.mockResolvedValue([processedUpload]);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        await mockBackgroundProcessor.performCleanup();

        // Should continue with database cleanup even if file deletion fails
        expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(12);
      });

      it('should handle database cleanup errors', async () => {
        const processedUpload = {
          id: 13,
          batchId: 'batch-db-error',
          filename: 'db-error.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/db-error.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'processed',
          uploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          processedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          profileResumeId: 102,
          processingAttempts: 1,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getProcessedTempUploads.mockResolvedValue([processedUpload]);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        mockStorage.deleteTempUpload.mockRejectedValue(new Error('Database connection lost'));
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        // Should not throw error but continue processing
        await expect(mockBackgroundProcessor.performCleanup()).resolves.not.toThrow();
      });
    });
  });

  describe('Status Tracking Endpoints', () => {
    describe('Success Scenarios', () => {
      it('should return batch status with upload details', async () => {
        const mockBatch = {
          batchId: 'batch-status-test',
          totalFiles: 3,
          completedFiles: 2,
          failedFiles: 1,
          status: 'processing' as const,
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        const mockUploads = [
          {
            id: 1,
            filename: 'file1.pdf',
            uploadStatus: 'processed',
            errorMessage: null,
            processingAttempts: 1,
            uploadedAt: new Date(),
            processedAt: new Date()
          },
          {
            id: 2,
            filename: 'file2.pdf',
            uploadStatus: 'processing',
            errorMessage: null,
            processingAttempts: 1,
            uploadedAt: new Date(),
            processedAt: null
          },
          {
            id: 3,
            filename: 'file3.pdf',
            uploadStatus: 'failed',
            errorMessage: 'Text extraction failed',
            processingAttempts: 3,
            uploadedAt: new Date(),
            processedAt: null
          }
        ];

        mockStorage.getUploadBatchStatus.mockResolvedValue(mockBatch);
        
        const response = await request(require('../index').default)
          .get('/api/profile-resumes/batch/batch-status-test/status')
          .expect(200);

        expect(response.body).toMatchObject({
          batch: mockBatch,
          statusCounts: {
            pending: 0,
            processing: 1,
            processed: 1,
            failed: 1
          }
        });
      });

      it('should return background processor status', async () => {
        mockStorage.getPendingTempUploads.mockResolvedValue([
          { id: 1, filename: 'pending1.pdf' },
          { id: 2, filename: 'pending2.pdf' }
        ]);

        const response = await request(require('../index').default)
          .get('/api/profile-resumes/processor/status')
          .expect(200);

        expect(response.body).toMatchObject({
          pendingUploads: 2,
          uptime: expect.any(Number),
          lastCheck: expect.any(String)
        });
      });
    });

    describe('Failure Scenarios', () => {
      it('should return 404 for non-existent batch', async () => {
        mockStorage.getUploadBatchStatus.mockResolvedValue(undefined);

        await request(require('../index').default)
          .get('/api/profile-resumes/batch/non-existent/status')
          .expect(404)
          .expect(res => {
            expect(res.body.message).toBe('Batch not found');
          });
      });

      it('should handle database errors in status endpoints', async () => {
        mockStorage.getUploadBatchStatus.mockRejectedValue(new Error('Database error'));

        await request(require('../index').default)
          .get('/api/profile-resumes/batch/error-batch/status')
          .expect(500);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should complete full three-phase workflow', async () => {
      // Phase 1: Fast upload
      mockStorage.createUploadBatch.mockResolvedValue({
        batchId: 'integration-test',
        totalFiles: 1,
        completedFiles: 0,
        failedFiles: 0,
        status: 'pending',
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      });

      const tempUpload = {
        id: 1,
        batchId: 'integration-test',
        filename: 'integration.pdf',
        fileType: 'pdf' as const,
        fileSize: 1024,
        filePath: '/uploads/integration.pdf',
        candidateName: 'Integration Test',
        candidateEmail: 'test@example.com',
        uploadedBy: 1,
        uploadStatus: 'pending',
        uploadedAt: new Date(),
        processedAt: null,
        profileResumeId: null,
        processingAttempts: 0,
        errorMessage: null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      };

      mockStorage.createTempProfileUpload.mockResolvedValue(tempUpload);

      const { saveFile } = await import('../file-utils');
      (saveFile as jest.Mock).mockResolvedValue('/uploads/integration.pdf');

      // Test fast upload
      const testFile = Buffer.from('integration test pdf');
      const uploadResponse = await request(require('../index').default)
        .post('/api/profile-resumes/fast-upload')
        .attach('resumes', testFile, 'integration.pdf')
        .field('candidateName', 'Integration Test')
        .field('candidateEmail', 'test@example.com')
        .expect(200);

      expect(uploadResponse.body.successful).toHaveLength(1);
      expect(uploadResponse.body.batchId).toBe('integration-test');

      // Phase 2: Background processing
      mockStorage.getPendingTempUploads.mockResolvedValue([tempUpload]);
      
      const { readFile } = await import('../file-utils');
      (readFile as jest.Mock).mockResolvedValue(Buffer.from('integration test pdf'));
      
      const { extractTextFromDocument } = await import('../document-parser');
      (extractTextFromDocument as jest.Mock).mockResolvedValue('Integration test resume content');
      
      mockStorage.createProfileResume.mockResolvedValue({
        id: 999,
        filename: 'integration.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        filePath: '/uploads/integration.pdf',
        candidateName: 'Integration Test',
        candidateEmail: 'test@example.com',
        uploadedAt: new Date(),
        uploadedBy: 1,
        extractedText: 'Integration test resume content'
      });

      // Simulate background processing
      await mockBackgroundProcessor.processUploadQueue();

      expect(mockStorage.createProfileResume).toHaveBeenCalled();
      expect(mockStorage.markTempUploadProcessed).toHaveBeenCalledWith(1, 999);

      // Phase 3: Cleanup (simulate time passing)
      const processedUpload = { ...tempUpload, uploadStatus: 'processed', processedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) };
      mockStorage.getProcessedTempUploads.mockResolvedValue([processedUpload]);
      mockStorage.getExpiredTempUploads.mockResolvedValue([]);
      mockStorage.getOrphanedBatches.mockResolvedValue([]);

      const { deleteFile } = await import('../file-utils');
      (deleteFile as jest.Mock).mockResolvedValue(undefined);

      await mockBackgroundProcessor.performCleanup();

      expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(1);
      expect(deleteFile).toHaveBeenCalledWith('/uploads/integration.pdf');
    });
  });
});