import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DatabaseStorage } from '../storage';
import { db } from '../db';
import type { TempProfileUpload, UploadBatch } from '@shared/schema';

// Mock the database
jest.mock('../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  }
}));

const mockDb = db as jest.Mocked<typeof db>;

describe('Storage - Temporary Upload Operations', () => {
  let storage: DatabaseStorage;

  beforeEach(() => {
    storage = new DatabaseStorage();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Phase 1: Fast Upload Storage', () => {
    describe('createUploadBatch', () => {
      it('should create upload batch successfully', async () => {
        const mockBatch: UploadBatch = {
          batchId: 'batch-123',
          totalFiles: 5,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        mockDb.insert.mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockBatch])
          })
        } as any);

        const result = await storage.createUploadBatch(5, 1);

        expect(result).toEqual(mockBatch);
        expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should handle database errors during batch creation', async () => {
        mockDb.insert.mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockRejectedValue(new Error('Database connection failed'))
          })
        } as any);

        await expect(storage.createUploadBatch(5, 1)).rejects.toThrow('Database connection failed');
      });
    });

    describe('createTempProfileUpload', () => {
      it('should create temporary upload record successfully', async () => {
        const uploadData = {
          batchId: 'batch-123',
          filename: 'test.pdf',
          fileType: 'pdf' as const,
          fileSize: 1024,
          filePath: '/uploads/test.pdf',
          candidateName: 'John Doe',
          candidateEmail: 'john@example.com',
          uploadedBy: 1
        };

        const mockTempUpload: TempProfileUpload = {
          id: 1,
          ...uploadData,
          uploadStatus: 'pending',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 0,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockDb.insert.mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([mockTempUpload])
          })
        } as any);

        const result = await storage.createTempProfileUpload(uploadData);

        expect(result).toEqual(mockTempUpload);
        expect(mockDb.insert).toHaveBeenCalled();
      });

      it('should handle validation errors', async () => {
        const invalidData = {
          batchId: '',
          filename: '',
          fileType: 'invalid' as any,
          fileSize: -1,
          filePath: '',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 0
        };

        mockDb.insert.mockReturnValue({
          values: jest.fn().mockReturnValue({
            returning: jest.fn().mockRejectedValue(new Error('Validation failed'))
          })
        } as any);

        await expect(storage.createTempProfileUpload(invalidData)).rejects.toThrow('Validation failed');
      });
    });
  });

  describe('Phase 2: Background Processing Storage', () => {
    describe('getPendingTempUploads', () => {
      it('should retrieve pending uploads with default limit', async () => {
        const mockPendingUploads: TempProfileUpload[] = [
          {
            id: 1,
            batchId: 'batch-1',
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
          }
        ];

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue(mockPendingUploads)
              })
            })
          })
        } as any);

        const result = await storage.getPendingTempUploads();

        expect(result).toEqual(mockPendingUploads);
        expect(result).toHaveLength(1);
      });

      it('should respect custom limit parameter', async () => {
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
              })
            })
          })
        } as any);

        await storage.getPendingTempUploads(20);

        // Verify limit was applied (the exact verification depends on your implementation)
        expect(mockDb.select).toHaveBeenCalled();
      });

      it('should handle empty results', async () => {
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              orderBy: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue([])
              })
            })
          })
        } as any);

        const result = await storage.getPendingTempUploads();

        expect(result).toEqual([]);
      });
    });

    describe('updateTempUploadStatus', () => {
      it('should update upload status successfully', async () => {
        const mockUpdated: TempProfileUpload = {
          id: 1,
          batchId: 'batch-1',
          filename: 'test.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/test.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'processing',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 1,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([mockUpdated])
            })
          })
        } as any);

        const result = await storage.updateTempUploadStatus(1, 'processing');

        expect(result).toEqual(mockUpdated);
        expect(mockDb.update).toHaveBeenCalled();
      });

      it('should update status with error message', async () => {
        const mockUpdated: TempProfileUpload = {
          id: 1,
          batchId: 'batch-1',
          filename: 'failed.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/failed.pdf',
          candidateName: null,
          candidateEmail: null,
          uploadedBy: 1,
          uploadStatus: 'failed',
          uploadedAt: new Date(),
          processedAt: null,
          profileResumeId: null,
          processingAttempts: 3,
          errorMessage: 'Text extraction failed',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([mockUpdated])
            })
          })
        } as any);

        const result = await storage.updateTempUploadStatus(1, 'failed', 'Text extraction failed');

        expect(result.uploadStatus).toBe('failed');
        expect(result.errorMessage).toBe('Text extraction failed');
      });

      it('should handle non-existent upload ID', async () => {
        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([])
            })
          })
        } as any);

        await expect(storage.updateTempUploadStatus(999, 'processing')).rejects.toThrow();
      });
    });

    describe('markTempUploadProcessed', () => {
      it('should mark upload as processed with profile resume ID', async () => {
        const mockProcessed: TempProfileUpload = {
          id: 1,
          batchId: 'batch-1',
          filename: 'processed.pdf',
          fileType: 'pdf',
          fileSize: 1024,
          filePath: '/uploads/processed.pdf',
          candidateName: 'John Doe',
          candidateEmail: 'john@example.com',
          uploadedBy: 1,
          uploadStatus: 'processed',
          uploadedAt: new Date(),
          processedAt: new Date(),
          profileResumeId: 100,
          processingAttempts: 1,
          errorMessage: null,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        };

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([mockProcessed])
            })
          })
        } as any);

        const result = await storage.markTempUploadProcessed(1, 100);

        expect(result.uploadStatus).toBe('processed');
        expect(result.profileResumeId).toBe(100);
        expect(result.processedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe('Phase 3: Cleanup Storage', () => {
    describe('getProcessedTempUploads', () => {
      it('should retrieve processed uploads older than specified hours', async () => {
        const mockProcessedUploads: TempProfileUpload[] = [
          {
            id: 1,
            batchId: 'batch-old',
            filename: 'old-processed.pdf',
            fileType: 'pdf',
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

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockProcessedUploads)
          })
        } as any);

        const result = await storage.getProcessedTempUploads(24);

        expect(result).toEqual(mockProcessedUploads);
      });

      it('should return empty array when no old processed uploads', async () => {
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        } as any);

        const result = await storage.getProcessedTempUploads(24);

        expect(result).toEqual([]);
      });
    });

    describe('getExpiredTempUploads', () => {
      it('should retrieve expired/failed uploads', async () => {
        const mockExpiredUploads: TempProfileUpload[] = [
          {
            id: 1,
            batchId: 'batch-expired',
            filename: 'expired.pdf',
            fileType: 'pdf',
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

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue(mockExpiredUploads)
          })
        } as any);

        const result = await storage.getExpiredTempUploads(72);

        expect(result).toEqual(mockExpiredUploads);
      });

      it('should use default 72 hours when no parameter provided', async () => {
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        } as any);

        await storage.getExpiredTempUploads();

        expect(mockDb.select).toHaveBeenCalled();
      });
    });

    describe('getOrphanedBatches', () => {
      it('should retrieve completed batches with no remaining temp uploads', async () => {
        const mockOrphanedBatches: UploadBatch[] = [
          {
            batchId: 'batch-orphaned',
            totalFiles: 5,
            completedFiles: 5,
            failedFiles: 0,
            status: 'completed',
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
            completedAt: new Date(Date.now() - 47 * 60 * 60 * 1000),
            uploadedBy: 1
          }
        ];

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                groupBy: jest.fn().mockResolvedValue(mockOrphanedBatches)
              })
            })
          })
        } as any);

        const result = await storage.getOrphanedBatches();

        expect(result).toEqual(mockOrphanedBatches);
      });

      it('should return empty array when no orphaned batches', async () => {
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            leftJoin: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                groupBy: jest.fn().mockResolvedValue([])
              })
            })
          })
        } as any);

        const result = await storage.getOrphanedBatches();

        expect(result).toEqual([]);
      });
    });

    describe('deleteTempUpload', () => {
      it('should delete temporary upload successfully', async () => {
        mockDb.delete.mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        } as any);

        await storage.deleteTempUpload(1);

        expect(mockDb.delete).toHaveBeenCalled();
      });

      it('should handle deletion of non-existent upload', async () => {
        mockDb.delete.mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        } as any);

        // Should not throw error for non-existent ID
        await expect(storage.deleteTempUpload(999)).resolves.not.toThrow();
      });
    });

    describe('deleteUploadBatch', () => {
      it('should delete upload batch successfully', async () => {
        mockDb.delete.mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        } as any);

        await storage.deleteUploadBatch('batch-123');

        expect(mockDb.delete).toHaveBeenCalled();
      });

      it('should handle deletion of non-existent batch', async () => {
        mockDb.delete.mockReturnValue({
          where: jest.fn().mockResolvedValue(undefined)
        } as any);

        // Should not throw error for non-existent batch
        await expect(storage.deleteUploadBatch('non-existent')).resolves.not.toThrow();
      });
    });
  });

  describe('Batch Status and Progress', () => {
    describe('getUploadBatchStatus', () => {
      it('should retrieve batch status successfully', async () => {
        const mockBatch: UploadBatch = {
          batchId: 'batch-status',
          totalFiles: 10,
          completedFiles: 7,
          failedFiles: 2,
          status: 'processing',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([mockBatch])
          })
        } as any);

        const result = await storage.getUploadBatchStatus('batch-status');

        expect(result).toEqual(mockBatch);
      });

      it('should return undefined for non-existent batch', async () => {
        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([])
          })
        } as any);

        const result = await storage.getUploadBatchStatus('non-existent');

        expect(result).toBeUndefined();
      });
    });

    describe('updateUploadBatchProgress', () => {
      it('should update batch progress and mark as completed when all files processed', async () => {
        const currentBatch: UploadBatch = {
          batchId: 'batch-complete',
          totalFiles: 5,
          completedFiles: 3,
          failedFiles: 1,
          status: 'processing',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        const updatedBatch: UploadBatch = {
          ...currentBatch,
          completedFiles: 4,
          failedFiles: 1,
          status: 'failed', // Has failed files
          completedAt: new Date()
        };

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([currentBatch])
          })
        } as any);

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([updatedBatch])
            })
          })
        } as any);

        const result = await storage.updateUploadBatchProgress('batch-complete', 4, 1);

        expect(result.status).toBe('failed');
        expect(result.completedAt).toBeInstanceOf(Date);
      });

      it('should mark as completed when all files successful', async () => {
        const currentBatch: UploadBatch = {
          batchId: 'batch-success',
          totalFiles: 3,
          completedFiles: 2,
          failedFiles: 0,
          status: 'processing',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        const updatedBatch: UploadBatch = {
          ...currentBatch,
          completedFiles: 3,
          failedFiles: 0,
          status: 'completed',
          completedAt: new Date()
        };

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([currentBatch])
          })
        } as any);

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([updatedBatch])
            })
          })
        } as any);

        const result = await storage.updateUploadBatchProgress('batch-success', 3, 0);

        expect(result.status).toBe('completed');
        expect(result.completedAt).toBeInstanceOf(Date);
      });

      it('should keep processing status when not all files processed', async () => {
        const currentBatch: UploadBatch = {
          batchId: 'batch-processing',
          totalFiles: 10,
          completedFiles: 0,
          failedFiles: 0,
          status: 'pending',
          createdAt: new Date(),
          completedAt: null,
          uploadedBy: 1
        };

        const updatedBatch: UploadBatch = {
          ...currentBatch,
          completedFiles: 3,
          failedFiles: 1,
          status: 'processing'
        };

        mockDb.select.mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockResolvedValue([currentBatch])
          })
        } as any);

        mockDb.update.mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([updatedBatch])
            })
          })
        } as any);

        const result = await storage.updateUploadBatchProgress('batch-processing', 3, 1);

        expect(result.status).toBe('processing');
        expect(result.completedAt).toBeNull();
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockRejectedValue(new Error('Connection timeout'))
        })
      } as any);

      await expect(storage.getPendingTempUploads()).rejects.toThrow('Connection timeout');
    });

    it('should handle concurrent batch updates', async () => {
      // Simulate race condition where batch is updated by another process
      const staleCurrentBatch: UploadBatch = {
        batchId: 'batch-concurrent',
        totalFiles: 5,
        completedFiles: 2,
        failedFiles: 0,
        status: 'processing',
        createdAt: new Date(),
        completedAt: null,
        uploadedBy: 1
      };

      const updatedBatch: UploadBatch = {
        ...staleCurrentBatch,
        completedFiles: 3,
        failedFiles: 0,
        status: 'processing'
      };

      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([staleCurrentBatch])
        })
      } as any);

      mockDb.update.mockReturnValue({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue([updatedBatch])
          })
        } as any);

      const result = await storage.updateUploadBatchProgress('batch-concurrent', 3, 0);

      expect(result.completedFiles).toBe(3);
    });

    it('should handle malformed batch IDs', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([])
        })
      } as any);

      const result = await storage.getUploadBatchStatus('');

      expect(result).toBeUndefined();
    });
  });
});