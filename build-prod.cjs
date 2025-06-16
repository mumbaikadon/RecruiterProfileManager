#!/usr/bin/env node

// Production build script that forces crypto polyfill before any other imports
require('./crypto-polyfill.cjs');

const { spawn } = require('child_process');
const path = require('path');

console.log('Starting production build with crypto polyfill...');

// Environment setup
process.env.NODE_ENV = 'production';

// Build frontend
console.log('Building frontend...');
const viteBuild = spawn('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: '--require ./crypto-polyfill.cjs'
  }
});

viteBuild.on('close', (code) => {
  if (code !== 0) {
    console.error('Frontend build failed');
    process.exit(1);
  }
  
  console.log('Frontend build complete. Building server...');
  
  // Build server
  const serverBuild = spawn('npx', ['esbuild', 'server/index.ts', 
    '--platform=node', '--packages=external', '--bundle', 
    '--format=esm', '--outdir=dist'], {
    stdio: 'inherit',
    shell: true
  });
  
  serverBuild.on('close', (serverCode) => {
    if (serverCode !== 0) {
      console.error('Server build failed');
      process.exit(1);
    }
    
    console.log('Build completed successfully');
    process.exit(0);
  });
});

viteBuild.on('error', (error) => {
  console.error('Build error:', error);
  process.exit(1);
});