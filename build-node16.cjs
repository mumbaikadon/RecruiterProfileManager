#!/usr/bin/env node

// Node 16 specific build script
const { spawn } = require('child_process');

console.log('Building for Node 16 environment...');

// Set environment
process.env.NODE_ENV = 'production';

// Build frontend without crypto polyfill interference
console.log('Building frontend...');
const viteBuild = spawn('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    // Disable crypto usage in Vite
    NODE_OPTIONS: '--no-experimental-fetch'
  }
});

viteBuild.on('close', (code) => {
  if (code !== 0) {
    console.log('Vite build failed, trying alternative approach...');
    
    // Try alternative build with older Node flags
    const altBuild = spawn('node', ['--no-experimental-fetch', './node_modules/.bin/vite', 'build'], {
      stdio: 'inherit',
      shell: true
    });
    
    altBuild.on('close', (altCode) => {
      if (altCode !== 0) {
        console.error('All frontend build attempts failed');
        process.exit(1);
      }
      buildServer();
    });
    
    return;
  }
  
  buildServer();
});

function buildServer() {
  console.log('Building server...');
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
}