#!/usr/bin/env node
// vite-patched.cjs - A patched version of the Vite CLI with crypto polyfill

// Apply crypto polyfill BEFORE requiring any modules
const crypto = require('crypto');

// Apply crypto polyfill to global scope
if (!global.crypto || !global.crypto.getRandomValues) {
  try {
    // First try to use the webcrypto API if available
    if (crypto.webcrypto) {
      global.crypto = crypto.webcrypto;
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
      }
    }
    console.log('✅ Crypto polyfill successfully applied to global scope');
  } catch (error) {
    console.error('❌ Failed to polyfill crypto:', error);
  }
} else {
  console.log('✅ Native crypto.getRandomValues is available');
}

// Now run the actual Vite CLI
// Find the path to the Vite CLI
const path = require('path');
const fs = require('fs');

// Get the path to the Vite CLI
const vitePath = path.resolve(__dirname, 'node_modules', 'vite', 'bin', 'vite.js');

if (!fs.existsSync(vitePath)) {
  console.error(`❌ Could not find Vite CLI at ${vitePath}`);
  process.exit(1);
}

// Execute the Vite CLI with the same arguments
require(vitePath);
