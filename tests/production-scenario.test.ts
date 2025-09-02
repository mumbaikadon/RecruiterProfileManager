/**
 * Production Scenario Recreation Test
 * Specifically tests the exact scenario that caused 87 files to fail in production
 */

import { Buffer } from 'node:buffer';
import { extractTextFromPdf, extractTextFromDocument } from '../server/document-parser';

// Mock the profile logger
jest.mock('../server/logger', () => ({
  profileLogger: {
    extractionStart: jest.fn(),
    extractionSuccess: jest.fn(),
    extractionError: jest.fn(),
  },
}));

describe('Production Scenario Recreation Tests', () => {

  describe('Exact Production Failure Recreation', () => {
    
    test('should not fail with "No GlobalWorkerOptions.workerSrc specified" error', async () => {
      // These are the exact filenames from the production logs
      const productionFiles = [
        'HANDAN DERIN - AD 2025.pdf',
        'KenanByrd_Resume_.pdf', 
        'Joshua Molina resume (1).pdf',
        'Nye_Cassell.pdf',
        'Siva Sankar Masanam (1).pdf',
        'Mo.-Saleem.pdf',
        'Aaron Wilson Resume.pdf',
        'Roshni_Developer (1).pdf',
        'Abbas Mollayev Resume (1).pdf',
        'Mike Shakhnovich Resume[32].pdf',
        'Rama k Gowda -.pdf',
        'Resume_Pra.pdf',
        'MARIELA_ROSALES_RESUME pdf.pdf',
        'AdelEddin_Technical_Resume_Detailed[96].pdf',
        'Calvin (isi) Pringle.pdf',
        'Alekhya Annam Resume.pdf',
        'Kenneth Kima-Resume.pdf',
        'Naimisha Kunta Resume1 (3).pdf',
        'Epic - Resume.pdf',
        'CHRISTIAN FOTACHWI Resume (1).pdf'
      ];

      const results = {
        successful: [],
        failed: [],
        workerErrors: []
      };

      // Create mock PDF buffers for each file
      for (const filename of productionFiles) {
        const mockPdfBuffer = Buffer.from(`%PDF-1.4\nMock content for ${filename}\n%%EOF`);
        
        try {
          await extractTextFromPdf(mockPdfBuffer);
          results.successful.push(filename);
        } catch (error) {
          results.failed.push({ filename, error: error.message });
          
          // Check for the specific worker error that was causing failures
          if (error.message.includes('GlobalWorkerOptions.workerSrc') || 
              error.message.includes('Setting up fake worker failed')) {
            results.workerErrors.push({ filename, error: error.message });
          }
        }
      }

      // The key assertion: NO files should fail due to worker configuration
      expect(results.workerErrors).toHaveLength(0);
      
      // All failures should be due to PDF parsing/structure issues, not worker config
      results.failed.forEach(({ filename, error }) => {
        expect(error).not.toContain('GlobalWorkerOptions.workerSrc');
        expect(error).not.toContain('Setting up fake worker failed');
        expect(error).not.toContain('No "GlobalWorkerOptions.workerSrc" specified');
      });

      console.log(`Production test results: ${results.successful.length} succeeded, ${results.failed.length} failed due to PDF structure, ${results.workerErrors.length} failed due to worker config`);
    }, 60000);

    test('should handle bulk upload chunk processing like production', async () => {
      // Simulate the exact bulk upload scenario from production
      const files = Array.from({ length: 87 }, (_, i) => ({
        name: `production-file-${i + 1}.pdf`,
        buffer: Buffer.from(`%PDF-1.4\nProduction file ${i + 1} content\n%%EOF`),
        size: Math.floor(Math.random() * 500000) + 50000 // Random size between 50KB-550KB
      }));

      const BACKEND_CHUNK_SIZE = 3; // Same as production
      const chunks = [];
      
      for (let i = 0; i < files.length; i += BACKEND_CHUNK_SIZE) {
        chunks.push(files.slice(i, i + BACKEND_CHUNK_SIZE));
      }

      const results = {
        successful: [],
        failed: [],
        workerConfigErrors: 0,
        totalProcessed: 0
      };

      // Process each chunk like production
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        
        const chunkPromises = chunk.map(async (file) => {
          try {
            await extractTextFromPdf(file.buffer);
            return { filename: file.name, success: true };
          } catch (error) {
            const isWorkerError = error.message.includes('GlobalWorkerOptions') || 
                                 error.message.includes('fake worker');
            
            if (isWorkerError) {
              results.workerConfigErrors++;
            }
            
            return { 
              filename: file.name, 
              success: false, 
              error: error.message,
              isWorkerError 
            };
          }
        });

        const chunkResults = await Promise.allSettled(chunkPromises);
        
        chunkResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            results.totalProcessed++;
            if (result.value.success) {
              results.successful.push(result.value);
            } else {
              results.failed.push(result.value);
            }
          }
        });
      }

      // Key assertions for production scenario
      expect(results.totalProcessed).toBe(87);
      expect(results.workerConfigErrors).toBe(0); // NO worker configuration errors
      
      // All failures should be PDF structure related, not worker related
      results.failed.forEach((failure) => {
        expect(failure.isWorkerError).toBe(false);
      });

      console.log(`Bulk upload simulation: ${results.successful.length}/${results.totalProcessed} succeeded, 0 worker errors`);
    }, 90000);

    test('should handle memory usage patterns from production bulk uploads', async () => {
      // Test memory management during bulk processing
      const initialMemory = process.memoryUsage().heapUsed;
      
      const files = Array.from({ length: 20 }, (_, i) => 
        Buffer.from(`%PDF-1.4\nMemory test file ${i}\n%%EOF`)
      );

      let peakMemory = initialMemory;
      const results = [];

      for (const buffer of files) {
        try {
          await extractTextFromPdf(buffer);
          results.push({ success: true });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error.message,
            isWorkerError: error.message.includes('GlobalWorkerOptions')
          });
        }

        // Track memory usage
        const currentMemory = process.memoryUsage().heapUsed;
        peakMemory = Math.max(peakMemory, currentMemory);
        
        // Force garbage collection between files if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not have excessive memory growth
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB increase

      // No worker configuration errors during memory-intensive processing
      const workerErrors = results.filter(r => !r.success && r.isWorkerError);
      expect(workerErrors).toHaveLength(0);
    });
  });

  describe('Production Environment Simulation', () => {
    
    test('should work in Node.js production environment constraints', async () => {
      // Simulate production environment constraints
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const testBuffer = Buffer.from('%PDF-1.4\nProduction test\n%%EOF');
        
        try {
          await extractTextFromPdf(testBuffer);
        } catch (error) {
          // Should not fail due to worker configuration in production
          expect(error.message).not.toContain('GlobalWorkerOptions');
          expect(error.message).not.toContain('worker');
        }
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    test('should handle server-side processing without browser APIs', async () => {
      // Ensure we're not relying on browser-specific APIs
      const browserAPIs = ['window', 'document', 'navigator', 'Worker'];
      
      browserAPIs.forEach(api => {
        expect(typeof global[api]).toBe('undefined');
      });

      const testBuffer = Buffer.from('%PDF-1.4\nServer test\n%%EOF');
      
      try {
        await extractTextFromPdf(testBuffer);
      } catch (error) {
        // Should work in server environment without browser APIs
        expect(error.message).not.toContain('window is not defined');
        expect(error.message).not.toContain('document is not defined');
        expect(error.message).not.toContain('Worker is not defined');
      }
    });

    test('should handle concurrent requests like production load', async () => {
      // Simulate concurrent PDF processing requests
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, (_, i) => {
        const buffer = Buffer.from(`%PDF-1.4\nConcurrent request ${i}\n%%EOF`);
        
        return extractTextFromPdf(buffer).catch(error => ({
          requestId: i,
          error: error.message,
          isWorkerError: error.message.includes('GlobalWorkerOptions') || 
                        error.message.includes('fake worker')
        }));
      });

      const results = await Promise.allSettled(promises);
      
      // All requests should complete
      expect(results).toHaveLength(concurrentRequests);
      
      // Check for worker configuration errors in concurrent scenario
      const workerErrors = results
        .filter(r => r.status === 'fulfilled' && r.value && r.value.isWorkerError)
        .length;
      
      expect(workerErrors).toBe(0);
    });
  });

  describe('Specific File Size Edge Cases from Production', () => {
    
    test('should handle 611KB DOCX file that caused "too many function arguments"', async () => {
      // Create a large buffer similar to the 611KB DOCX mentioned
      const largeDocxSize = 611 * 1024; // 611KB
      const largeBuffer = Buffer.alloc(largeDocxSize);
      
      // Add DOCX structure
      largeBuffer.write('PK\x03\x04', 0); // ZIP header for DOCX
      
      try {
        await extractTextFromDocument(largeBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } catch (error) {
        // Should not cause "too many function arguments" error
        expect(error.message).not.toContain('too many function arguments');
        expect(error.message).not.toContain('Maximum call stack size');
      }
    });

    test('should handle various PDF file sizes from production logs', async () => {
      // Based on the production logs, test various file sizes
      const fileSizes = [
        130868, // AdelEddin_Technical_Resume_Detailed[96].pdf
        151406, // MARIELA_ROSALES_RESUME pdf.pdf  
        348769, // CHRISTIAN FOTACHWI Resume (1).pdf
        404728, // Naimisha Kunta Resume1 (3).pdf
        181320  // Epic - Resume.pdf
      ];

      for (const size of fileSizes) {
        const buffer = Buffer.alloc(size);
        buffer.write('%PDF-1.4\n', 0);
        buffer.write('%%EOF', size - 5);

        try {
          await extractTextFromPdf(buffer);
        } catch (error) {
          // Should not fail due to worker configuration
          expect(error.message).not.toContain('GlobalWorkerOptions.workerSrc');
          expect(error.message).not.toContain('Setting up fake worker failed');
        }
      }
    });
  });
});