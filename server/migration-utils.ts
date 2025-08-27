/**
 * Phase 3: Legacy Data Migration Utilities
 * Converts corrupted base64 database storage to efficient filesystem storage
 */

import { db } from '../shared/db';
import { profileResumes } from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';
import { saveFile } from './file-utils';

export interface MigrationResult {
  resumeId: number;
  filename: string;
  success: boolean;
  error?: string;
  newFilePath?: string;
  originalSize: number;
  newSize?: number;
}

export interface MigrationStats {
  total: number;
  successful: number;
  failed: number;
  bytesRecovered: number;
  bytesSaved: number;
}

/**
 * Test if base64 data can be properly decoded and is a valid file
 */
export async function validateBase64File(base64Data: string, filename: string): Promise<{
  isValid: boolean;
  buffer?: Buffer;
  error?: string;
  fileSize?: number;
}> {
  try {
    // Test base64 format
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      return { isValid: false, error: 'Invalid base64 format' };
    }

    // Attempt to decode
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer.length === 0) {
      return { isValid: false, error: 'Empty buffer after decoding' };
    }

    // Check file magic numbers for PDF/DOCX
    const header = buffer.slice(0, 8);
    const isPDF = header.slice(0, 4).toString() === '%PDF';
    const isDOCX = header[0] === 0x50 && header[1] === 0x4B; // ZIP signature (DOCX is ZIP)

    if (!isPDF && !isDOCX) {
      return { 
        isValid: false, 
        error: `Invalid file header. Expected PDF or DOCX, got: ${header.toString('hex')}` 
      };
    }

    return {
      isValid: true,
      buffer,
      fileSize: buffer.length
    };

  } catch (error) {
    return { 
      isValid: false, 
      error: `Base64 decode error: ${(error as Error).message}` 
    };
  }
}

/**
 * Migrate a single resume from database to filesystem
 */
export async function migrateSingleResume(resumeId: number): Promise<MigrationResult> {
  try {
    // Get the resume data
    const resume = await db
      .select()
      .from(profileResumes)
      .where(eq(profileResumes.id, resumeId))
      .limit(1);

    if (!resume[0] || !resume[0].fileData) {
      return {
        resumeId,
        filename: 'unknown',
        success: false,
        error: 'Resume not found or no fileData',
        originalSize: 0
      };
    }

    const { filename, fileData } = resume[0];
    const originalSize = fileData.length;

    // Validate the base64 data
    const validation = await validateBase64File(fileData, filename);
    
    if (!validation.isValid || !validation.buffer) {
      return {
        resumeId,
        filename,
        success: false,
        error: validation.error,
        originalSize
      };
    }

    // Save to filesystem
    const filePath = await saveFile(validation.buffer, filename);

    // Update database record
    await db
      .update(profileResumes)
      .set({ 
        filePath,
        fileData: null // Clear the base64 data
      })
      .where(eq(profileResumes.id, resumeId));

    return {
      resumeId,
      filename,
      success: true,
      newFilePath: filePath,
      originalSize,
      newSize: validation.fileSize
    };

  } catch (error) {
    return {
      resumeId,
      filename: 'error',
      success: false,
      error: (error as Error).message,
      originalSize: 0
    };
  }
}

/**
 * Migrate all legacy resumes in batches
 */
export async function migrateAllLegacyResumes(batchSize: number = 10): Promise<{
  results: MigrationResult[];
  stats: MigrationStats;
}> {
  console.log('🚀 Starting Phase 3 Legacy Data Migration...');
  
  // Get all resumes without file paths (legacy data)
  const legacyResumes = await db
    .select({ 
      id: profileResumes.id,
      filename: profileResumes.filename 
    })
    .from(profileResumes)
    .where(isNull(profileResumes.filePath));

  console.log(`📊 Found ${legacyResumes.length} legacy resumes to migrate`);

  const results: MigrationResult[] = [];
  const stats: MigrationStats = {
    total: legacyResumes.length,
    successful: 0,
    failed: 0,
    bytesRecovered: 0,
    bytesSaved: 0
  };

  // Process in batches to avoid memory issues
  for (let i = 0; i < legacyResumes.length; i += batchSize) {
    const batch = legacyResumes.slice(i, i + batchSize);
    console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(legacyResumes.length / batchSize)}`);

    // Process batch in parallel
    const batchPromises = batch.map((resume: any) => migrateSingleResume(resume.id));
    const batchResults = await Promise.all(batchPromises);
    
    results.push(...batchResults);

    // Update stats
    for (const result of batchResults) {
      if (result.success) {
        stats.successful++;
        stats.bytesRecovered += result.originalSize;
        stats.bytesSaved += result.originalSize - (result.newSize || 0);
      } else {
        stats.failed++;
        console.warn(`❌ Failed to migrate ${result.filename}:`, result.error);
      }
    }

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('✅ Migration completed!');
  console.log(`📈 Stats:`, {
    ...stats,
    successRate: `${((stats.successful / stats.total) * 100).toFixed(1)}%`,
    spaceSavedMB: `${(stats.bytesSaved / 1024 / 1024).toFixed(2)}MB`
  });

  return { results, stats };
}

/**
 * Test migration on a single resume (dry run)
 */
export async function testMigration(resumeId: number): Promise<{
  canMigrate: boolean;
  validation: any;
  estimatedSavings: number;
}> {
  const resume = await db
    .select({ fileData: profileResumes.fileData, filename: profileResumes.filename })
    .from(profileResumes)
    .where(eq(profileResumes.id, resumeId))
    .limit(1);

  if (!resume[0] || !resume[0].fileData) {
    return { canMigrate: false, validation: { error: 'No data found' }, estimatedSavings: 0 };
  }

  const validation = await validateBase64File(resume[0].fileData, resume[0].filename);
  const estimatedSavings = validation.isValid ? 
    resume[0].fileData.length - (validation.fileSize || 0) : 0;

  return {
    canMigrate: validation.isValid,
    validation,
    estimatedSavings
  };
}