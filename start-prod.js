#!/usr/bin/env node

// Production startup script with forced crypto polyfill
require('./crypto-polyfill.cjs');

console.log('Starting production server with crypto polyfill...');

// Import and start the server
import('./dist/index.js').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});