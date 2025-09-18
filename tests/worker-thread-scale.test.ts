/**
 * Scale Test - Validates enterprise-scale worker thread processing
 * Tests the system's ability to handle 500+ file processing with real-time progress
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { backgroundJobManager } from '../server/background-job-manager';

// Test configuration
const SCALE_TEST_CONFIG = {
  SMALL_BATCH: 50,   // Quick validation
  MEDIUM_BATCH: 200, // Moderate load test
  LARGE_BATCH: 500,  // Enterprise scale test
  MAX_WAIT_TIME: 300000 // 5 minutes max wait
};

describe('Worker Thread Scale Testing', () => {
  
  beforeAll(async () => {
    // Ensure background job manager is started
    await backgroundJobManager.ensureStarted();
    
    // Wait a moment for worker threads to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });
  
  afterAll(async () => {
    // Clean shutdown
    await backgroundJobManager.stop();
  });
  
  test('System startup validation - All workers initialized', async () => {
    const stats = await backgroundJobManager.getStats();
    
    expect(stats.isRunning).toBe(true);
    expect(stats.workerStats.totalWorkers).toBeGreaterThanOrEqual(4);
    expect(stats.workerStats.availableWorkers).toBeGreaterThanOrEqual(4);
    expect(stats.systemHealth).toBe('healthy');
    
    console.log(`✅ System validated: ${stats.workerStats.totalWorkers} workers ready`);
  });
  
  test('Small batch processing (50 jobs) - Baseline validation', async () => {
    const sessionId = `test-session-${Date.now()}-small`;
    const jobs: Promise<any>[] = [];
    
    console.log(`🧪 Starting small batch test: ${SCALE_TEST_CONFIG.SMALL_BATCH} jobs`);
    const startTime = Date.now();
    
    // Create 50 concurrent jobs
    for (let i = 0; i < SCALE_TEST_CONFIG.SMALL_BATCH; i++) {
      const jobPromise = backgroundJobManager.createJob(
        i, // resumeId
        'extract_text',
        { 
          fileName: `test-resume-${i}.pdf`,
          sessionId: sessionId,
          content: `Mock resume content for job ${i}`
        },
        Math.floor(Math.random() * 10), // Random priority 0-9
        1 // userId
      );
      jobs.push(jobPromise);
    }
    
    // Wait for all jobs to be created
    const jobIds = await Promise.all(jobs);
    expect(jobIds).toHaveLength(SCALE_TEST_CONFIG.SMALL_BATCH);
    
    // Monitor progress
    let completed = false;
    let maxAttempts = 60; // 60 * 5 seconds = 5 minutes max
    
    while (!completed && maxAttempts > 0) {
      const progress = await backgroundJobManager.getSessionProgress(sessionId);
      const stats = await backgroundJobManager.getStats();
      
      console.log(`📊 Progress: ${progress.completed}/${progress.total} completed, ${stats.workerStats.activeWorkers} workers active`);
      
      if (progress.completed === SCALE_TEST_CONFIG.SMALL_BATCH) {
        completed = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      maxAttempts--;
    }
    
    expect(completed).toBe(true);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`✅ Small batch completed in ${duration}s (${Math.round(SCALE_TEST_CONFIG.SMALL_BATCH / duration)} jobs/sec)`);
  }, SCALE_TEST_CONFIG.MAX_WAIT_TIME);
  
  test('Medium batch processing (200 jobs) - Load validation', async () => {
    const sessionId = `test-session-${Date.now()}-medium`;
    const jobs: Promise<any>[] = [];
    
    console.log(`🧪 Starting medium batch test: ${SCALE_TEST_CONFIG.MEDIUM_BATCH} jobs`);
    const startTime = Date.now();
    
    // Create 200 concurrent jobs
    for (let i = 0; i < SCALE_TEST_CONFIG.MEDIUM_BATCH; i++) {
      const jobPromise = backgroundJobManager.createJob(
        i + 1000, // resumeId (offset to avoid conflicts)
        i % 3 === 0 ? 'extract_text' : i % 3 === 1 ? 'generate_summary' : 'analyze_content',
        { 
          fileName: `test-resume-${i}.pdf`,
          sessionId: sessionId,
          content: `Mock resume content for medium batch job ${i}`
        },
        Math.floor(Math.random() * 10), // Random priority 0-9
        2 // userId
      );
      jobs.push(jobPromise);
    }
    
    // Wait for all jobs to be created
    const jobIds = await Promise.all(jobs);
    expect(jobIds).toHaveLength(SCALE_TEST_CONFIG.MEDIUM_BATCH);
    
    // Monitor progress with enhanced logging
    let completed = false;
    let maxAttempts = 60;
    
    while (!completed && maxAttempts > 0) {
      const progress = await backgroundJobManager.getSessionProgress(sessionId);
      const stats = await backgroundJobManager.getStats();
      
      console.log(`📊 Progress: ${progress.completed}/${progress.total} completed (${Math.round(progress.completed / progress.total * 100)}%), ${stats.workerStats.activeWorkers} workers active, Queue: ${await backgroundJobManager.getQueueSize()}`);
      
      if (progress.completed === SCALE_TEST_CONFIG.MEDIUM_BATCH) {
        completed = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      maxAttempts--;
    }
    
    expect(completed).toBe(true);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`✅ Medium batch completed in ${duration}s (${Math.round(SCALE_TEST_CONFIG.MEDIUM_BATCH / duration)} jobs/sec)`);
  }, SCALE_TEST_CONFIG.MAX_WAIT_TIME);
  
  test('ENTERPRISE SCALE: Large batch processing (500+ jobs) - Production validation', async () => {
    const sessionId = `test-session-${Date.now()}-large`;
    const jobs: Promise<any>[] = [];
    
    console.log(`🚀 Starting ENTERPRISE SCALE test: ${SCALE_TEST_CONFIG.LARGE_BATCH} jobs`);
    console.log(`⚡ This validates the system's ability to handle enterprise-scale async processing`);
    const startTime = Date.now();
    
    // Create 500+ concurrent jobs with varied types and priorities
    for (let i = 0; i < SCALE_TEST_CONFIG.LARGE_BATCH; i++) {
      const jobType = i % 3 === 0 ? 'extract_text' : i % 3 === 1 ? 'generate_summary' : 'analyze_content';
      const priority = i < 50 ? 9 : i < 150 ? 7 : i < 300 ? 5 : Math.floor(Math.random() * 5); // High priority for first 50
      
      const jobPromise = backgroundJobManager.createJob(
        i + 2000, // resumeId (offset to avoid conflicts)
        jobType,
        { 
          fileName: `enterprise-resume-${i}.pdf`,
          sessionId: sessionId,
          content: `Enterprise scale mock resume content for job ${i}`,
          batchInfo: `Large batch processing - job ${i}/${SCALE_TEST_CONFIG.LARGE_BATCH}`
        },
        priority,
        3 // userId
      );
      jobs.push(jobPromise);
    }
    
    // Wait for all jobs to be created (this tests memory handling)
    console.log(`📝 Creating ${SCALE_TEST_CONFIG.LARGE_BATCH} jobs concurrently...`);
    const jobIds = await Promise.all(jobs);
    expect(jobIds).toHaveLength(SCALE_TEST_CONFIG.LARGE_BATCH);
    console.log(`✅ All ${SCALE_TEST_CONFIG.LARGE_BATCH} jobs created successfully!`);
    
    // Enhanced progress monitoring for large scale
    let completed = false;
    let maxAttempts = 60;
    let lastCompleted = 0;
    let stallCount = 0;
    
    while (!completed && maxAttempts > 0) {
      const progress = await backgroundJobManager.getSessionProgress(sessionId);
      const stats = await backgroundJobManager.getStats();
      const queueSize = await backgroundJobManager.getQueueSize();
      
      const progressPercent = Math.round(progress.completed / progress.total * 100);
      const throughput = progress.completed - lastCompleted;
      
      console.log(`📊 ENTERPRISE PROGRESS: ${progress.completed}/${progress.total} (${progressPercent}%) | Active Workers: ${stats.workerStats.activeWorkers}/${stats.workerStats.totalWorkers} | Queue: ${queueSize} | Throughput: +${throughput} jobs | Health: ${stats.systemHealth}`);
      
      // Check for stalls (no progress for consecutive checks)
      if (progress.completed === lastCompleted) {
        stallCount++;
        if (stallCount >= 3) {
          console.warn(`⚠️ Processing appears stalled. Last progress: ${progress.completed}/${progress.total}`);
        }
      } else {
        stallCount = 0;
      }
      
      lastCompleted = progress.completed;
      
      if (progress.completed === SCALE_TEST_CONFIG.LARGE_BATCH) {
        completed = true;
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 second intervals for large batch
      maxAttempts--;
    }
    
    expect(completed).toBe(true);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    const jobsPerSecond = Math.round(SCALE_TEST_CONFIG.LARGE_BATCH / duration);
    
    console.log(`🎯 ENTERPRISE SCALE TEST COMPLETED!`);
    console.log(`📈 Performance: ${SCALE_TEST_CONFIG.LARGE_BATCH} jobs in ${duration}s (${jobsPerSecond} jobs/sec)`);
    console.log(`✅ System successfully handled enterprise-scale async processing!`);
    
    // Validate final system health after large scale processing
    const finalStats = await backgroundJobManager.getStats();
    expect(finalStats.systemHealth).not.toBe('critical');
    console.log(`🏥 Final System Health: ${finalStats.systemHealth}`);
    
  }, SCALE_TEST_CONFIG.MAX_WAIT_TIME);
  
  test('System health validation post-scale testing', async () => {
    // Give system a moment to stabilize
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const stats = await backgroundJobManager.getStats();
    const queueSize = await backgroundJobManager.getQueueSize();
    
    console.log(`📋 Post-test System Status:`);
    console.log(`   Health: ${stats.systemHealth}`);
    console.log(`   Workers: ${stats.workerStats.availableWorkers}/${stats.workerStats.totalWorkers} available`);
    console.log(`   Total Jobs Processed: ${stats.totalJobsProcessed}`);
    console.log(`   Failure Rate: ${stats.failureRate}%`);
    console.log(`   Queue Size: ${queueSize}`);
    
    expect(stats.isRunning).toBe(true);
    expect(stats.workerStats.availableWorkers).toBeGreaterThan(0);
    expect(stats.failureRate).toBeLessThan(25); // Less than 25% failure rate
    expect(queueSize).toBeLessThan(100); // Queue should be mostly clear
    
    console.log(`✅ System health validated after scale testing`);
  });
});