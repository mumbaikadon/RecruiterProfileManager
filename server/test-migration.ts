/**
 * Test script to debug and run the Phase 3 migration
 */

import { testMigration, migrateSingleResume, validateBase64File } from './migration-utils';
import { db } from '../shared/db';
import { profileResumes } from '../shared/schema';
import { eq } from 'drizzle-orm';

export async function debugSingleResume(resumeId: number) {
  console.log(`🔍 Debugging resume ${resumeId}...`);
  
  try {
    // Get the raw data
    const resume = await db
      .select({ 
        id: profileResumes.id,
        filename: profileResumes.filename,
        fileData: profileResumes.fileData,
        filePath: profileResumes.filePath
      })
      .from(profileResumes)
      .where(eq(profileResumes.id, resumeId))
      .limit(1);

    if (!resume[0]) {
      console.log('❌ Resume not found');
      return;
    }

    const { filename, fileData, filePath } = resume[0];
    
    console.log('📊 Resume info:', {
      filename,
      hasFilePath: !!filePath,
      hasFileData: !!fileData,
      fileDataLength: fileData?.length || 0,
      fileDataStart: fileData?.slice(0, 50) || 'N/A'
    });

    if (fileData) {
      // Test the validation
      const validation = await validateBase64File(fileData, filename);
      console.log('🧪 Validation result:', validation);

      if (validation.isValid && validation.buffer) {
        console.log('✅ File is valid! Buffer info:', {
          size: validation.buffer.length,
          firstBytes: validation.buffer.slice(0, 10).toString('hex'),
          isPDF: validation.buffer.slice(0, 4).toString() === '%PDF'
        });
      }
    }

  } catch (error) {
    console.error('❌ Debug error:', error);
  }
}

export async function testSingleMigration(resumeId: number) {
  console.log(`🧪 Testing migration for resume ${resumeId}...`);
  
  const testResult = await testMigration(resumeId);
  console.log('📋 Test result:', testResult);

  if (testResult.canMigrate) {
    console.log(`✅ Can migrate! Attempting actual migration...`);
    const migrationResult = await migrateSingleResume(resumeId);
    console.log('🚀 Migration result:', migrationResult);
  } else {
    console.log('❌ Cannot migrate:', testResult.validation.error);
  }
}