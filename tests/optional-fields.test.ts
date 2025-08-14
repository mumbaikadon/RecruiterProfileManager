import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Storage } from '../server/storage';
import { insertCandidateSchema } from '../shared/schema';

// Mock the database module
jest.mock('../server/db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn(),
  },
}));

// Mock drizzle-orm functions
jest.mock('drizzle-orm', () => ({
  eq: jest.fn((field, value) => ({ field, value, type: 'eq' })),
  and: jest.fn((...conditions) => ({ conditions, type: 'and' })),
  desc: jest.fn(),
  sql: jest.fn(),
}));

describe('Optional Fields Implementation', () => {
  let storage: Storage;

  beforeEach(() => {
    storage = new Storage();
    jest.clearAllMocks();
  });

  describe('insertCandidateSchema validation', () => {
    it('should accept candidate data with all optional fields provided', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 5,
        dobDay: 15,
        ssn4: '1234',
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dobMonth).toBe(5);
        expect(result.data.dobDay).toBe(15);
        expect(result.data.ssn4).toBe('1234');
      }
    });

    it('should accept candidate data with dobMonth missing', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobDay: 15,
        ssn4: '1234',
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dobMonth).toBeUndefined();
        expect(result.data.dobDay).toBe(15);
        expect(result.data.ssn4).toBe('1234');
      }
    });

    it('should accept candidate data with dobDay missing', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 5,
        ssn4: '1234',
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dobMonth).toBe(5);
        expect(result.data.dobDay).toBeUndefined();
        expect(result.data.ssn4).toBe('1234');
      }
    });

    it('should accept candidate data with ssn4 missing', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 5,
        dobDay: 15,
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dobMonth).toBe(5);
        expect(result.data.dobDay).toBe(15);
        expect(result.data.ssn4).toBeUndefined();
      }
    });

    it('should accept candidate data with all optional fields missing', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dobMonth).toBeUndefined();
        expect(result.data.dobDay).toBeUndefined();
        expect(result.data.ssn4).toBeUndefined();
      }
    });

    it('should reject candidate data with invalid dobMonth', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 13, // Invalid month
        dobDay: 15,
        ssn4: '1234',
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(false);
    });

    it('should reject candidate data with invalid dobDay', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 5,
        dobDay: 32, // Invalid day
        ssn4: '1234',
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(false);
    });

    it('should reject candidate data with invalid ssn4 format', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 5,
        dobDay: 15,
        ssn4: '12345', // Invalid length
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(false);
    });

    it('should reject candidate data with non-numeric ssn4', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 5,
        dobDay: 15,
        ssn4: 'abcd', // Non-numeric
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(false);
    });
  });

  describe('getCandidateByIdentity function', () => {
    it('should return undefined when no identifying information is provided', async () => {
      const result = await storage.getCandidateByIdentity();
      expect(result).toBeUndefined();
    });

    it('should return undefined when all parameters are empty/null', async () => {
      const result = await storage.getCandidateByIdentity(undefined, undefined, '');
      expect(result).toBeUndefined();
    });

    it('should search by dobMonth only when provided', async () => {
      const mockDb = require('../server/db').db;
      mockDb.returning.mockResolvedValueOnce([{ id: 1, firstName: 'John' }]);

      await storage.getCandidateByIdentity(5, undefined, undefined);

      // Verify that only dobMonth condition was added
      expect(mockDb.where).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: [
            expect.objectContaining({ field: expect.anything(), value: 5 })
          ]
        })
      );
    });

    it('should search by dobDay only when provided', async () => {
      const mockDb = require('../server/db').db;
      mockDb.returning.mockResolvedValueOnce([{ id: 1, firstName: 'John' }]);

      await storage.getCandidateByIdentity(undefined, 15, undefined);

      // Verify that only dobDay condition was added
      expect(mockDb.where).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: [
            expect.objectContaining({ field: expect.anything(), value: 15 })
          ]
        })
      );
    });

    it('should search by ssn4 only when provided', async () => {
      const mockDb = require('../server/db').db;
      mockDb.returning.mockResolvedValueOnce([{ id: 1, firstName: 'John' }]);

      await storage.getCandidateByIdentity(undefined, undefined, '1234');

      // Verify that only ssn4 condition was added
      expect(mockDb.where).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: [
            expect.objectContaining({ field: expect.anything(), value: '1234' })
          ]
        })
      );
    });

    it('should search by all fields when all are provided', async () => {
      const mockDb = require('../server/db').db;
      mockDb.returning.mockResolvedValueOnce([{ id: 1, firstName: 'John' }]);

      await storage.getCandidateByIdentity(5, 15, '1234');

      // Verify that all conditions were added
      expect(mockDb.where).toHaveBeenCalledWith(
        expect.objectContaining({
          conditions: expect.arrayContaining([
            expect.objectContaining({ field: expect.anything(), value: 5 }),
            expect.objectContaining({ field: expect.anything(), value: 15 }),
            expect.objectContaining({ field: expect.anything(), value: '1234' })
          ])
        })
      );
    });

    it('should ignore empty string ssn4', async () => {
      const result = await storage.getCandidateByIdentity(undefined, undefined, '');
      expect(result).toBeUndefined();
    });

    it('should ignore null values', async () => {
      const result = await storage.getCandidateByIdentity(null as any, null as any, null as any);
      expect(result).toBeUndefined();
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle zero values correctly for dobMonth and dobDay', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: 0, // Should be invalid
        dobDay: 0,   // Should be invalid
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(false);
    });

    it('should handle negative values correctly for dobMonth and dobDay', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        dobMonth: -1, // Should be invalid
        dobDay: -1,   // Should be invalid
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(false);
    });

    it('should handle empty string for optional fields', () => {
      const candidateData = {
        firstName: 'John',
        lastName: 'Doe',
        ssn4: '', // Empty string should be valid for optional field
        location: 'New York, NY',
        email: 'john.doe@example.com',
        phone: '1234567890',
        workAuthorization: 'citizen',
        createdBy: 1,
      };

      const result = insertCandidateSchema.safeParse(candidateData);
      expect(result.success).toBe(true);
    });
  });
});