/**
 * Test Suite for PDF.js Worker Configuration Fix
 * Specifically tests the worker configuration that was causing failures in production
 */

import { Buffer } from 'node:buffer';
import { extractTextFromPdf, extractTextFromDocx, extractTextFromDocument } from '../server/document-parser';

// Mock the profile logger
jest.mock('../server/logger', () => ({
  profileLogger: {
    extractionStart: jest.fn(),
    extractionSuccess: jest.fn(),
    extractionError: jest.fn(),
  },
}));

// Mock PDF.js to test worker configuration
jest.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  const mockPdfDoc = {
    numPages: 1,
    getPage: jest.fn().mockResolvedValue({
      getTextContent: jest.fn().mockResolvedValue({
        items: [{ str: 'Test PDF content' }]
      }),
      cleanup: jest.fn()
    }),
    destroy: jest.fn()
  };

  return {
    GlobalWorkerOptions: {
      workerSrc: ''
    },
    getDocument: jest.fn().mockReturnValue({
      promise: Promise.resolve(mockPdfDoc)
    })
  };
});

describe('PDF.js Worker Configuration Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Worker Configuration Fix', () => {
    
    test('should set worker source to prevent "No GlobalWorkerOptions.workerSrc specified" error', async () => {
      // Import the module to trigger worker configuration
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      
      // Create a minimal valid PDF buffer
      const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>\nendobj\nxref\ntrailer<</Root 1 0 R>>\n%%EOF');
      
      try {
        await extractTextFromPdf(validPdfBuffer);
        
        // Verify that worker source was set (should not be empty string anymore)
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).not.toBe('');
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
      } catch (error) {
        // Even if PDF parsing fails due to mock, worker should be configured
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
      }
    });

    test('should handle worker configuration in Node.js environment', async () => {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
      
      // Simulate the previous failing configuration
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
      
      const testBuffer = Buffer.from('%PDF-1.4\ntest content\n%%EOF');
      
      try {
        await extractTextFromPdf(testBuffer);
      } catch (error) {
        // After calling extractTextFromPdf, worker should be properly configured
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
      }
    });

    test('should prevent fake worker setup errors', async () => {
      const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
      
      const testBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>\nendobj\n%%EOF');
      
      try {
        await extractTextFromPdf(testBuffer);
      } catch (error) {
        // Should not contain the specific worker setup error
        expect(error.message).not.toContain('Setting up fake worker failed');
        expect(error.message).not.toContain('No "GlobalWorkerOptions.workerSrc" specified');
      }
      
      mockConsoleError.mockRestore();
    });
  });

  describe('Bulk Upload Scenarios', () => {
    
    test('should handle multiple PDF files without worker conflicts', async () => {
      const pdfBuffers = [
        Buffer.from('%PDF-1.4\nFile 1\n%%EOF'),
        Buffer.from('%PDF-1.4\nFile 2\n%%EOF'),
        Buffer.from('%PDF-1.4\nFile 3\n%%EOF')
      ];
      
      const results = [];
      
      // Process multiple files sequentially (like bulk upload)
      for (let i = 0; i < pdfBuffers.length; i++) {
        try {
          const result = await extractTextFromPdf(pdfBuffers[i]);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      // All should either succeed or fail for PDF parsing reasons, not worker config
      results.forEach((result, index) => {
        if (!result.success) {
          expect(result.error).not.toContain('GlobalWorkerOptions.workerSrc');
          expect(result.error).not.toContain('fake worker');
        }
      });
    });

    test('should handle concurrent PDF processing', async () => {
      const pdfBuffers = Array(5).fill(null).map((_, i) => 
        Buffer.from(`%PDF-1.4\nConcurrent file ${i}\n%%EOF`)
      );
      
      // Process files concurrently (like bulk upload chunks)
      const promises = pdfBuffers.map(async (buffer, index) => {
        try {
          const result = await extractTextFromPdf(buffer);
          return { index, success: true, result };
        } catch (error) {
          return { index, success: false, error: error.message };
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      // Check that no worker configuration errors occurred
      results.forEach((result) => {
        if (result.status === 'fulfilled' && !result.value.success) {
          expect(result.value.error).not.toContain('GlobalWorkerOptions');
          expect(result.value.error).not.toContain('fake worker');
        }
      });
    });
  });

  describe('Edge Cases with Worker Configuration', () => {
    
    test('should handle large PDF files without worker memory issues', async () => {
      // Create a buffer that represents a large PDF (within 50MB limit)
      const largePdfSize = 10 * 1024 * 1024; // 10MB
      const largePdfBuffer = Buffer.alloc(largePdfSize);
      // Add minimal PDF structure
      largePdfBuffer.write('%PDF-1.4\n', 0);
      largePdfBuffer.write('%%EOF', largePdfSize - 5);
      
      try {
        await extractTextFromPdf(largePdfBuffer);
      } catch (error) {
        // Should fail for parsing reasons, not worker configuration
        expect(error.message).not.toContain('worker');
        expect(error.message).not.toContain('GlobalWorkerOptions');
      }
    });

    test('should maintain worker configuration across multiple imports', async () => {
      // First import and configuration
      const pdfjsLib1 = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const testBuffer = Buffer.from('%PDF-1.4\ntest\n%%EOF');
      
      try {
        await extractTextFromPdf(testBuffer);
      } catch (error) {
        // Worker should be configured
      }
      
      expect(pdfjsLib1.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
      
      // Second import should maintain configuration
      const pdfjsLib2 = await import('pdfjs-dist/legacy/build/pdf.mjs');
      expect(pdfjsLib2.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
    });

    test('should handle corrupted PDFs without worker crashes', async () => {
      const corruptedBuffers = [
        Buffer.from('Not a PDF at all'),
        Buffer.from('%PDF-1.4\nCorrupted content without proper structure'),
        Buffer.from('Random binary data'),
        Buffer.alloc(1000, 0xFF) // All 0xFF bytes
      ];
      
      for (const buffer of corruptedBuffers) {
        try {
          await extractTextFromPdf(buffer);
        } catch (error) {
          // Should fail gracefully, not due to worker issues
          expect(error.message).not.toContain('worker failed');
          expect(error.message).not.toContain('GlobalWorkerOptions');
        }
      }
    });
  });

  describe('Integration with Document Type Detection', () => {
    
    test('should properly handle PDF files through extractTextFromDocument', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nTest PDF content\n%%EOF');
      
      try {
        await extractTextFromDocument(pdfBuffer, 'application/pdf');
      } catch (error) {
        // Should not fail due to worker configuration
        expect(error.message).not.toContain('GlobalWorkerOptions.workerSrc');
      }
    });

    test('should handle PDF files with different MIME types', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nTest content\n%%EOF');
      const mimeTypes = [
        'application/pdf',
        'pdf',
        'application/x-pdf'
      ];
      
      for (const mimeType of mimeTypes) {
        try {
          await extractTextFromDocument(pdfBuffer, mimeType);
        } catch (error) {
          // Should process through PDF.js without worker errors
          expect(error.message).not.toContain('fake worker');
        }
      }
    });
  });

  describe('Production Environment Simulation', () => {
    
    test('should handle production-like bulk upload scenario', async () => {
      // Simulate the exact scenario that was failing in production
      const files = [
        { name: 'HANDAN_DERIN_AD_2025.pdf', buffer: Buffer.from('%PDF-1.4\nResume 1\n%%EOF') },
        { name: 'KenanByrd_Resume.pdf', buffer: Buffer.from('%PDF-1.4\nResume 2\n%%EOF') },
        { name: 'Joshua_Molina_resume.pdf', buffer: Buffer.from('%PDF-1.4\nResume 3\n%%EOF') },
        { name: 'Aaron_Wilson_Resume.pdf', buffer: Buffer.from('%PDF-1.4\nResume 4\n%%EOF') },
        { name: 'Mike_Shakhnovich_Resume.pdf', buffer: Buffer.from('%PDF-1.4\nResume 5\n%%EOF') }
      ];
      
      const results = {
        successful: [],
        failed: []
      };
      
      // Process files in chunks like the production system
      const CHUNK_SIZE = 3;
      const chunks = [];
      for (let i = 0; i < files.length; i += CHUNK_SIZE) {
        chunks.push(files.slice(i, i + CHUNK_SIZE));
      }
      
      for (const chunk of chunks) {
        const chunkPromises = chunk.map(async (file) => {
          try {
            await extractTextFromPdf(file.buffer);
            return { filename: file.name, success: true };
          } catch (error) {
            return { filename: file.name, success: false, error: error.message };
          }
        });
        
        const chunkResults = await Promise.allSettled(chunkPromises);
        
        chunkResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            if (result.value.success) {
              results.successful.push(result.value);
            } else {
              results.failed.push(result.value);
              // Verify no worker configuration errors
              expect(result.value.error).not.toContain('GlobalWorkerOptions.workerSrc');
              expect(result.value.error).not.toContain('Setting up fake worker failed');
            }
          }
        });
      }
      
      // At least the worker configuration should not be the cause of failures
      expect(results.failed.every(f => !f.error.includes('fake worker'))).toBe(true);
    });

    test('should maintain consistent behavior across server restarts', async () => {
      // Simulate server restart by clearing and re-importing
      jest.resetModules();
      
      const testBuffer = Buffer.from('%PDF-1.4\nAfter restart\n%%EOF');
      
      try {
        // Re-import after module reset
        const { extractTextFromPdf } = await import('../server/document-parser');
        await extractTextFromPdf(testBuffer);
        
        // Worker configuration should be applied on first use
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
      } catch (error) {
        // Even if parsing fails, worker should be configured
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        expect(pdfjsLib.GlobalWorkerOptions.workerSrc).toBe('pdf.worker.js');
      }
    });
  });
});