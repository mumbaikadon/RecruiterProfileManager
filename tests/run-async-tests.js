#!/usr/bin/env node

/**
 * Test runner for asynchronous file processing system tests
 * Runs all async-related test suites with proper setup and cleanup
 */

const { execSync } = require('child_process');
const path = require('path');

const testFiles = [
  'async-processing-simple.test.ts',
  'async-integration.test.ts'
];

console.log('🚀 Running Asynchronous File Processing System Tests');
console.log('=' * 60);

let allTestsPassed = true;

for (const testFile of testFiles) {
  console.log(`\n📋 Running ${testFile}...`);
  
  try {
    const result = execSync(
      `npx jest tests/${testFile} --verbose --detectOpenHandles --forceExit`,
      { 
        stdio: 'inherit',
        cwd: process.cwd(),
        env: { 
          ...process.env, 
          NODE_ENV: 'test',
          // Increase timeout for async tests
          JEST_TIMEOUT: '30000'
        }
      }
    );
    console.log(`✅ ${testFile} passed`);
  } catch (error) {
    console.error(`❌ ${testFile} failed`);
    allTestsPassed = false;
  }
}

console.log('\n' + '=' * 60);
if (allTestsPassed) {
  console.log('🎉 All async processing tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some tests failed. Check the output above for details.');
  process.exit(1);
}