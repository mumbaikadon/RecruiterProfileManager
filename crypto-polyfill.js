// crypto-polyfill.js
// This file is in CommonJS format to work with the Node.js --require flag
const crypto = require('crypto');

// Ensure crypto.getRandomValues is available globally
if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  try {
    // First try to use the webcrypto API if available
    if (crypto.webcrypto) {
      globalThis.crypto = crypto.webcrypto;
    } else {
      // If webcrypto is not available, create a minimal polyfill
      if (!globalThis.crypto) {
        globalThis.crypto = {};
      }
      
      // Add getRandomValues if it doesn't exist
      if (!globalThis.crypto.getRandomValues) {
        globalThis.crypto.getRandomValues = function getRandomValues(array) {
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
    console.log('✅ Crypto polyfill successfully applied');
  } catch (error) {
    console.error('❌ Failed to polyfill crypto:', error);
  }
} else {
  console.log('✅ Native crypto.getRandomValues is available');
}
