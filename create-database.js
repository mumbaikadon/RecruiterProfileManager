// Script to create the PostgreSQL database
import pkg from 'pg';
const { Pool } = pkg;
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file manually
const loadEnv = () => {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = envContent.split('\n')
      .filter(line => line.trim() && !line.startsWith('#'))
      .reduce((acc, line) => {
        const [key, value] = line.split('=');
        if (key && value) {
          acc[key.trim()] = value.trim();
        }
        return acc;
      }, {});
    
    // Set environment variables
    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = value;
    });
    
    console.log('Environment variables loaded from .env file');
  } catch (err) {
    console.error('Error loading .env file:', err);
  }
};

async function createDatabase() {
  // Load environment variables
  loadEnv();
  
  console.log('Creating database...');
  
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL environment variable is not set in .env file');
    process.exit(1);
  }
  
  // Parse the connection string to get database name
  const url = new URL(process.env.DATABASE_URL);
  const dbName = url.pathname.substring(1); // Remove leading slash
  
  // Create a connection to the default 'postgres' database
  const connectionString = process.env.DATABASE_URL.replace(dbName, 'postgres');
  const pool = new Pool({ connectionString });
  
  try {
    // Connect to the postgres database
    const client = await pool.connect();
    console.log('Connected to PostgreSQL server');
    
    // Check if database already exists
    const checkResult = await client.query(`
      SELECT 1 FROM pg_database WHERE datname = $1
    `, [dbName]);
    
    if (checkResult.rows.length > 0) {
      console.log(`Database '${dbName}' already exists`);
    } else {
      // Create the database
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database '${dbName}' created successfully`);
    }
    
    client.release();
  } catch (error) {
    console.error('Error creating database:', error);
  } finally {
    await pool.end();
  }
}

createDatabase().catch((err) => {
  console.error('Failed to create database:', err);
  process.exit(1);
});
