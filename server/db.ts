import 'dotenv/config';
import * as schema from "@shared/schema";

// Import the standard node-postgres package
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// For local development, we're using the standard pg client
console.log(`Connecting to database: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);

// Create the connection pool with the standard pg client
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Add these options for better local connection handling
  connectionTimeoutMillis: 5000,
  max: 20,
  idleTimeoutMillis: 30000
});

// Initialize Drizzle with the schema using the pg adapter
export const db = drizzle(pool, { schema });

// Test the connection
pool.connect()
  .then(client => {
    console.log('Database connection successful');
    client.release();
  })
  .catch(err => console.error('Database connection error:', err));