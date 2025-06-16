#!/usr/bin/env node

/**
 * Cross-platform startup script with crypto polyfill
 * This ensures proper crypto functionality on both Windows and Linux
 */

// Load the crypto polyfill first
require('./crypto-polyfill.js');

// Load environment variables
require('dotenv/config');

// Determine which script to run based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isLocal = process.argv.includes('--local');

if (isDevelopment) {
  if (isLocal) {
    console.log('🚀 Starting local development server with crypto polyfill...');
    require('child_process').spawn('npx', ['tsx', 'server/local-index.ts'], {
      stdio: 'inherit',
      shell: true
    });
  } else {
    console.log('🚀 Starting development server with crypto polyfill...');
    require('child_process').spawn('npx', ['tsx', 'server/index.ts'], {
      stdio: 'inherit',
      shell: true
    });
  }
} else {
  console.log('🚀 Starting production server with crypto polyfill...');
  require('child_process').spawn('node', ['dist/index.js'], {
    stdio: 'inherit'
  });
}