#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set test environment
process.env.NODE_ENV = 'test';

// Jest command with ESM support
const jestArgs = [
  '--preset=ts-jest/presets/default-esm',
  '--extensionsToTreatAsEsm=.ts',
  '--experimental-vm-modules',
  '--testTimeout=30000',
  ...process.argv.slice(2) // Pass any additional arguments
];

console.log('Running tests with Node.js ESM support...');
console.log('Jest args:', jestArgs.join(' '));

const jest = spawn('npx', ['jest', ...jestArgs], {
  cwd: __dirname,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_OPTIONS: '--experimental-vm-modules --experimental-specifier-resolution=node'
  }
});

jest.on('close', (code) => {
  process.exit(code);
});

jest.on('error', (err) => {
  console.error('Failed to start Jest:', err);
  process.exit(1);
});