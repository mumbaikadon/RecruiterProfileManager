// Database setup script using Drizzle schema
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupDrizzle() {
  console.log('Setting up database using Drizzle schema...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set in .env file');
    process.exit(1);
  }
  
  // Create a database connection
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    // Test the connection
    const client = await pool.connect();
    console.log('Successfully connected to the database');
    client.release();
    
    // Initialize drizzle
    const db = drizzle(pool);
    
    // Run migrations from the schema
    console.log('Running Drizzle migrations...');
    await migrate(db, { migrationsFolder: join(__dirname, 'drizzle') });
    
    console.log('Database setup completed successfully using Drizzle schema.');
  } catch (error) {
    console.error('Error setting up database:', error);
    
    if (error.message.includes('does not exist')) {
      console.log('\nIt looks like the database does not exist. Please create it first with:');
      console.log('createdb recruiter_profile_manager');
      console.log('\nOr update your DATABASE_URL in .env to point to an existing database.');
    }
  } finally {
    await pool.end();
  }
}

setupDrizzle().catch((err) => {
  console.error('Database setup failed:', err);
  process.exit(1);
});
