import { storage } from './storage';
import type { TempProfileUpload } from '@shared/schema';

export class BackgroundProcessor {
  private isProcessing = false;
  private isCleaningUp = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly BATCH_SIZE = 5; // Process 5 files at a time
  private readonly MAX_RETRIES = 3;
  private readonly CLEANUP_AFTER_HOURS = 24; // Clean up processed files after 24 hours
  private readonly EXPIRED_AFTER_HOURS = 72; // Remove failed files after 72 hours

  constructor() {
    console.log('Background processor initialized');
  }

  start(): void {
    if (this.processingInterval) {
      console.log('Background processor already running');
      return;
    }

    console.log('Starting background processor...');
    
    // Start processing interval
    this.processingInterval = setInterval(() => {
      this.processUploadQueue().catch(error => {
        console.error('Background processing error:', error);
      });
    }, this.PROCESSING_INTERVAL);

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('Background cleanup error:', error);
      });
    }, this.CLEANUP_INTERVAL);

    // Process immediately on start
    this.processUploadQueue().catch(error => {
      console.error('Initial background processing error:', error);
    });

    // Run initial cleanup after 1 minute
    setTimeout(() => {
      this.performCleanup().catch(error => {
        console.error('Initial cleanup error:', error);
      });
    }, 60000);
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    console.log('Background processor stopped');
  }

  async processUploadQueue(): Promise<void> {
    if (this.isProcessing) {
      console.log('Background processor already running, skipping...');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Get pending uploads
      const pendingUploads = await storage.getPendingTempUploads(this.BATCH_SIZE);
      
      if (pendingUploads.length === 0) {
        return;
      }

      console.log(`Processing ${pendingUploads.length} pending uploads...`);

      const results = {
        processed: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Process each file
      for (const upload of pendingUploads) {
        try {
          const success = await this.processUpload(upload);
          if (success) {
            results.processed++;
          } else {
            results.failed++;
          }
        } catch (error) {
          console.error(`Error processing upload ${upload.id}:`, error);
          results.failed++;
          results.errors.push(`${upload.filename}: ${(error as Error).message}`);
          
          // Update upload status as failed if max retries reached
          if (upload.processingAttempts >= this.MAX_RETRIES) {
            await storage.updateTempUploadStatus(
              upload.id, 
              'failed', 
              `Max retries exceeded: ${(error as Error).message}`
            );
          } else {
            await storage.updateTempUploadStatus(
              upload.id, 
              'pending', 
              (error as Error).message
            );
          }
        }
      }

      const duration = Date.now() - startTime;
      console.log(`Background processing completed in ${duration}ms: ${results.processed} processed, ${results.failed} failed`);

      if (results.errors.length > 0) {
        console.warn('Processing errors:', results.errors);
      }

    } catch (error) {
      console.error('Background processing queue error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  async performCleanup(): Promise<void> {
    if (this.isCleaningUp) {
      console.log('Cleanup already running, skipping...');
      return;
    }

    this.isCleaningUp = true;
    const startTime = Date.now();

    try {
      console.log('Starting cleanup process...');

      const results = {
        processedCleaned: 0,
        expiredCleaned: 0,
        orphanedBatches: 0,
        errors: [] as string[]
      };

      // Phase 1: Clean up processed temp uploads older than 24 hours
      try {
        const processedUploads = await storage.getProcessedTempUploads(this.CLEANUP_AFTER_HOURS);
        
        for (const upload of processedUploads) {
          try {
            // Delete file from filesystem
            const { deleteFile } = await import('./file-utils');
            await deleteFile(upload.filePath);
            
            // Remove from temp table
            await storage.deleteTempUpload(upload.id);
            results.processedCleaned++;
            
          } catch (error) {
            console.error(`Failed to clean processed upload ${upload.id}:`, error);
            results.errors.push(`Processed upload ${upload.filename}: ${(error as Error).message}`);
          }
        }
      } catch (error) {
        console.error('Error cleaning processed uploads:', error);
        results.errors.push(`Processed cleanup: ${(error as Error).message}`);
      }

      // Phase 2: Clean up failed/expired temp uploads older than 72 hours
      try {
        const expiredUploads = await storage.getExpiredTempUploads(this.EXPIRED_AFTER_HOURS);
        
        for (const upload of expiredUploads) {
          try {
            // Delete file from filesystem
            const { deleteFile } = await import('./file-utils');
            await deleteFile(upload.filePath);
            
            // Remove from temp table
            await storage.deleteTempUpload(upload.id);
            results.expiredCleaned++;
            
          } catch (error) {
            console.error(`Failed to clean expired upload ${upload.id}:`, error);
            results.errors.push(`Expired upload ${upload.filename}: ${(error as Error).message}`);
          }
        }
      } catch (error) {
        console.error('Error cleaning expired uploads:', error);
        results.errors.push(`Expired cleanup: ${(error as Error).message}`);
      }

      // Phase 3: Clean up orphaned batches (completed batches with no temp uploads)
      try {
        const orphanedBatches = await storage.getOrphanedBatches();
        
        for (const batch of orphanedBatches) {
          try {
            await storage.deleteUploadBatch(batch.batchId);
            results.orphanedBatches++;
          } catch (error) {
            console.error(`Failed to clean orphaned batch ${batch.batchId}:`, error);
            results.errors.push(`Orphaned batch ${batch.batchId}: ${(error as Error).message}`);
          }
        }
      } catch (error) {
        console.error('Error cleaning orphaned batches:', error);
        results.errors.push(`Orphaned batch cleanup: ${(error as Error).message}`);
      }

      const duration = Date.now() - startTime;
      const totalCleaned = results.processedCleaned + results.expiredCleaned + results.orphanedBatches;
      
      if (totalCleaned > 0) {
        console.log(`Cleanup completed in ${duration}ms: ${results.processedCleaned} processed, ${results.expiredCleaned} expired, ${results.orphanedBatches} orphaned batches`);
      }

      if (results.errors.length > 0) {
        console.warn('Cleanup errors:', results.errors);
      }

    } catch (error) {
      console.error('Cleanup process error:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  private async processUpload(upload: TempProfileUpload): Promise<boolean> {
    console.log(`Processing upload: ${upload.filename} (ID: ${upload.id})`);

    try {
      // Mark as processing
      await storage.updateTempUploadStatus(upload.id, 'processing');

      // Read file from filesystem
      const { readFile } = await import('./file-utils');
      const fileBuffer = await readFile(upload.filePath);

      // Extract text from the file
      let extractedText = "";
      try {
        const { extractTextFromDocument } = await import("./document-parser");
        const mimeType = upload.fileType === 'pdf' 
          ? 'application/pdf' 
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        
        extractedText = await extractTextFromDocument(fileBuffer, mimeType);
      } catch (parseError) {
        throw new Error(`Failed to extract text: ${(parseError as Error).message}`);
      }

      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("No text content found in the document");
      }

      // Create permanent profile resume record
      const resumeData = {
        filename: upload.filename,
        fileType: upload.fileType,
        fileSize: upload.fileSize,
        filePath: upload.filePath,
        candidateName: upload.candidateName,
        candidateEmail: upload.candidateEmail,
        uploadedBy: upload.uploadedBy,
      };

      const resume = await storage.createProfileResume(resumeData, extractedText, fileBuffer);

      // Mark temp upload as processed with link to permanent record
      await storage.markTempUploadProcessed(upload.id, resume.id);

      // Update batch progress
      await this.updateBatchProgress(upload.batchId);

      // Create activity for successful processing
      await storage.createActivity({
        type: "system_integration",
        userId: upload.uploadedBy,
        message: `Background processing completed: ${upload.filename} → Profile Resume ID ${resume.id}`
      });

      console.log(`Successfully processed: ${upload.filename} → Resume ID ${resume.id}`);
      return true;

    } catch (error) {
      console.error(`Failed to process upload ${upload.id}:`, error);
      
      // Update batch progress (increment failed count)
      await this.updateBatchProgress(upload.batchId);
      
      return false;
    }
  }

  private async updateBatchProgress(batchId: string): Promise<void> {
    try {
      // Get current batch status
      const batch = await storage.getUploadBatchStatus(batchId);
      if (!batch) return;

      // Count processed uploads for this batch
      const { countTempUploadsByStatus } = await import('./storage-helpers');
      const processed = await countTempUploadsByStatus(batchId, 'processed');
      const failed = await countTempUploadsByStatus(batchId, 'failed');

      // Update batch progress
      await storage.updateUploadBatchProgress(batchId, processed, failed);
      
    } catch (error) {
      console.error(`Failed to update batch progress for ${batchId}:`, error);
    }
  }

  // Manual trigger for testing
  async processNow(): Promise<void> {
    console.log('Manual background processing triggered');
    await this.processUploadQueue();
  }

  // Manual cleanup trigger
  async cleanupNow(): Promise<void> {
    console.log('Manual cleanup triggered');
    await this.performCleanup();
  }

  // Get current status
  getStatus(): { isProcessing: boolean; isCleaningUp: boolean; isRunning: boolean } {
    return {
      isProcessing: this.isProcessing,
      isCleaningUp: this.isCleaningUp,
      isRunning: this.processingInterval !== null
    };
  }
}

// Singleton instance
export const backgroundProcessor = new BackgroundProcessor();

// Helper functions for batch processing
export const startBackgroundProcessor = () => backgroundProcessor.start();
export const stopBackgroundProcessor = () => backgroundProcessor.stop();
export const processNow = () => backgroundProcessor.processNow();
export const cleanupNow = () => backgroundProcessor.cleanupNow();
export const getProcessorStatus = () => backgroundProcessor.getStatus();