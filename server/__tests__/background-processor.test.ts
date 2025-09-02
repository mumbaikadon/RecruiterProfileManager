import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BackgroundProcessor } from '../background-processor';
import { storage } from '../storage';

// Mock dependencies
jest.mock('../storage');
jest.mock('../document-parser');
jest.mock('../file-utils');

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Background Processor', () => {
  let processor: BackgroundProcessor;
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;

  beforeEach(() => {
    processor = new BackgroundProcessor();
    jest.clearAllMocks();
    
    // Mock console to avoid noise in tests
    console.log = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    processor.stop();
  });

  describe('Upload Queue Processing', () => {
    describe('Success Scenarios', () => {
      it('should process pending uploads in batches', async () => {
        const mockPendingUploads = [
          {
            id: 1,
            batchId: 'batch-1',
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
          },
          {
            id: 2,
            batchId: 'batch-1',
            filename: 'resume2.docx',
            fileType: 'docx' as const,
            fileSize: 2048,
            filePath: '/uploads/resume2.docx',
            candidateName: 'Jane Smith',
            candidateEmail: 'jane@example.com',
            uploadedBy: 1,
            uploadStatus: 'pending',
            uploadedAt: new Date(),
            processedAt: null,
            profileResumeId: null,
            processingAttempts: 0,
            errorMessage: null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        ];

        mockStorage.getPendingTempUploads.mockResolvedValue(mockPendingUploads);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockPendingUploads[0]);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('test file content'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('Extracted resume text');
        
        mockStorage.createProfileResume.mockResolvedValueOnce({
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
        }).mockResolvedValueOnce({
          id: 11,
          filename: 'resume2.docx',
          fileType: 'docx',
          fileSize: 2048,
          filePath: '/uploads/resume2.docx',
          candidateName: 'Jane Smith',
          candidateEmail: 'jane@example.com',
          uploadedAt: new Date(),
          uploadedBy: 1,
          extractedText: 'Extracted resume text'
        });

        mockStorage.markTempUploadProcessed.mockResolvedValue(mockPendingUploads[0]);
        mockStorage.getUploadBatchStatus.mockResolvedValue({
          batchId: 'batch-1',
          totalFiles: 2,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        });
        mockStorage.updateUploadBatchProgress.mockResolvedValue({
          batchId: 'batch-1',
          totalFiles: 2,
          completedFiles: 2,
          failedFiles: 0,
          status: 'completed',
          createdAt: new Date(),
          completedAt: new Date(),
          uploadedBy: 1
        });

        await processor.processUploadQueue();

        expect(mockStorage.getPendingTempUploads).toHaveBeenCalledWith(5);
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(1, 'processing');
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(2, 'processing');
        expect(mockStorage.createProfileResume).toHaveBeenCalledTimes(2);
        expect(mockStorage.markTempUploadProcessed).toHaveBeenCalledTimes(2);
        expect(mockStorage.updateUploadBatchProgress).toHaveBeenCalledWith('batch-1', 2, 0);
      });

      it('should extract text from PDF files correctly', async () => {
        const mockPdfUpload = {
          id: 1,
          batchId: 'batch-pdf',
          filename: 'resume.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/resume.pdf',
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

        mockStorage.getPendingTempUploads.mockResolvedValue([mockPdfUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockPdfUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('pdf content'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('PDF extracted text content');
        
        mockStorage.createProfileResume.mockResolvedValue({
          id: 20,
          filename: 'resume.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/resume.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedAt: new Date(),
          uploadedBy: 1,
          extractedText: 'PDF extracted text content'
        });

        await processor.processUploadQueue();

        expect(extractTextFromDocument).toHaveBeenCalledWith(
          expect.any(Buffer),
          'application/pdf'
        );
        expect(mockStorage.createProfileResume).toHaveBeenCalledWith(
          expect.objectContaining({
            filename: 'resume.pdf',
            fileType: 'pdf'
          }),
          'PDF extracted text content',
          expect.any(Buffer)
        );
      });

      it('should extract text from DOCX files correctly', async () => {
        const mockDocxUpload = {
          id: 2,
          batchId: 'batch-docx',
          filename: 'resume.docx',
          fileType: 'docx' as const,
          fileSize: 2048,
          filePath: '/uploads/resume.docx',
          candidateName: 'Test User',
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

        mockStorage.getPendingTempUploads.mockResolvedValue([mockDocxUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockDocxUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('docx content'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('DOCX extracted text content');
        
        mockStorage.createProfileResume.mockResolvedValue({
          id: 21,
          filename: 'resume.docx',
          fileType: 'docx',
          fileSize: 2048,
          filePath: '/uploads/resume.docx',
          candidateName: 'Test User',
          candidateEmail: 'test@example.com',
          uploadedAt: new Date(),
          uploadedBy: 1,
          extractedText: 'DOCX extracted text content'
        });

        await processor.processUploadQueue();

        expect(extractTextFromDocument).toHaveBeenCalledWith(
          expect.any(Buffer),
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
      });

      it('should handle memory management during processing', async () => {
        // Create a large batch to test memory management
        const mockLargeBatch = Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          batchId: 'batch-large',
          filename: `resume${i + 1}.pdf`,
          fileType: 'pdf' as const,
          fileSize: 5 * 1024 * 1024, // 5MB each
          filePath: `/uploads/resume${i + 1}.pdf`,
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
        }));

        mockStorage.getPendingTempUploads.mockResolvedValue(mockLargeBatch);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockLargeBatch[0]);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockResolvedValue(Buffer.alloc(5 * 1024 * 1024)); // 5MB buffer
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('Large file text content');
        
        mockStorage.createProfileResume.mockResolvedValue({
          id: 30,
          filename: 'resume1.pdf',
          fileType: 'pdf',
          fileSize: 5 * 1024 * 1024,
          filePath: '/uploads/resume1.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedAt: new Date(),
          uploadedBy: 1,
          extractedText: 'Large file text content'
        });

        // Mock garbage collection
        global.gc = jest.fn();

        await processor.processUploadQueue();

        // Should process all files in the batch
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledTimes(10);
        
        // Memory should be managed (garbage collection should be called)
        if (global.gc) {
          expect(global.gc).toHaveBeenCalled();
        }
      });
    });

    describe('Failure Scenarios', () => {
      it('should handle file read errors with retry mechanism', async () => {
        const mockUpload = {
          id: 3,
          batchId: 'batch-error',
          filename: 'error.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/error.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 1, // One previous attempt
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

        await processor.processUploadQueue();

        // Should increment attempts and update error message
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          3,
          'pending',
          'File not found'
        );
      });

      it('should mark upload as failed after max retries', async () => {
        const mockUpload = {
          id: 4,
          batchId: 'batch-max-retries',
          filename: 'max-retries.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/max-retries.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 2, // Already at max retries
          errorMessage: 'Previous errors',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockStorage.getPendingTempUploads.mockResolvedValue([mockUpload]);
        mockStorage.updateTempUploadStatus.mockResolvedValue(mockUpload);
        
        const { readFile } = await import('../file-utils');
        (readFile as jest.Mock).mockRejectedValue(new Error('Persistent error'));

        await processor.processUploadQueue();

        // Should mark as failed with max retries message
        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          4,
          'failed',
          'Max retries exceeded: Persistent error'
        );
      });

      it('should handle text extraction failures', async () => {
        const mockUpload = {
          id: 5,
          batchId: 'batch-extraction-error',
          filename: 'extraction-error.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/extraction-error.pdf',
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
        (extractTextFromDocument as jest.Mock).mockRejectedValue(new Error('Cannot parse corrupted PDF'));

        await processor.processUploadQueue();

        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          5,
          'pending',
          'Failed to extract text: Cannot parse corrupted PDF'
        );
      });

      it('should handle empty/whitespace-only text extraction', async () => {
        const mockUpload = {
          id: 6,
          batchId: 'batch-empty-text',
          filename: 'empty-text.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/empty-text.pdf',
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
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('empty pdf'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('   \n\t  '); // Only whitespace

        await processor.processUploadQueue();

        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          6,
          'pending',
          'No text content found in the document'
        );
      });

      it('should handle database creation errors', async () => {
        const mockUpload = {
          id: 7,
          batchId: 'batch-db-error',
          filename: 'db-error.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/db-error.pdf',
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
        (readFile as jest.Mock).mockResolvedValue(Buffer.from('valid pdf'));
        
        const { extractTextFromDocument } = await import('../document-parser');
        (extractTextFromDocument as jest.Mock).mockResolvedValue('Valid extracted text');
        
        mockStorage.createProfileResume.mockRejectedValue(new Error('Database constraint violation'));

        await processor.processUploadQueue();

        expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledWith(
          7,
          'pending',
          'Failed to create profile resume: Database constraint violation'
        );
      });
    });
  });

  describe('Cleanup Operations', () => {
    describe('Success Scenarios', () => {
      it('should clean up processed uploads older than 24 hours', async () => {
        const oldProcessedUploads = [
          {
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
            uploadedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            processedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
            profileResumeId: 100,
            processingAttempts: 1,
            errorMessage: null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        ];

        mockStorage.getProcessedTempUploads.mockResolvedValue(oldProcessedUploads);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        await processor.performCleanup();

        expect(mockStorage.getProcessedTempUploads).toHaveBeenCalledWith(24);
        expect(deleteFile).toHaveBeenCalledWith('/uploads/old-processed.pdf');
        expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(10);
      });

      it('should clean up expired and failed uploads', async () => {
        const expiredUploads = [
          {
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
            uploadedAt: new Date(Date.now() - 73 * 60 * 60 * 1000),
            processedAt: null,
            profileResumeId: null,
            processingAttempts: 3,
            errorMessage: 'Max retries exceeded',
            expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000)
          }
        ];

        mockStorage.getProcessedTempUploads.mockResolvedValue([]);
        mockStorage.getExpiredTempUploads.mockResolvedValue(expiredUploads);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        await processor.performCleanup();

        expect(mockStorage.getExpiredTempUploads).toHaveBeenCalledWith(72);
        expect(deleteFile).toHaveBeenCalledWith('/uploads/expired.pdf');
        expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(11);
      });

      it('should clean up orphaned batches', async () => {
        const orphanedBatches = [
          {
            batchId: 'batch-orphaned',
            totalFiles: 5,
            completedFiles: 5,
            failedFiles: 0,
            status: 'completed' as const,
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
            uploadedBy: 1
          }
        ];

        mockStorage.getProcessedTempUploads.mockResolvedValue([]);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue(orphanedBatches);

        await processor.performCleanup();

        expect(mockStorage.getOrphanedBatches).toHaveBeenCalled();
        expect(mockStorage.deleteUploadBatch).toHaveBeenCalledWith('batch-orphaned');
      });
    });

    describe('Failure Scenarios', () => {
      it('should continue cleanup even if file deletion fails', async () => {
        const processedUploads = [
          {
            id: 12,
            batchId: 'batch-file-error',
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
          }
        ];

        mockStorage.getProcessedTempUploads.mockResolvedValue(processedUploads);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockRejectedValue(new Error('Permission denied'));

        await processor.performCleanup();

        // Should continue with database cleanup despite file deletion error
        expect(mockStorage.deleteTempUpload).toHaveBeenCalledWith(12);
      });

      it('should handle database cleanup errors gracefully', async () => {
        const processedUploads = [
          {
            id: 13,
            batchId: 'batch-db-cleanup-error',
            filename: 'db-cleanup-error.pdf',
            fileType: 'pdf' as const,
            fileSize: 1024,
            filePath: '/uploads/db-cleanup-error.pdf',
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
          }
        ];

        mockStorage.getProcessedTempUploads.mockResolvedValue(processedUploads);
        mockStorage.getExpiredTempUploads.mockResolvedValue([]);
        mockStorage.getOrphanedBatches.mockResolvedValue([]);
        mockStorage.deleteTempUpload.mockRejectedValue(new Error('Database connection lost'));
        
        const { deleteFile } = await import('../file-utils');
        (deleteFile as jest.Mock).mockResolvedValue(undefined);

        // Should not throw error
        await expect(processor.performCleanup()).resolves.not.toThrow();
      });
    });
  });

  describe('Processor Lifecycle', () => {
    it('should start and stop processor correctly', () => {
      expect(() => processor.start()).not.toThrow();
      expect(() => processor.stop()).not.toThrow();
    });

    it('should handle multiple start/stop calls', () => {
      processor.start();
      processor.start(); // Should not cause issues
      processor.stop();
      processor.stop(); // Should not cause issues
    });

    it('should process uploads at regular intervals when started', async () => {
      jest.useFakeTimers();
      
      mockStorage.getPendingTempUploads.mockResolvedValue([]);
      
      processor.start();
      
      // Fast forward time
      jest.advanceTimersByTime(30000); // 30 seconds
      
      expect(mockStorage.getPendingTempUploads).toHaveBeenCalled();
      
      processor.stop();
      jest.useRealTimers();
    });

    it('should perform cleanup at regular intervals', async () => {
      jest.useFakeTimers();
      
      mockStorage.getProcessedTempUploads.mockResolvedValue([]);
      mockStorage.getExpiredTempUploads.mockResolvedValue([]);
      mockStorage.getOrphanedBatches.mockResolvedValue([]);
      
      processor.start();
      
      // Fast forward to cleanup time (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);
      
      expect(mockStorage.getProcessedTempUploads).toHaveBeenCalled();
      
      processor.stop();
      jest.useRealTimers();
    });
  });

  describe('Status and Monitoring', () => {
    it('should track processing statistics', async () => {
      const status = processor.getStatus();
      
      expect(status).toHaveProperty('uptime');
      expect(status).toHaveProperty('lastCheck');
      expect(status).toHaveProperty('isRunning');
      expect(typeof status.uptime).toBe('number');
      expect(typeof status.lastCheck).toBe('string');
      expect(typeof status.isRunning).toBe('boolean');
    });

    it('should update last check time after processing', async () => {
      mockStorage.getPendingTempUploads.mockResolvedValue([]);
      
      const statusBefore = processor.getStatus();
      await processor.processUploadQueue();
      const statusAfter = processor.getStatus();
      
      expect(new Date(statusAfter.lastCheck).getTime()).toBeGreaterThanOrEqual(
        new Date(statusBefore.lastCheck).getTime()
      );
    });
  });

  describe('Error Recovery', () => {
    it('should continue processing after encountering errors', async () => {
      const mockUploads = [
        {
          id: 1,
          batchId: 'batch-recovery-test',
          filename: 'error.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/error.pdf',
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
        },
        {
          id: 2,
          batchId: 'batch-recovery-test',
          filename: 'success.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/success.pdf',
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
        }
      ];

      mockStorage.getPendingTempUploads.mockResolvedValue(mockUploads);
      mockStorage.updateTempUploadStatus.mockResolvedValue(mockUploads[0]);
      
      const { readFile } = await import('../file-utils');
      (readFile as jest.Mock).mockRejectedValueOnce(new Error('File read error'))
                             .mockResolvedValueOnce(Buffer.from('success content'));
      
      const { extractTextFromDocument } = await import('../document-parser');
      (extractTextFromDocument as jest.Mock).mockResolvedValue('Success text');
      
      mockStorage.createProfileResume.mockResolvedValue({
        id: 50,
        filename: 'success.pdf',
        fileType: 'pdf',
        fileSize: 1024,
        filePath: '/uploads/success.pdf',
        candidateName: null,
        candidateEmail: null,
        uploadedAt: new Date(),
        uploadedBy: 1,
        extractedText: 'Success text'
      });

      await processor.processUploadQueue();

      // Should process both uploads despite error in first one
      expect(mockStorage.updateTempUploadStatus).toHaveBeenCalledTimes(2);
      expect(mockStorage.createProfileResume).toHaveBeenCalledTimes(1); // Only for successful one
    });
  });
});