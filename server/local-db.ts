// Local development database connection
import 'dotenv/config';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// For local development, we'll use the pg-pool from connect-pg-simple which is already installed
// This avoids the need to install the pg package separately
const pgPool = require('connect-pg-simple/lib/pg-pool');

console.log(`Connecting to local database: ${process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@')}`);

// Create the connection pool using the existing pg-pool
export const pool = new pgPool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Create a simple wrapper for the drizzle interface
export const db = {
  query: async (sql: string, params?: any[]) => {
    const client = await pool.connect();
    try {
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  },
  // Add minimal implementation needed for your application
  select: async (table: string) => {
    const result = await db.query(`SELECT * FROM ${table}`);
    return result.rows;
  },
  insert: async (table: string, data: Record<string, any>) => {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    
    const sql = `
      INSERT INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;
    
    const result = await db.query(sql, values);
    return result.rows[0];
  }
};

// Test the connection
pool.connect()
  .then((client: any) => {
    console.log('Database connection successful');
    client.release();
  })
  .catch((err: any) => console.error('Database connection error:', err));
