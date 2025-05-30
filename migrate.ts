import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import 'dotenv/config';

async function runMigration() {
  console.log('Running database migration...');
  
  // Create a database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  // Initialize drizzle
  const db = drizzle(pool);
  
  console.log('Adding missing columns to tables...');
  
  // Add columns to submissions table
  await pool.query(`
    ALTER TABLE IF EXISTS submissions 
    ADD COLUMN IF NOT EXISTS feedback TEXT,
    ADD COLUMN IF NOT EXISTS last_updated_by INTEGER REFERENCES users(id);
  `);
  
  // Add job_type, client_focus, and client_name columns to jobs table
  await pool.query(`
    ALTER TABLE IF EXISTS jobs
    ADD COLUMN IF NOT EXISTS job_type TEXT CHECK (job_type IN ('onsite', 'remote', 'hybrid')),
    ADD COLUMN IF NOT EXISTS client_focus TEXT,
    ADD COLUMN IF NOT EXISTS client_name TEXT;
  `);
  
  console.log('Database migration completed successfully.');
  await pool.end();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});