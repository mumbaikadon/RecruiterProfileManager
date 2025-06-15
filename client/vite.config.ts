import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// Polyfill for crypto.getRandomValues
if (typeof globalThis.crypto === 'undefined' || typeof globalThis.crypto.getRandomValues !== 'function') {
  const nodeCrypto = require('crypto');
  
  // Create a proper implementation of the Crypto interface
  const cryptoPolyfill = {
    getRandomValues: <T extends ArrayBufferView | null>(buffer: T): T => {
      if (buffer !== null) {
        return nodeCrypto.randomFillSync(buffer);
      }
      return buffer;
    },
    subtle: {} as SubtleCrypto,
    randomUUID: () => nodeCrypto.randomUUID()
  };
  
  // Apply the polyfill
  if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = cryptoPolyfill as Crypto;
  } else {
    globalThis.crypto.getRandomValues = cryptoPolyfill.getRandomValues;
    if (!globalThis.crypto.randomUUID) {
      globalThis.crypto.randomUUID = cryptoPolyfill.randomUUID;
    }
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  },
  define: {
    'process.env': process.env
  }
});
