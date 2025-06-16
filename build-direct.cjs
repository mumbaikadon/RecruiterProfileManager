#!/usr/bin/env node

// Direct build approach that bypasses Vite's crypto issues
require('./crypto-polyfill.cjs');

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting direct build process...');

// First, let's try to build without crypto-sensitive operations
process.env.NODE_ENV = 'production';

// Create a minimal vite config override
const viteConfigOverride = `
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  root: path.resolve(__dirname, "client"),
  plugins: [react()],
  resolve: {
    alias: {
      crypto: false, // Disable crypto during build
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  define: {
    global: "globalThis",
    "process.env.NODE_ENV": '"production"',
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      external: ['crypto']
    }
  },
});
`;

// Write temporary vite config
fs.writeFileSync('vite.config.temp.js', viteConfigOverride);

console.log('Building frontend with crypto-disabled config...');

// Build frontend with the temporary config
const viteBuild = spawn('npx', ['vite', 'build', '--config', 'vite.config.temp.js'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DISABLE_CRYPTO: 'true'
  }
});

viteBuild.on('close', (code) => {
  // Clean up temp config
  try {
    fs.unlinkSync('vite.config.temp.js');
  } catch (e) {}
  
  if (code !== 0) {
    console.error('Frontend build failed');
    process.exit(1);
  }
  
  console.log('Frontend build complete. Building server...');
  
  // Build server
  const serverBuild = spawn('npx', ['esbuild', 'server/index.ts', 
    '--platform=node', '--packages=external', '--bundle', 
    '--format=esm', '--outdir=dist'], {
    stdio: 'inherit',
    shell: true
  });
  
  serverBuild.on('close', (serverCode) => {
    if (serverCode !== 0) {
      console.error('Server build failed');
      process.exit(1);
    }
    
    console.log('✅ Build completed successfully');
    process.exit(0);
  });
});

viteBuild.on('error', (error) => {
  // Clean up temp config
  try {
    fs.unlinkSync('vite.config.temp.js');
  } catch (e) {}
  console.error('Build error:', error);
  process.exit(1);
});