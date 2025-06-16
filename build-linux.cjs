#!/usr/bin/env node
// build-linux.cjs - A build script specifically for Linux environments

// Apply crypto polyfill to global scope
const crypto = require('crypto');

// Apply crypto polyfill
if (!global.crypto || !global.crypto.getRandomValues) {
  try {
    // First try to use the webcrypto API if available
    if (crypto.webcrypto) {
      global.crypto = crypto.webcrypto;
      console.log('✅ Applied crypto.webcrypto polyfill');
    } else {
      // If webcrypto is not available, create a minimal polyfill
      if (!global.crypto) {
        global.crypto = {};
      }
      
      // Add getRandomValues if it doesn't exist
      if (!global.crypto.getRandomValues) {
        global.crypto.getRandomValues = function getRandomValues(array) {
          if (array === null) throw new Error('Array cannot be null');
          const bytes = crypto.randomBytes(array.byteLength);
          
          // Copy bytes into the array
          if (array instanceof Uint8Array) {
            for (let i = 0; i < bytes.length; i++) {
              array[i] = bytes[i];
            }
          } else {
            // For other TypedArray types
            const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
            for (let i = 0; i < bytes.length; i++) {
              view[i] = bytes[i];
            }
          }
          
          return array;
        };
        console.log('✅ Applied custom getRandomValues polyfill');
      }
    }
  } catch (error) {
    console.error('❌ Failed to polyfill crypto:', error);
  }
} else {
  console.log('✅ Native crypto.getRandomValues is available');
}

// Run the build process
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Create a temporary patch file for Vite
const patchContent = `
// Temporary patch for Vite to ensure crypto.getRandomValues is available
import crypto from 'crypto';

if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  if (crypto.webcrypto) {
    globalThis.crypto = crypto.webcrypto;
  } else {
    if (!globalThis.crypto) {
      globalThis.crypto = {};
    }
    
    if (!globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues = function getRandomValues(array) {
        if (array === null) throw new Error('Array cannot be null');
        const bytes = crypto.randomBytes(array.byteLength);
        
        if (array instanceof Uint8Array) {
          for (let i = 0; i < bytes.length; i++) {
            array[i] = bytes[i];
          }
        } else {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (let i = 0; i < bytes.length; i++) {
            view[i] = bytes[i];
          }
        }
        
        return array;
      };
    }
  }
  console.log('✅ Crypto polyfill applied in patch file');
}
`;

// Write the patch file
fs.writeFileSync(path.join(__dirname, 'vite-patch.js'), patchContent);

try {
  // On Linux, use a different approach
  if (process.platform === 'linux') {
    console.log('Detected Linux platform, using specialized build approach...');
    
    // First build the client with NODE_OPTIONS to inject our patch
    console.log('Building client with Vite...');
    execSync('NODE_OPTIONS="--require ./vite-patch.js" vite build', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_OPTIONS: '--require ./vite-patch.js' }
    });
  } else {
    // On other platforms, use the standard approach
    console.log('Building client with Vite...');
    execSync('vite build', { stdio: 'inherit' });
  }
  
  // Build the server code
  console.log('Building server with esbuild...');
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { 
    stdio: 'inherit' 
  });
  
  console.log('✅ Build completed successfully');
  
  // Clean up the patch file
  if (fs.existsSync(path.join(__dirname, 'vite-patch.js'))) {
    fs.unlinkSync(path.join(__dirname, 'vite-patch.js'));
  }
} catch (error) {
  console.error('❌ Build failed:', error);
  
  // Clean up the patch file even if build fails
  if (fs.existsSync(path.join(__dirname, 'vite-patch.js'))) {
    fs.unlinkSync(path.join(__dirname, 'vite-patch.js'));
  }
  
  process.exit(1);
}
