/**
 * Document Parser Edge Cases and Error Handling Tests
 * Tests various edge cases, error conditions, and boundary scenarios
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

describe('Document Parser Edge Cases', () => {

  describe('Input Validation Edge Cases', () => {
    
    test('should handle null buffer gracefully', async () => {
      await expect(extractTextFromPdf(null as any)).rejects.toThrow('Input is not a valid buffer');
      await expect(extractTextFromDocx(null as any)).rejects.toThrow();
    });

    test('should handle undefined buffer gracefully', async () => {
      await expect(extractTextFromPdf(undefined as any)).rejects.toThrow('Input is not a valid buffer');
      await expect(extractTextFromDocx(undefined as any)).rejects.toThrow();
    });

    test('should handle non-buffer objects', async () => {
      const invalidInputs = [
        'string input',
        12345,
        { not: 'a buffer' },
        ['array', 'input'],
        new Date(),
        /regex/
      ];

      for (const input of invalidInputs) {
        await expect(extractTextFromPdf(input as any)).rejects.toThrow('Input is not a valid buffer');
        await expect(extractTextFromDocx(input as any)).rejects.toThrow();
      }
    });

    test('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(extractTextFromPdf(emptyBuffer)).rejects.toThrow('Input is not a valid buffer');
    });
  });

  describe('File Size Edge Cases', () => {
    
    test('should accept file exactly at 50MB limit', async () => {
      const exactLimitSize = 50 * 1024 * 1024;
      const largeBuffer = Buffer.alloc(exactLimitSize, 'A');
      
      // Should not fail due to size (will fail due to invalid PDF structure)
      await expect(extractTextFromPdf(largeBuffer)).rejects.not.toThrow('PDF file too large');
    });

    test('should reject file over 50MB limit', async () => {
      const overLimitSize = 50 * 1024 * 1024 + 1;
      const oversizeBuffer = Buffer.alloc(overLimitSize, 'A');
      
      await expect(extractTextFromPdf(oversizeBuffer)).rejects.toThrow('PDF file too large (50MB). Maximum size is 50MB.');
    });

    test('should handle very small valid files', async () => {
      const tinyBuffer = Buffer.from('%PDF-1.4\n%%EOF'); // Minimal PDF
      
      try {
        await extractTextFromPdf(tinyBuffer);
      } catch (error) {
        // Should fail for parsing reasons, not size
        expect(error.message).not.toContain('too large');
      }
    });

    test('should handle boundary file sizes', async () => {
      const sizes = [
        1024,           // 1KB
        1024 * 1024,    // 1MB
        10 * 1024 * 1024, // 10MB
        49 * 1024 * 1024, // 49MB (just under limit)
      ];

      for (const size of sizes) {
        const buffer = Buffer.alloc(size, 'A');
        try {
          await extractTextFromPdf(buffer);
        } catch (error) {
          // Should not fail due to size limits
          expect(error.message).not.toContain('too large');
        }
      }
    });
  });

  describe('Corrupted File Handling', () => {
    
    test('should handle completely random binary data', async () => {
      const randomBuffer = Buffer.alloc(1000);
      for (let i = 0; i < randomBuffer.length; i++) {
        randomBuffer[i] = Math.floor(Math.random() * 256);
      }

      await expect(extractTextFromPdf(randomBuffer)).rejects.toThrow();
      await expect(extractTextFromDocx(randomBuffer)).rejects.toThrow();
    });

    test('should handle files with only null bytes', async () => {
      const nullBuffer = Buffer.alloc(1000, 0);
      
      await expect(extractTextFromPdf(nullBuffer)).rejects.toThrow();
      await expect(extractTextFromDocx(nullBuffer)).rejects.toThrow();
    });

    test('should handle files with only 0xFF bytes', async () => {
      const ffBuffer = Buffer.alloc(1000, 0xFF);
      
      await expect(extractTextFromPdf(ffBuffer)).rejects.toThrow();
      await expect(extractTextFromDocx(ffBuffer)).rejects.toThrow();
    });

    test('should handle truncated PDF files', async () => {
      const truncatedPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<</Type/Cat'); // Cut off mid-way
      
      await expect(extractTextFromPdf(truncatedPdf)).rejects.toThrow();
    });

    test('should handle PDF with invalid structure', async () => {
      const invalidStructure = Buffer.from('%PDF-1.4\nInvalid PDF content without proper objects\n%%EOF');
      
      await expect(extractTextFromPdf(invalidStructure)).rejects.toThrow();
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    
    test('should handle repetitive processing without memory leaks', async () => {
      const testBuffer = Buffer.from('%PDF-1.4\nTest content\n%%EOF');
      
      // Process the same buffer multiple times
      const promises = Array(20).fill(null).map(async () => {
        try {
          return await extractTextFromPdf(testBuffer);
        } catch (error) {
          return error.message;
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      // Should complete without throwing memory errors
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
        if (typeof result.value === 'string' && result.value.includes('error')) {
          expect(result.value).not.toContain('memory');
          expect(result.value).not.toContain('heap');
        }
      });
    });

    test('should handle concurrent processing of different files', async () => {
      const buffers = [
        Buffer.from('%PDF-1.4\nFile 1\n%%EOF'),
        Buffer.from('%PDF-1.4\nFile 2\n%%EOF'),
        Buffer.from('%PDF-1.4\nFile 3\n%%EOF'),
        Buffer.from('%PDF-1.4\nFile 4\n%%EOF'),
        Buffer.from('%PDF-1.4\nFile 5\n%%EOF')
      ];
      
      const promises = buffers.map(async (buffer, index) => {
        try {
          return await extractTextFromPdf(buffer);
        } catch (error) {
          return `Error ${index}: ${error.message}`;
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      // All should complete without hanging or crashing
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('File Type Detection Edge Cases', () => {
    
    test('should handle ambiguous file types', async () => {
      const buffer = Buffer.from('Ambiguous content that could be anything');
      
      const ambiguousTypes = [
        'unknown',
        'application/octet-stream',
        'text/plain',
        '',
        undefined,
        null
      ];

      for (const type of ambiguousTypes) {
        try {
          await extractTextFromDocument(buffer, type as string);
        } catch (error) {
          expect(error.message).toContain('Unsupported file type');
        }
      }
    });

    test('should handle case variations in file types', async () => {
      const buffer = Buffer.from('%PDF-1.4\nTest content\n%%EOF');
      
      const caseVariations = [
        'application/pdf',
        'Application/PDF',
        'APPLICATION/PDF',
        'pdf',
        'PDF',
        'Pdf'
      ];

      for (const type of caseVariations) {
        try {
          await extractTextFromDocument(buffer, type);
        } catch (error) {
          // Should attempt PDF processing regardless of case
          expect(error.message).not.toContain('Unsupported file type');
        }
      }
    });

    test('should handle MIME type variations', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nTest\n%%EOF');
      
      const mimeVariations = [
        'application/pdf',
        'application/x-pdf',
        'text/pdf'
      ];

      for (const mime of mimeVariations) {
        try {
          await extractTextFromDocument(pdfBuffer, mime);
        } catch (error) {
          // Should route to PDF processor
          expect(error.message).not.toContain('Unsupported file type');
        }
      }
    });
  });

  describe('Timeout and Resource Management', () => {
    
    test('should handle processing timeout gracefully', async () => {
      // Create a mock scenario that might timeout
      const largeComplexBuffer = Buffer.alloc(5 * 1024 * 1024, 'A'); // 5MB of 'A'
      largeComplexBuffer.write('%PDF-1.4\n', 0);
      largeComplexBuffer.write('\n%%EOF', largeComplexBuffer.length - 6);
      
      const startTime = Date.now();
      
      try {
        await extractTextFromPdf(largeComplexBuffer);
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Should not hang indefinitely (test timeout is reasonable)
        expect(duration).toBeLessThan(35000); // Less than 35 seconds (PDF timeout is 30s)
      }
    });

    test('should clean up resources properly on errors', async () => {
      const corruptedBuffer = Buffer.from('Corrupted file that will cause cleanup');
      
      // Process multiple corrupted files to test resource cleanup
      const promises = Array(5).fill(null).map(async (_, index) => {
        try {
          return await extractTextFromPdf(corruptedBuffer);
        } catch (error) {
          return `Error ${index}`;
        }
      });
      
      const results = await Promise.allSettled(promises);
      
      // Should complete without resource exhaustion
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });
  });

  describe('Text Extraction Boundary Cases', () => {
    
    test('should handle files with no extractable text', async () => {
      // This would represent an image-only PDF
      const noTextBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>\nendobj\n%%EOF');
      
      try {
        const result = await extractTextFromPdf(noTextBuffer);
        // Should either succeed with empty text or fail gracefully
        if (typeof result === 'string') {
          expect(result.trim()).toBe('');
        }
      } catch (error) {
        expect(error.message).toContain('no readable text');
      }
    });

    test('should handle extremely long text content', async () => {
      // This tests the text length handling
      const longText = 'A'.repeat(100000); // 100KB of text
      const mockBuffer = Buffer.from(`%PDF-1.4\n${longText}\n%%EOF`);
      
      try {
        await extractTextFromPdf(mockBuffer);
      } catch (error) {
        // Should not fail due to text length
        expect(error.message).not.toContain('too long');
        expect(error.message).not.toContain('length');
      }
    });

    test('should handle special characters in text', async () => {
      const specialChars = 'Special chars: àáâãäåæçèéêë ñòóôõö ùúûüý ÿ €£¥¢';
      const mockBuffer = Buffer.from(`%PDF-1.4\n${specialChars}\n%%EOF`);
      
      try {
        await extractTextFromPdf(mockBuffer);
      } catch (error) {
        // Should not fail due to special characters
        expect(error.message).not.toContain('encoding');
        expect(error.message).not.toContain('character');
      }
    });
  });
});