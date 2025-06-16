// crypto-polyfill.cjs - CommonJS version for maximum compatibility
const crypto = require('crypto');

// Global crypto polyfill that works in all Node.js environments
function setupGlobalCrypto() {
  // Skip if already properly configured
  if (globalThis.crypto && 
      typeof globalThis.crypto.getRandomValues === 'function' && 
      typeof globalThis.crypto.randomUUID === 'function') {
    return;
  }

  try {
    // Primary: Use Node.js webcrypto (Node 16+)
    if (crypto.webcrypto && 
        typeof crypto.webcrypto.getRandomValues === 'function' && 
        typeof crypto.webcrypto.randomUUID === 'function') {
      globalThis.crypto = crypto.webcrypto;
      console.log('✅ Using Node.js webcrypto');
      return;
    }
  } catch (e) {
    // Continue to polyfill
  }

  // Fallback: Create comprehensive polyfill
  const cryptoImpl = {};

  // getRandomValues implementation
  cryptoImpl.getRandomValues = function(array) {
    if (!array || typeof array.byteLength !== 'number') {
      throw new TypeError('Expected a TypedArray');
    }
    
    const bytes = crypto.randomBytes(array.byteLength);
    
    // Handle all TypedArray types
    if (array instanceof Uint8Array) {
      array.set(bytes);
    } else if (array instanceof Uint16Array) {
      const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      view.set(bytes);
    } else if (array instanceof Uint32Array) {
      const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      view.set(bytes);
    } else {
      // Generic fallback
      for (let i = 0; i < Math.min(bytes.length, array.length); i++) {
        array[i] = bytes[i];
      }
    }
    
    return array;
  };

  // randomUUID implementation
  cryptoImpl.randomUUID = function() {
    const bytes = crypto.randomBytes(16);
    
    // Set version and variant bits for UUID v4
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

  // Set on globalThis
  Object.defineProperty(globalThis, 'crypto', {
    value: cryptoImpl,
    writable: false,
    configurable: true
  });

  console.log('✅ Crypto polyfill applied');
}

// Apply immediately when required
setupGlobalCrypto();

module.exports = { setupGlobalCrypto };