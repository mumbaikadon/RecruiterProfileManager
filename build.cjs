// build.cjs - A custom build script that applies the crypto polyfill before running Vite
const crypto = require('crypto');

// Apply crypto polyfill
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

// Run the build process
const { execSync } = require('child_process');

try {
  console.log('Starting Vite build...');
  execSync('vite build', { stdio: 'inherit' });
  
  console.log('Building server with esbuild...');
  execSync('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
