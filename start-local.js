// Simple script to check environment setup and start the application
import { config } from 'dotenv';
import fs from 'fs';
import { exec } from 'child_process';

// Load environment variables from .env file
const result = config();

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Check if OpenAI API key is set
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: OpenAI API key is not set!');
  console.log('\x1b[33m%s\x1b[0m', 'Please edit the .env file and add your OpenAI API key.');
  console.log('You can get an API key from https://platform.openai.com/api-keys');
  process.exit(1);
}

console.log('\x1b[32m%s\x1b[0m', '✓ OpenAI API key is set');

// Check for database configuration
if (!process.env.DATABASE_URL) {
  console.warn('\x1b[33m%s\x1b[0m', 'Warning: DATABASE_URL is not set. Database functionality may not work properly.');
}

// Start the application in development mode
console.log('\x1b[36m%s\x1b[0m', 'Starting the application in development mode...');
const child = exec('npm run dev', (error) => {
  if (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Failed to start the application:', error);
    process.exit(1);
  }
});

// Pipe the child process output to the parent process
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

console.log('\x1b[36m%s\x1b[0m', 'Press Ctrl+C to stop the application');
