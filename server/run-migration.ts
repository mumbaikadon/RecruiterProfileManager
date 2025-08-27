/**
 * Direct migration execution script
 * Run Phase 3: Convert all legacy base64 storage to filesystem
 */

import { migrateAllLegacyResumes, testMigration, migrateSingleResume } from './migration-utils';

async function runPhase3Migration() {
  console.log('🚀 Starting Phase 3: Legacy Data Migration');
  console.log('=====================================');
  
  try {
    // Step 1: Test a single migration first
    console.log('📋 Step 1: Testing single migration...');
    const testResult = await testMigration(199);
    console.log('Test result:', testResult);
    
    if (!testResult.canMigrate) {
      console.error('❌ Test migration failed. Aborting.');
      return;
    }
    
    // Step 2: Migrate the test resume
    console.log('🧪 Step 2: Migrating test resume...');
    const singleResult = await migrateSingleResume(199);
    console.log('Single migration result:', singleResult);
    
    if (!singleResult.success) {
      console.error('❌ Single migration failed. Aborting full migration.');
      return;
    }
    
    // Step 3: Run full migration
    console.log('🚀 Step 3: Running full migration for all legacy resumes...');
    const fullResult = await migrateAllLegacyResumes(10); // Batch size of 10
    
    console.log('=====================================');
    console.log('✅ PHASE 3 MIGRATION COMPLETE!');
    console.log('=====================================');
    console.log('📊 Final Stats:');
    console.log(`• Total resumes: ${fullResult.stats.total}`);
    console.log(`• Successfully migrated: ${fullResult.stats.successful}`);
    console.log(`• Failed: ${fullResult.stats.failed}`);
    console.log(`• Success rate: ${((fullResult.stats.successful / fullResult.stats.total) * 100).toFixed(1)}%`);
    console.log(`• Space saved: ${(fullResult.stats.bytesSaved / 1024 / 1024).toFixed(2)}MB`);
    console.log(`• Data recovered: ${(fullResult.stats.bytesRecovered / 1024 / 1024).toFixed(2)}MB`);
    
    // Show failed migrations if any
    const failures = fullResult.results.filter(r => !r.success);
    if (failures.length > 0) {
      console.log('\n⚠️ Failed migrations:');
      failures.forEach(f => {
        console.log(`  • ${f.filename} (ID: ${f.resumeId}): ${f.error}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
  }
}

// Run if called directly
if (require.main === module) {
  runPhase3Migration();
}

export { runPhase3Migration };