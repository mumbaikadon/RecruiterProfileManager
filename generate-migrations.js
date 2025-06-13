// Script to generate Drizzle migration files from schema
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import 'dotenv/config';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateMigrations() {
  console.log('Generating Drizzle migration files from schema...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set in .env file');
    process.exit(1);
  }
  
  // Create migrations directory if it doesn't exist
  const migrationsDir = path.join(__dirname, 'drizzle');
  try {
    await fs.mkdir(migrationsDir, { recursive: true });
    console.log(`Created migrations directory: ${migrationsDir}`);
  } catch (err) {
    if (err.code !== 'EEXIST') {
      console.error('Error creating migrations directory:', err);
      process.exit(1);
    }
  }
  
  // Create a migration file
  const timestamp = new Date().toISOString().replace(/[-:.]/g, '_');
  const migrationFileName = `${timestamp}_initial_schema.sql`;
  const migrationFilePath = path.join(migrationsDir, migrationFileName);
  
  // Generate SQL for all tables from schema.ts
  const migrationSQL = `
-- Initial schema migration generated on ${new Date().toISOString()}

-- Users table
CREATE TABLE IF NOT EXISTS "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'recruiter',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" SERIAL PRIMARY KEY,
  "job_id" TEXT NOT NULL UNIQUE,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "job_type" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" INTEGER REFERENCES "users"("id")
);

-- Job assignments table
CREATE TABLE IF NOT EXISTS "job_assignments" (
  "id" SERIAL PRIMARY KEY,
  "job_id" INTEGER NOT NULL REFERENCES "jobs"("id"),
  "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "assigned_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "job_user_unique_idx" UNIQUE ("job_id", "user_id")
);

-- Candidates table
CREATE TABLE IF NOT EXISTS "candidates" (
  "id" SERIAL PRIMARY KEY,
  "first_name" TEXT NOT NULL,
  "middle_name" TEXT,
  "last_name" TEXT NOT NULL,
  "dob_month" INTEGER NOT NULL,
  "dob_day" INTEGER NOT NULL,
  "ssn_last_four" TEXT NOT NULL,
  "location" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "linkedin" TEXT,
  "work_authorization" TEXT NOT NULL,
  "is_unreal" BOOLEAN NOT NULL DEFAULT FALSE,
  "unreal_reason" TEXT,
  "is_suspicious" BOOLEAN NOT NULL DEFAULT FALSE,
  "suspicious_reason" TEXT,
  "suspicious_severity" TEXT,
  "last_validated" TIMESTAMP,
  "validated_by" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "created_by" INTEGER REFERENCES "users"("id"),
  CONSTRAINT "candidate_identity_idx" UNIQUE ("dob_month", "dob_day", "ssn_last_four")
);

-- Resume data table
CREATE TABLE IF NOT EXISTS "resume_data" (
  "id" SERIAL PRIMARY KEY,
  "candidate_id" INTEGER NOT NULL REFERENCES "candidates"("id"),
  "client_names" TEXT[],
  "job_titles" TEXT[],
  "relevant_dates" TEXT[],
  "skills" TEXT[],
  "education" TEXT[],
  "extracted_text" TEXT,
  "file_name" TEXT,
  "uploaded_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Submissions table
CREATE TABLE IF NOT EXISTS "submissions" (
  "id" SERIAL PRIMARY KEY,
  "job_id" INTEGER NOT NULL REFERENCES "jobs"("id"),
  "candidate_id" INTEGER NOT NULL REFERENCES "candidates"("id"),
  "recruiter_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "status" TEXT NOT NULL DEFAULT 'New',
  "match_score" INTEGER DEFAULT 65,
  "agreed_rate" INTEGER DEFAULT 0,
  "submitted_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
  "notes" TEXT,
  "feedback" TEXT,
  "is_suspicious" BOOLEAN NOT NULL DEFAULT FALSE,
  "suspicious_reason" TEXT,
  "suspicious_severity" TEXT,
  "last_updated_by" INTEGER REFERENCES "users"("id"),
  CONSTRAINT "job_candidate_unique_idx" UNIQUE ("job_id", "candidate_id")
);

-- Candidate validations table
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

-- Activities table
CREATE TABLE IF NOT EXISTS "activities" (
  "id" SERIAL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "user_id" INTEGER REFERENCES "users"("id"),
  "job_id" INTEGER REFERENCES "jobs"("id"),
  "candidate_id" INTEGER REFERENCES "candidates"("id"),
  "submission_id" INTEGER REFERENCES "submissions"("id"),
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create default admin user
INSERT INTO "users" ("username", "password", "name", "email", "role")
VALUES ('admin', '$2b$10$3euPcmQFCiblsZeEu5s7p.9MUZWg1IkNDpSHKUzXZXPQKKIGzAn3e', 'Admin User', 'admin@example.com', 'admin')
ON CONFLICT ("username") DO NOTHING;
`;
  
  try {
    await fs.writeFile(migrationFilePath, migrationSQL);
    console.log(`Created migration file: ${migrationFilePath}`);
    
    // Create a meta file to track migrations
    const metaFilePath = path.join(migrationsDir, 'meta', '_journal.json');
    const metaDir = path.join(migrationsDir, 'meta');
    
    try {
      await fs.mkdir(metaDir, { recursive: true });
      
      const metaContent = {
        version: '5',
        dialect: 'pg',
        entries: [
          {
            idx: 0,
            when: Date.now(),
            tag: '0000_initial_schema',
            breakpoints: true
          }
        ]
      };
      
      await fs.writeFile(metaFilePath, JSON.stringify(metaContent, null, 2));
      console.log(`Created migration meta file: ${metaFilePath}`);
    } catch (err) {
      console.error('Error creating meta file:', err);
    }
    
    console.log('Migration files generated successfully.');
  } catch (err) {
    console.error('Error writing migration file:', err);
    process.exit(1);
  }
}

generateMigrations().catch((err) => {
  console.error('Failed to generate migrations:', err);
  process.exit(1);
});
