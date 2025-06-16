#!/usr/bin/env node

/**
 * Linux-specific build script with crypto polyfill
 * This ensures crypto functionality works during the build process on Linux
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Apply comprehensive crypto polyfill for build process
function setupBuildCrypto() {
  console.log('Setting up crypto polyfill for Linux build...');
  
  // Check if crypto is already properly set up
  if (globalThis.crypto && 
      typeof globalThis.crypto.getRandomValues === 'function' && 
      typeof globalThis.crypto.randomUUID === 'function') {
    console.log('✅ Native crypto API available for build');
    return;
  }

  try {
    // Use Node.js webcrypto if available
    if (crypto.webcrypto && 
        typeof crypto.webcrypto.getRandomValues === 'function' && 
        typeof crypto.webcrypto.randomUUID === 'function') {
      globalThis.crypto = crypto.webcrypto;
      console.log('✅ Using Node.js webcrypto for build');
      return;
    }

    // Create polyfill implementation
    if (!globalThis.crypto) {
      globalThis.crypto = {};
    }

    // Polyfill getRandomValues
    if (!globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues = function getRandomValues(array) {
        if (!array || typeof array.byteLength !== 'number') {
          throw new TypeError('Expected a TypedArray');
        }
        
        const bytes = crypto.randomBytes(array.byteLength);
        
        if (array instanceof Uint8Array) {
          array.set(bytes);
        } else {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          view.set(bytes);
        }
        
        return array;
      };
    }

    // Polyfill randomUUID
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = function randomUUID() {
        const bytes = crypto.randomBytes(16);
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
        const hex = bytes.toString('hex');
        return [
          hex.slice(0, 8),
          hex.slice(8, 12),
          hex.slice(12, 16),
          hex.slice(16, 20),
          hex.slice(20, 32)
        ].join('-');
      };
    }

    console.log('✅ Crypto polyfill applied for build process');
    
  } catch (error) {
    console.error('❌ Failed to setup build crypto:', error);
    
    // Minimal fallback
    if (!globalThis.crypto) {
      globalThis.crypto = {};
    }
    
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  }
}

// Setup crypto before running build
setupBuildCrypto();

console.log('🚀 Starting Linux build process...');

// Run the vite build
const viteBuild = spawn('npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

viteBuild.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Frontend build completed successfully');
    
    // Run the server build
    console.log('🚀 Building server...');
    const serverBuild = spawn('npx', ['esbuild', 'server/index.ts', '--platform=node', '--packages=external', '--bundle', '--format=esm', '--outdir=dist'], {
      stdio: 'inherit',
      shell: true,
      cwd: __dirname
    });
    
    serverBuild.on('close', (serverCode) => {
      if (serverCode === 0) {
        console.log('✅ Server build completed successfully');
        console.log('✅ Build process completed! Ready for deployment.');
        process.exit(0);
      } else {
        console.error('❌ Server build failed');
        process.exit(1);
      }
    });
  } else {
    console.error('❌ Frontend build failed');
    process.exit(1);
  }
});

viteBuild.on('error', (error) => {
  console.error('❌ Build process error:', error);
  process.exit(1);
});