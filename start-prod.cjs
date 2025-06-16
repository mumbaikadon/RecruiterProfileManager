#!/usr/bin/env node

// Production startup script with forced crypto polyfill
require('./crypto-polyfill.cjs');

console.log('Starting production server with crypto polyfill...');

// Start the server using spawn to handle ES modules properly
const { spawn } = require('child_process');

const server = spawn('node', ['--require', './crypto-polyfill.cjs', 'dist/index.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});