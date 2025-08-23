// Script to add missing columns to the jobs table
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

async function addJobsColumns() {
  console.log('Adding missing columns to the jobs table...');
  
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
    
    // Add missing columns to the jobs table
    console.log('Adding client column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "client" TEXT;`);
    
    console.log('Adding implOrPv column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "impl_or_pv" TEXT;`);
    
    console.log('Adding rate column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "rate" TEXT;`);
    
    console.log('Adding interviewType column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "interview_type" TEXT;`);
    
    console.log('Adding visaRestrictions column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_restrictions" TEXT;`);
    
    console.log('Adding requiredSkills column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "required_skills" TEXT[];`);
    
    console.log('Adding jobType column...');
    await pool.query(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "job_type" TEXT;`);
    
    // Commit transaction
    await pool.query('COMMIT');
    console.log('Columns added successfully.');
  } catch (error) {
    // Rollback transaction on error
    await pool.query('ROLLBACK');
    console.error('Error adding columns:', error);
    process.exit(1);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

addJobsColumns().catch((err) => {
  console.error('Failed to add jobs columns:', err);
  process.exit(1);
});
