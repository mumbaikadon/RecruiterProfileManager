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
const sslEnabled = (process.env.DB_SSL || '').toLowerCase() === 'true';

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // Better connection handling and stability
  connectionTimeoutMillis: 10000,
  max: 20,
  idleTimeoutMillis: 30000,
  keepAlive: true,
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
});

// Initialize Drizzle with the schema using the pg adapter
export const db = drizzle(pool, { schema });

// Test the connection
pool.connect()
  .then(client => {
    console.log('Database connection successful');
    client.release();
  })
  .catch(err => {
    console.error('Database connection error:', err?.message || err);
    if (sslEnabled) {
      console.error('Note: SSL is enabled (DB_SSL=true). If your server does not require SSL, set DB_SSL=false.');
    } else {
      console.error('Note: SSL is disabled. If you are connecting to a managed Postgres that requires SSL, set DB_SSL=true.');
    }
  });
