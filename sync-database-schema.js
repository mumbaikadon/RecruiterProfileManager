// Script to synchronize database schema with the schema definitions
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

async function syncDatabaseSchema() {
  console.log('Synchronizing database schema with schema definitions...');
  
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
    
    // Sync users table
    console.log('\nSynchronizing users table...');
    await pool.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS "approved_by" INTEGER REFERENCES "users"("id"),
      ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP;
    `);
    
    // Update existing users to have 'approved' status if they don't have a status yet
    await pool.query(`
      UPDATE "users"
      SET "status" = 'approved'
      WHERE "role" IN ('admin', 'recruiter', 'lead', 'sub-admin', 'manager');
    `);
    
    // Sync jobs table
    console.log('\nSynchronizing jobs table...');
    await pool.query(`
      ALTER TABLE "jobs" 
      ADD COLUMN IF NOT EXISTS "client" TEXT,
      ADD COLUMN IF NOT EXISTS "impl_or_pv" TEXT,
      ADD COLUMN IF NOT EXISTS "city" TEXT,
      ADD COLUMN IF NOT EXISTS "state" TEXT,
      ADD COLUMN IF NOT EXISTS "job_type" TEXT,
      ADD COLUMN IF NOT EXISTS "rate" TEXT,
      ADD COLUMN IF NOT EXISTS "interview_type" TEXT,
      ADD COLUMN IF NOT EXISTS "visa_restrictions" TEXT,
      ADD COLUMN IF NOT EXISTS "required_skills" TEXT[];
    `);
    
    // Sync resume_data table
    console.log('\nSynchronizing resume_data table...');
    await pool.query(`
      ALTER TABLE "resume_data" 
      ADD COLUMN IF NOT EXISTS "file_content" TEXT,
      ADD COLUMN IF NOT EXISTS "file_size" INTEGER,
      ADD COLUMN IF NOT EXISTS "mime_type" TEXT;
    `);
    
    // Sync submissions table
    console.log('\nSynchronizing submissions table...');
    await pool.query(`
      ALTER TABLE "submissions" 
      ADD COLUMN IF NOT EXISTS "feedback" TEXT,
      ADD COLUMN IF NOT EXISTS "is_suspicious" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "suspicious_reason" TEXT,
      ADD COLUMN IF NOT EXISTS "suspicious_severity" TEXT,
      ADD COLUMN IF NOT EXISTS "last_updated_by" INTEGER REFERENCES "users"("id");
    `);
    
    // Sync candidates table
    console.log('\nSynchronizing candidates table...');
    await pool.query(`
      ALTER TABLE "candidates" 
      ADD COLUMN IF NOT EXISTS "is_unreal" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "unreal_reason" TEXT,
      ADD COLUMN IF NOT EXISTS "is_suspicious" BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS "suspicious_reason" TEXT,
      ADD COLUMN IF NOT EXISTS "suspicious_severity" TEXT,
      ADD COLUMN IF NOT EXISTS "last_validated" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "validated_by" INTEGER REFERENCES "users"("id");
    `);
    
    // Create profile_resumes table if it doesn't exist
    console.log('\nCreating profile_resumes table if it doesn\'t exist...');
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
    
    // Create resume_content table if it doesn't exist
    console.log('\nCreating resume_content table if it doesn\'t exist...');
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
    console.log('\nCreating indexes for resume_content table...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS "resume_content_hash_idx" ON "resume_content" ("content_hash");
      CREATE INDEX IF NOT EXISTS "resume_content_search_idx" ON "resume_content" USING gin(to_tsvector('english', "extracted_text"));
    `);
    
    // Create candidate_validations table if it doesn't exist
    console.log('\nCreating candidate_validations table if it doesn\'t exist...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "candidate_validations" (
        "id" SERIAL PRIMARY KEY,
        "candidate_id" INTEGER NOT NULL REFERENCES "candidates"("id"),
        "job_id" INTEGER REFERENCES "jobs"("id"),
        "validation_type" TEXT NOT NULL,
        "validation_result" TEXT NOT NULL,
        "previous_client_names" TEXT[],
        "previous_job_titles" TEXT[],
        "previous_dates" TEXT[],
        "new_client_names" TEXT[],
        "new_job_titles" TEXT[],
        "new_dates" TEXT[],
        "resume_file_name" TEXT,
        "reason" TEXT,
        "validated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "validated_by" INTEGER NOT NULL REFERENCES "users"("id")
      );
    `);
    
    // Create public_applications table if it doesn't exist
    console.log('\nCreating public_applications table if it doesn\'t exist...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "public_applications" (
        "id" SERIAL PRIMARY KEY,
        "job_id" INTEGER NOT NULL REFERENCES "jobs"("id"),
        "first_name" TEXT NOT NULL,
        "last_name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "phone" TEXT NOT NULL,
        "cover_letter" TEXT,
        "resume_file_name" TEXT,
        "resume_content" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "applied_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "reviewed_at" TIMESTAMP,
        "reviewed_by" INTEGER REFERENCES "users"("id"),
        "notes" TEXT
      );
    `);
    
    // Commit transaction
    await pool.query('COMMIT');
    console.log('\nDatabase schema synchronized successfully.');
  } catch (error) {
    // Rollback transaction on error
    await pool.query('ROLLBACK');
    console.error('Error synchronizing database schema:', error);
    process.exit(1);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

syncDatabaseSchema().catch((err) => {
  console.error('Failed to synchronize database schema:', err);
  process.exit(1);
});
