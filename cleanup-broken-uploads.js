// Script to clean up broken uploads that have null file_data
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

async function cleanupBrokenUploads() {
  console.log('🧹 Cleaning up broken uploads with null file_data...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set in .env file');
    process.exit(1);
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await pool.query('BEGIN');
    
    // Find all profile_resumes with null file_data and null file_path
    const brokenResumes = await pool.query(`
      SELECT id, filename, uploaded_at 
      FROM profile_resumes 
      WHERE file_data IS NULL AND file_path IS NULL
    `);
    
    console.log(`\nFound ${brokenResumes.rows.length} broken resume(s) to clean up:`);
    brokenResumes.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, File: ${row.filename}, Uploaded: ${row.uploaded_at}`);
    });
    
    if (brokenResumes.rows.length === 0) {
      console.log('\n✅ No broken uploads found. Database is clean!');
      await pool.query('COMMIT');
      return;
    }
    
    // Delete failed processing jobs for these resumes
    const jobsDeleted = await pool.query(`
      DELETE FROM processing_jobs 
      WHERE profile_resume_id IN (
        SELECT id FROM profile_resumes 
        WHERE file_data IS NULL AND file_path IS NULL
      )
      RETURNING id
    `);
    
    console.log(`\n🗑️  Deleted ${jobsDeleted.rows.length} failed processing job(s)`);
    
    // Delete the broken resumes (cascade will delete related content)
    const resumesDeleted = await pool.query(`
      DELETE FROM profile_resumes 
      WHERE file_data IS NULL AND file_path IS NULL
      RETURNING id, filename
    `);
    
    console.log(`\n🗑️  Deleted ${resumesDeleted.rows.length} broken resume(s):`);
    resumesDeleted.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, File: ${row.filename}`);
    });
    
    await pool.query('COMMIT');
    console.log('\n✅ Cleanup completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Run: node sync-database-schema.js (to fix the schema)');
    console.log('   2. Re-upload the files that were deleted');
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanupBrokenUploads().catch((err) => {
  console.error('Failed to clean up broken uploads:', err);
  process.exit(1);
});
