// crypto-polyfill.js
// Cross-platform crypto polyfill for Windows and Linux compatibility
const crypto = require('crypto');

// Comprehensive crypto polyfill for cross-platform compatibility
function setupCrypto() {
  // First check if we already have a working crypto implementation
  if (globalThis.crypto && 
      typeof globalThis.crypto.getRandomValues === 'function' && 
      typeof globalThis.crypto.randomUUID === 'function') {
    console.log('✅ Native crypto API is fully available');
    return;
  }

  try {
    // Try to use Node.js webcrypto first (Node 16+)
    if (crypto.webcrypto && 
        typeof crypto.webcrypto.getRandomValues === 'function' && 
        typeof crypto.webcrypto.randomUUID === 'function') {
      globalThis.crypto = crypto.webcrypto;
      console.log('✅ Using Node.js webcrypto API');
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
        
        // Handle different TypedArray types
        if (array instanceof Uint8Array) {
          array.set(bytes);
        } else if (array instanceof Uint16Array || 
                   array instanceof Uint32Array || 
                   array instanceof Int8Array || 
                   array instanceof Int16Array || 
                   array instanceof Int32Array) {
          const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          view.set(bytes);
        } else {
          // Fallback for other array types
          for (let i = 0; i < bytes.length && i < array.length; i++) {
            array[i] = bytes[i];
          }
        }
        
        return array;
      };
    }

    // Polyfill randomUUID
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = function randomUUID() {
        // Generate UUID v4 using Node.js crypto.randomBytes
        const bytes = crypto.randomBytes(16);
        
        // Set version (4) and variant bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
        
        // Format as UUID string
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

    // Add subtle crypto methods if needed
    if (!globalThis.crypto.subtle && crypto.webcrypto && crypto.webcrypto.subtle) {
      globalThis.crypto.subtle = crypto.webcrypto.subtle;
    }

    console.log('✅ Crypto polyfill successfully applied for cross-platform compatibility');
    
  } catch (error) {
    console.error('❌ Failed to setup crypto polyfill:', error);
    
    // Minimal fallback for critical functions
    if (!globalThis.crypto) {
      globalThis.crypto = {};
    }
    
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = function() {
        // Simple fallback UUID generator
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  }
}

// Apply the polyfill
setupCrypto();
