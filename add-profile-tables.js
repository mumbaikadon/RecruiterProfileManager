// Script to add missing profile_resumes and resume_content tables
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

async function addProfileTables() {
  console.log('Adding missing profile_resumes and resume_content tables...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set in .env file');
    process.exit(1);
  }
  
  // Create a database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Begin transaction
    await pool.query('BEGIN');
    
    // Create profile_resumes table
    console.log('Creating profile_resumes table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "profile_resumes" (
        "id" SERIAL PRIMARY KEY,
        "filename" TEXT NOT NULL,
        "file_type" TEXT NOT NULL,
        "file_size" INTEGER NOT NULL,
        "file_data" TEXT NOT NULL,
        "candidate_name" TEXT,
        "candidate_email" TEXT,
        "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "uploaded_by" INTEGER REFERENCES "users"("id")
      );
    `);
    
    // Create resume_content table with full-text search capabilities
    console.log('Creating resume_content table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "resume_content" (
        "id" SERIAL PRIMARY KEY,
        "profile_resume_id" INTEGER NOT NULL REFERENCES "profile_resumes"("id") ON DELETE CASCADE,
        "extracted_text" TEXT NOT NULL,
        "content_hash" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create indexes for resume_content table
    console.log('Creating indexes for resume_content table...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "resume_content_hash_idx" ON "resume_content" ("content_hash");
      CREATE INDEX IF NOT EXISTS "resume_content_search_idx" ON "resume_content" USING gin(to_tsvector('english', "extracted_text"));
    `);
    
    // Commit transaction
    await pool.query('COMMIT');
    console.log('Tables created successfully.');
  } catch (error) {
    // Rollback transaction on error
    await pool.query('ROLLBACK');
    console.error('Error creating tables:', error);
    process.exit(1);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

addProfileTables().catch((err) => {
  console.error('Failed to add profile tables:', err);
  process.exit(1);
});
