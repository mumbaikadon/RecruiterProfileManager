#!/bin/bash

# Linux deployment script with crypto polyfill support
# This script ensures proper crypto functionality during build and deployment

echo "🚀 Starting Linux deployment process..."

# Set environment variables
export NODE_ENV=production

# Ensure crypto polyfill is available
echo "Setting up crypto polyfill..."
node -e "
import crypto from 'crypto';

// Setup crypto polyfill
if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  if (crypto.webcrypto) {
    globalThis.crypto = crypto.webcrypto;
  } else {
    globalThis.crypto = globalThis.crypto || {};
    globalThis.crypto.getRandomValues = function(array) {
      const bytes = crypto.randomBytes(array.byteLength);
      if (array instanceof Uint8Array) {
        array.set(bytes);
      } else {
        const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        view.set(bytes);
      }
      return array;
    };
    globalThis.crypto.randomUUID = function() {
      const bytes = crypto.randomBytes(16);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = bytes.toString('hex');
      return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20,32)].join('-');
    };
  }
}
console.log('Crypto polyfill ready');
"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Build frontend with crypto polyfill
echo "Building frontend..."
node -e "
import('./crypto-polyfill.js').then(() => {
  const { spawn } = require('child_process');
  const build = spawn('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
  build.on('close', (code) => process.exit(code));
}).catch(err => {
  console.error('Crypto polyfill failed, trying direct build...');
  const { spawn } = require('child_process');
  const build = spawn('npx', ['vite', 'build'], { stdio: 'inherit', shell: true });
  build.on('close', (code) => process.exit(code));
});
" || {
    echo "Direct vite build as fallback..."
    npx vite build
}

# Build server
echo "Building server..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Check if build was successful
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build failed - dist/index.js not found"
    exit 1
fi

echo "✅ Build completed successfully!"
echo ""
echo "To start the production server, run:"
echo "NODE_ENV=production node dist/index.js"
echo ""
echo "Or with PM2 for process management:"
echo "pm2 start dist/index.js --name 'recruiter-app'"