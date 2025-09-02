/**
 * Comprehensive test suite for Profile Document Parser
 * Covers all edge cases, memory management, and error scenarios
 */

import { jest } from '@jest/globals';
import { 
  extractTextFromPdfProfile, 
  extractTextFromDocxProfile, 
  extractTextFromTxtProfile,
  extractTextFromDocumentProfile,
  healthCheckProfileParser 
} from '../server/profile-document-parser';

// Mock external dependencies
jest.mock('pdf-parse');
jest.mock('mammoth');

describe('Profile Document Parser - Comprehensive Test Suite', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console methods to avoid noise in tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Buffer Validation', () => {
    
    test('should reject null buffer', async () => {
      await expect(extractTextFromPdfProfile(null as any))
        .rejects.toThrow('Input is not a valid buffer');
    });

    test('should reject undefined buffer', async () => {
      await expect(extractTextFromPdfProfile(undefined as any))
        .rejects.toThrow('Input is not a valid buffer');
    });

    test('should reject non-buffer input', async () => {
      await expect(extractTextFromPdfProfile('not a buffer' as any))
        .rejects.toThrow('Input is not a valid buffer');
    });

    test('should reject empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(extractTextFromPdfProfile(emptyBuffer))
        .rejects.toThrow('Input is not a valid buffer');
    });

    test('should reject oversized files', async () => {
      const oversizeBuffer = Buffer.alloc(51 * 1024 * 1024, 'A'); // 51MB
      await expect(extractTextFromPdfProfile(oversizeBuffer))
        .rejects.toThrow('PDF file too large (51MB). Maximum size is 50MB.');
    });

    test('should accept exactly 50MB file size', async () => {
      const exactLimitBuffer = Buffer.alloc(50 * 1024 * 1024, 'A');
      
      // Mock pdf-parse to avoid actual parsing of invalid PDF
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'Test content' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      // Should not throw file size error (but will fail due to invalid PDF structure)
      await expect(extractTextFromPdfProfile(exactLimitBuffer))
        .rejects.not.toThrow('PDF file too large');
    });

  });

  describe('PDF Processing', () => {
    
    test('should successfully extract text from valid PDF', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.4\nsome content');
      
      const mockPdfParse = jest.fn().mockResolvedValue({
        text: 'Extracted PDF content with skills and experience',
        numpages: 2,
        info: { Producer: 'Test Producer' }
      });
      
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromPdfProfile(validPdfBuffer);
      
      expect(result).toBe('Extracted PDF content with skills and experience');
      expect(mockPdfParse).toHaveBeenCalledWith(
        validPdfBuffer,
        expect.objectContaining({
          max: 100,
          version: 'v1.10.1',
          normalizeWhitespace: true,
          disableCombineTextItems: false
        })
      );
    });

    test('should handle PDF without valid signature', async () => {
      const invalidSignatureBuffer = Buffer.from('INVALID-PDF-HEADER\ncontent');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'Valid content despite invalid signature' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromPdfProfile(invalidSignatureBuffer);
      expect(result).toBe('Valid content despite invalid signature');
    });

    test('should handle password-protected PDFs', async () => {
      const protectedPdfBuffer = Buffer.from('%PDF-1.4\nprotected content');
      
      const mockPdfParse = jest.fn().mockRejectedValue(new Error('Password required'));
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      await expect(extractTextFromPdfProfile(protectedPdfBuffer))
        .rejects.toThrow('PDF is password-protected and cannot be processed');
    });

    test('should handle parsing timeout', async () => {
      const timeoutPdfBuffer = Buffer.from('%PDF-1.4\nslow content');
      
      const mockPdfParse = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 25000)) // Longer than 20s timeout
      );
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      await expect(extractTextFromPdfProfile(timeoutPdfBuffer))
        .rejects.toThrow('PDF processing timed out - file may be too complex or corrupted');
    });

    test('should handle PDF with no text content', async () => {
      const noTextPdfBuffer = Buffer.from('%PDF-1.4\nno text');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: '' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      await expect(extractTextFromPdfProfile(noTextPdfBuffer))
        .rejects.toThrow('No readable text found in PDF');
    });

    test('should handle pdf-parse module loading failure', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ncontent');
      
      jest.doMock('pdf-parse', () => {
        throw new Error('Module not found');
      });
      
      await expect(extractTextFromPdfProfile(pdfBuffer))
        .rejects.toThrow('Failed to load PDF parser: Module not found');
    });

    test('should handle corrupted PDF gracefully', async () => {
      const corruptedPdfBuffer = Buffer.from('%PDF-1.4\ncorrupted data');
      
      const mockPdfParse = jest.fn().mockRejectedValue(new Error('Invalid PDF structure'));
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      await expect(extractTextFromPdfProfile(corruptedPdfBuffer))
        .rejects.toThrow('PDF parsing failed: Invalid PDF structure');
    });

    test('should normalize extracted text properly', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ncontent');
      
      const textWithControlChars = 'Text\u0000with\rcontrol\nchars  and   spaces';
      const expectedNormalized = 'Text with control chars and spaces';
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: textWithControlChars });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromPdfProfile(pdfBuffer);
      expect(result).toBe(expectedNormalized);
    });

  });

  describe('DOCX Processing', () => {
    
    test('should successfully extract text from DOCX', async () => {
      const docxBuffer = Buffer.from('DOCX content');
      
      const mockMammoth = {
        extractRawText: jest.fn().mockResolvedValue({ value: 'DOCX extracted content' })
      };
      jest.doMock('mammoth', () => mockMammoth);
      
      const result = await extractTextFromDocxProfile(docxBuffer);
      
      expect(result).toBe('DOCX extracted content');
      expect(mockMammoth.extractRawText).toHaveBeenCalledWith({ buffer: docxBuffer });
    });

    test('should handle DOCX extraction timeout', async () => {
      const docxBuffer = Buffer.from('DOCX content');
      
      const mockMammoth = {
        extractRawText: jest.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(resolve, 20000)) // Longer than 15s timeout
        )
      };
      jest.doMock('mammoth', () => mockMammoth);
      
      await expect(extractTextFromDocxProfile(docxBuffer))
        .rejects.toThrow('DOCX extraction timed out');
    });

    test('should handle empty DOCX content', async () => {
      const docxBuffer = Buffer.from('DOCX content');
      
      const mockMammoth = {
        extractRawText: jest.fn().mockResolvedValue({ value: '' })
      };
      jest.doMock('mammoth', () => mockMammoth);
      
      await expect(extractTextFromDocxProfile(docxBuffer))
        .rejects.toThrow('No readable text found in DOCX document');
    });

    test('should handle DOCX processing errors', async () => {
      const docxBuffer = Buffer.from('DOCX content');
      
      const mockMammoth = {
        extractRawText: jest.fn().mockRejectedValue(new Error('Corrupted DOCX'))
      };
      jest.doMock('mammoth', () => mockMammoth);
      
      await expect(extractTextFromDocxProfile(docxBuffer))
        .rejects.toThrow('DOCX parsing failed: Corrupted DOCX');
    });

  });

  describe('TXT Processing', () => {
    
    test('should successfully extract text from TXT', () => {
      const txtBuffer = Buffer.from('Plain text content');
      
      const result = extractTextFromTxtProfile(txtBuffer);
      expect(result).toBe('Plain text content');
    });

    test('should handle empty TXT file', () => {
      const emptyTxtBuffer = Buffer.from('');
      
      expect(() => extractTextFromTxtProfile(emptyTxtBuffer))
        .toThrow('Input is not a valid buffer');
    });

    test('should handle TXT with only whitespace', () => {
      const whitespaceTxtBuffer = Buffer.from('   \n\t   ');
      
      expect(() => extractTextFromTxtProfile(whitespaceTxtBuffer))
        .toThrow('Text file is empty');
    });

  });

  describe('Document Type Detection', () => {
    
    test('should route PDF files correctly by extension', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ncontent');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'PDF content' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromDocumentProfile(pdfBuffer, 'document.pdf');
      expect(result).toBe('PDF content');
    });

    test('should route DOCX files correctly by MIME type', async () => {
      const docxBuffer = Buffer.from('DOCX content');
      
      const mockMammoth = {
        extractRawText: jest.fn().mockResolvedValue({ value: 'DOCX content' })
      };
      jest.doMock('mammoth', () => mockMammoth);
      
      const result = await extractTextFromDocumentProfile(
        docxBuffer, 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      expect(result).toBe('DOCX content');
    });

    test('should route TXT files correctly', async () => {
      const txtBuffer = Buffer.from('Text content');
      
      const result = await extractTextFromDocumentProfile(txtBuffer, 'text/plain');
      expect(result).toBe('Text content');
    });

    test('should reject unsupported file types', async () => {
      const buffer = Buffer.from('content');
      
      await expect(extractTextFromDocumentProfile(buffer, 'image/jpeg'))
        .rejects.toThrow('Unsupported file type: image/jpeg');
    });

    test('should reject unsupported file extensions', async () => {
      const buffer = Buffer.from('content');
      
      await expect(extractTextFromDocumentProfile(buffer, 'document.xlsx'))
        .rejects.toThrow('Unsupported file extension: xlsx');
    });

  });

  describe('Memory Management & Performance', () => {
    
    test('should handle high memory usage scenarios', async () => {
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'A'); // 10MB
      
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600MB - above threshold
        heapTotal: 800 * 1024 * 1024
      });
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'Large file content' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromPdfProfile(largeBuffer);
      expect(result).toBe('Large file content');
      
      // Restore original function
      process.memoryUsage = originalMemoryUsage;
    });

    test('should handle very short extracted text with warning', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ncontent');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'Short' }); // Only 5 chars
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromPdfProfile(pdfBuffer);
      expect(result).toBe('Short');
    });

  });

  describe('Health Check', () => {
    
    test('should pass health check with valid input', async () => {
      const isHealthy = await healthCheckProfileParser();
      expect(isHealthy).toBe(true);
    });

    test('should fail health check with invalid implementation', async () => {
      // Mock a failing text processor
      const originalExtractTextFromTxtProfile = extractTextFromTxtProfile;
      jest.doMock('../server/profile-document-parser', () => ({
        ...jest.requireActual('../server/profile-document-parser'),
        extractTextFromTxtProfile: jest.fn().mockImplementation(() => {
          throw new Error('Text processor failed');
        })
      }));
      
      const isHealthy = await healthCheckProfileParser();
      expect(isHealthy).toBe(false);
    });

  });

  describe('Error Message Quality', () => {
    
    test('should provide user-friendly error for encrypted PDFs', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nencrypted');
      
      const mockPdfParse = jest.fn().mockRejectedValue(new Error('Password required for encrypted document'));
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      await expect(extractTextFromPdfProfile(pdfBuffer))
        .rejects.toThrow('PDF is password-protected and cannot be processed');
    });

    test('should provide guidance for invalid files', async () => {
      const invalidBuffer = Buffer.from('not a pdf');
      
      const mockPdfParse = jest.fn().mockRejectedValue(new Error('Invalid file format'));
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      await expect(extractTextFromPdfProfile(invalidBuffer))
        .rejects.toThrow('Please ensure the file is a valid, unprotected PDF document');
    });

  });

  describe('Edge Cases & Stress Tests', () => {
    
    test('should handle PDF with exactly 100 pages (limit)', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\nmany pages');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ 
        text: 'Content from 100 pages',
        numpages: 100 
      });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const result = await extractTextFromPdfProfile(pdfBuffer);
      expect(result).toBe('Content from 100 pages');
      
      expect(mockPdfParse).toHaveBeenCalledWith(
        pdfBuffer,
        expect.objectContaining({ max: 100 })
      );
    });

    test('should handle multiple consecutive processing calls', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\ncontent');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'Batch content' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      // Process multiple files in sequence (simulating bulk upload)
      const promises = Array(5).fill(null).map(() => 
        extractTextFromPdfProfile(pdfBuffer)
      );
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      expect(results.every(r => r === 'Batch content')).toBe(true);
    });

    test('should handle mixed file types in sequence', async () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\npdf content');
      const txtBuffer = Buffer.from('txt content');
      
      const mockPdfParse = jest.fn().mockResolvedValue({ text: 'PDF processed' });
      jest.doMock('pdf-parse', () => ({ default: mockPdfParse }));
      
      const pdfResult = await extractTextFromDocumentProfile(pdfBuffer, 'file.pdf');
      const txtResult = await extractTextFromDocumentProfile(txtBuffer, 'file.txt');
      
      expect(pdfResult).toBe('PDF processed');
      expect(txtResult).toBe('txt content');
    });

  });

});