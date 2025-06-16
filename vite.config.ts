// vite.config.ts at root
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Polyfill crypto for both Windows and Linux environments
if (!globalThis.crypto || !globalThis.crypto.getRandomValues) {
  try {
    // First try to use the webcrypto API if available
    if (crypto.webcrypto) {
      // @ts-ignore
      globalThis.crypto = crypto.webcrypto;
    } else {
      // If webcrypto is not available, create a minimal polyfill
      if (!globalThis.crypto) {
        // @ts-ignore
        globalThis.crypto = {};
      }
      
      // Add getRandomValues if it doesn't exist
      if (!globalThis.crypto.getRandomValues) {
        // @ts-ignore - Properly type the crypto polyfill
        globalThis.crypto.getRandomValues = function getRandomValues(array) {
          if (array === null) throw new Error('Array cannot be null');
          const bytes = crypto.randomBytes(array.byteLength);
          
          // Copy bytes into the array using a more type-safe approach
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
  } catch (error) {
    console.error('Failed to polyfill crypto:', error);
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      crypto: "crypto-browserify",
      stream: "stream-browserify",
      buffer: "buffer/",
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
    "process.env.API_URL": JSON.stringify(process.env.API_URL),
  },
  optimizeDeps: {
    include: ["crypto", "buffer"],
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
