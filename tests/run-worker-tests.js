#!/usr/bin/env node
/**
 * Test Runner for PDF Worker Configuration Tests
 * Specifically tests the fix for the "No GlobalWorkerOptions.workerSrc specified" error
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running PDF.js Worker Configuration Tests...\n');

const tests = [
  {
    name: 'PDF Worker Configuration Tests',
    file: 'pdf-worker-config.test.ts',
    description: 'Tests the specific worker configuration fix that resolves production failures'
  },
  {
    name: 'Document Parser Edge Cases',
    file: 'document-parser-edge-cases.test.ts', 
    description: 'Tests various edge cases and error conditions'
  },
  {
    name: 'Existing PDF.js Tests',
    file: 'document-parser-pdfjs.test.ts',
    description: 'Runs existing comprehensive PDF.js tests'
  }
];

let totalPassed = 0;
let totalFailed = 0;

for (const test of tests) {
  console.log(`\n🔍 ${test.name}`);
  console.log(`📝 ${test.description}\n`);
  
  try {
    // Run the specific test file
    const testPath = path.join(__dirname, test.file);
    const result = execSync(`npm test -- ${testPath} --verbose`, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 60000
    });
    
    console.log('✅ PASSED');
    console.log(result);
    totalPassed++;
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log(error.stdout || error.message);
    totalFailed++;
  }
  
  console.log('\n' + '='.repeat(80));
}

console.log(`\n📊 Test Summary:`);
console.log(`   ✅ Passed: ${totalPassed}`);
console.log(`   ❌ Failed: ${totalFailed}`);
console.log(`   📋 Total:  ${totalPassed + totalFailed}`);

if (totalFailed === 0) {
  console.log('\n🎉 All PDF worker configuration tests passed!');
  console.log('The fix for "No GlobalWorkerOptions.workerSrc specified" is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Check the output above for details.');
  process.exit(1);
}