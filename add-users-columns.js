// Script to add missing columns to the users table
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

async function addUsersColumns() {
  console.log('Adding missing columns to the users table...');
  
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
    
    // Add missing columns to the users table
    console.log('Adding status column...');
    await pool.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending'
    `);
    
    console.log('Adding approvedBy column...');
    await pool.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "approved_by" INTEGER REFERENCES "users"("id")
    `);
    
    console.log('Adding approvedAt column...');
    await pool.query(`
      ALTER TABLE "users" 
      ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP
    `);
    
    // Update existing users to have 'approved' status if they don't have a status yet
    console.log('Updating existing users to approved status...');
    await pool.query(`
      UPDATE "users"
      SET "status" = 'approved'
      WHERE "role" IN ('admin', 'recruiter', 'lead', 'sub-admin', 'manager')
    `);
    
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

addUsersColumns().catch((err) => {
  console.error('Failed to add users columns:', err);
  process.exit(1);
});
