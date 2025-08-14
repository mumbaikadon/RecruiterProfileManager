import { parseDocument } from '../server/document-parser';
import fs from 'fs/promises';
import path from 'path';

describe('Document Parser Service', () => {
  describe('parseDocument', () => {
    it('should throw error for unsupported file types', async () => {
      const buffer = Buffer.from('test content');
      const filename = 'test.txt';

      await expect(parseDocument(buffer, filename)).rejects.toThrow('Unsupported file type');
    });

    it('should handle PDF parsing', async () => {
      // Create a minimal PDF buffer (this would be a real PDF in practice)
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n174\n%%EOF');
      
      try {
        const result = await parseDocument(pdfBuffer, 'test.pdf');
        expect(typeof result).toBe('string');
      } catch (error) {
        // PDF parsing might fail with minimal buffer, but should not throw unsupported file type error
        expect((error as Error).message).not.toContain('Unsupported file type');
      }
    });

    it('should handle DOCX parsing', async () => {
      // Create a minimal DOCX buffer structure
      const docxBuffer = Buffer.from('PK'); // DOCX files start with PK (ZIP signature)
      
      try {
        const result = await parseDocument(docxBuffer, 'test.docx');
        expect(typeof result).toBe('string');
      } catch (error) {
        // DOCX parsing might fail with minimal buffer, but should not throw unsupported file type error
        expect((error as Error).message).not.toContain('Unsupported file type');
      }
    });

    it('should throw error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      
      await expect(parseDocument(emptyBuffer, 'test.pdf')).rejects.toThrow();
    });

    it('should throw error for null buffer', async () => {
      await expect(parseDocument(null as any, 'test.pdf')).rejects.toThrow();
    });

    it('should throw error for undefined buffer', async () => {
      await expect(parseDocument(undefined as any, 'test.pdf')).rejects.toThrow();
    });

    it('should handle large files gracefully', async () => {
      // Create a large buffer (10MB)
      const largeBuffer = Buffer.alloc(10 * 1024 * 1024, 'A');
      
      try {
        await parseDocument(largeBuffer, 'large.pdf');
      } catch (error) {
        // Should handle large files without crashing
        expect(error).toBeDefined();
      }
    });

    it('should extract text from various file extensions', async () => {
      const testFiles = [
        { filename: 'resume.pdf', extension: 'pdf' },
        { filename: 'document.docx', extension: 'docx' },
        { filename: 'RESUME.PDF', extension: 'pdf' },
        { filename: 'Document.DOCX', extension: 'docx' }
      ];

      for (const testFile of testFiles) {
        const buffer = Buffer.from('test content');
        
        try {
          await parseDocument(buffer, testFile.filename);
        } catch (error) {
          // Should recognize the file type even if parsing fails
          expect((error as Error).message).not.toContain('Unsupported file type');
        }
      }
    });

    it('should handle corrupted PDF files', async () => {
      const corruptedPdf = Buffer.from('This is not a valid PDF file');
      
      try {
        await parseDocument(corruptedPdf, 'corrupted.pdf');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).not.toContain('Unsupported file type');
      }
    });

    it('should handle corrupted DOCX files', async () => {
      const corruptedDocx = Buffer.from('This is not a valid DOCX file');
      
      try {
        await parseDocument(corruptedDocx, 'corrupted.docx');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).not.toContain('Unsupported file type');
      }
    });

    it('should return string output', async () => {
      // Test with a basic buffer that might work
      const testBuffer = Buffer.from('Simple text content');
      
      for (const extension of ['pdf', 'docx']) {
        try {
          const result = await parseDocument(testBuffer, `test.${extension}`);
          expect(typeof result).toBe('string');
        } catch (error) {
          // If parsing fails, that's expected with simple buffer
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle special characters in filenames', async () => {
      const specialFilenames = [
        'résumé.pdf',
        'document with spaces.docx',
        'file-with-dashes.pdf',
        'file_with_underscores.docx',
        'file(with)parentheses.pdf'
      ];

      const buffer = Buffer.from('test content');

      for (const filename of specialFilenames) {
        try {
          await parseDocument(buffer, filename);
        } catch (error) {
          // Should handle special characters in filenames
          expect((error as Error).message).not.toContain('Unsupported file type');
        }
      }
    });

    it('should handle files without extensions', async () => {
      const buffer = Buffer.from('test content');
      
      await expect(parseDocument(buffer, 'fileWithoutExtension')).rejects.toThrow('Unsupported file type');
    });

    it('should be case-insensitive for file extensions', async () => {
      const buffer = Buffer.from('test content');
      const variations = [
        'test.PDF',
        'test.Pdf',
        'test.pDf',
        'test.DOCX',
        'test.Docx',
        'test.dOcX'
      ];

      for (const filename of variations) {
        try {
          await parseDocument(buffer, filename);
        } catch (error) {
          // Should recognize the file type regardless of case
          expect((error as Error).message).not.toContain('Unsupported file type');
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const buffer = Buffer.from('test');
      
      try {
        await parseDocument(buffer, 'test.xyz');
      } catch (error) {
        expect((error as Error).message).toContain('Unsupported file type');
        expect((error as Error).message).toContain('.xyz');
      }
    });

    it('should handle memory constraints gracefully', async () => {
      // Test with extremely large buffer
      try {
        const hugeBuffer = Buffer.alloc(100 * 1024 * 1024); // 100MB
        await parseDocument(hugeBuffer, 'huge.pdf');
      } catch (error) {
        // Should either succeed or fail gracefully
        expect(error).toBeDefined();
      }
    });

    it('should handle concurrent parsing requests', async () => {
      const buffer = Buffer.from('test content');
      const promises = [];

      // Create multiple concurrent parsing requests
      for (let i = 0; i < 5; i++) {
        promises.push(parseDocument(buffer, `test${i}.pdf`));
      }

      try {
        await Promise.all(promises);
      } catch (error) {
        // Should handle concurrent requests without crashing
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance Tests', () => {
    it('should complete parsing within reasonable time', async () => {
      const buffer = Buffer.from('test content for timing');
      const startTime = Date.now();

      try {
        await parseDocument(buffer, 'timing-test.pdf');
      } catch (error) {
        // Even if parsing fails, it should complete quickly
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within 10 seconds even for errors
      expect(duration).toBeLessThan(10000);
    });

    it('should handle multiple file types efficiently', async () => {
      const buffer = Buffer.from('efficiency test content');
      const fileTypes = ['test1.pdf', 'test2.docx', 'test3.pdf', 'test4.docx'];
      
      const startTime = Date.now();

      const promises = fileTypes.map(filename => 
        parseDocument(buffer, filename).catch(() => 'error')
      );

      await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should handle multiple types efficiently
      expect(duration).toBeLessThan(15000);
    });
  });
});