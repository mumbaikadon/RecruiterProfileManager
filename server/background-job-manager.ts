/**
 * Background Job Manager - Orchestrates all background processing systems
 * Integrates job scheduler and worker threads with application lifecycle
 */

import { jobScheduler } from './job-scheduler';
// Worker thread stats exposed via jobScheduler only for consistency

interface JobManagerStats {
  isRunning: boolean;
  uptime: number;
  totalJobsProcessed: number;
  failureRate: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  schedulerStats: any;
  workerStats: {
    totalWorkers: number;
    activeWorkers: number;
    availableWorkers: number;
  };
}

class BackgroundJobManager {
  private startTime: Date | null = null;
  private totalJobsProcessed = 0;
  private totalJobsFailed = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor() {
    // Setup graceful shutdown handling
    this.setupGracefulShutdown();
  }

  async start() {
    if (this.startTime) {
      console.log('🔄 Background Job Manager already running');
      return;
    }

    console.log('🚀 Starting Background Job Manager...');
    this.startTime = new Date();

    try {
      // Start the enhanced job scheduler
      await jobScheduler.start();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Log system configuration
      this.logSystemConfiguration();
      
      console.log('✅ Background Job Manager started successfully');
      
    } catch (error) {
      console.error('❌ Failed to start Background Job Manager:', error);
      throw error;
    }
  }

  async stop() {
    if (this.isShuttingDown) {
      console.log('⏳ Background Job Manager shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    console.log('🔄 Stopping Background Job Manager...');

    try {
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop job scheduler (this will also stop worker threads)
      await jobScheduler.stop();

      console.log('✅ Background Job Manager stopped successfully');
      this.startTime = null;
      this.isShuttingDown = false;

    } catch (error) {
      console.error('❌ Error stopping Background Job Manager:', error);
      this.isShuttingDown = false;
      throw error;
    }
  }

  async restart() {
    console.log('🔄 Restarting Background Job Manager...');
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    await this.start();
    console.log('✅ Background Job Manager restarted');
  }

  // Idempotent start method for safety - can be called multiple times
  async ensureStarted() {
    if (!this.startTime && !this.isShuttingDown) {
      console.log('🔧 Ensuring Background Job Manager is started...');
      await this.start();
    }
    return this.isRunning();
  }

  private setupGracefulShutdown() {
    // Handle SIGTERM (docker/kubernetes shutdown)
    process.on('SIGTERM', async () => {
      console.log('📡 Received SIGTERM - initiating graceful shutdown...');
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      console.log('⌨️ Received SIGINT - initiating graceful shutdown...');
      try {
        await this.stop();
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught exception in Background Job Manager:', error);
      try {
        await this.stop();
      } catch (stopError) {
        console.error('❌ Error during emergency shutdown:', stopError);
      }
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      console.error('⚠️ Unhandled rejection in Background Job Manager:', reason);
      // Don't exit on unhandled rejection, just log it
    });
  }

  private startHealthMonitoring() {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        
        if (health.systemHealth === 'critical') {
          console.error('🚨 CRITICAL: Background job system health is critical!', health);
          // Could trigger alerts or automatic restart here
        } else if (health.systemHealth === 'degraded') {
          console.warn('⚠️ WARNING: Background job system health is degraded', health);
        }
        
        // Log periodic status (every 5 minutes)
        if (Date.now() % (5 * 60 * 1000) < 30000) {
          this.logHealthStatus(health);
        }
        
      } catch (error) {
        console.error('❌ Error during health check:', error);
      }
    }, 30000);
  }

  private logSystemConfiguration() {
    const config = jobScheduler.getConfig();
    console.log('📊 Background Job System Configuration:', {
      maxConcurrentJobs: config.maxConcurrentJobs,
      workerThreads: config.workerThreads,
      batchSize: config.batchSize,
      pollInterval: `${config.pollIntervalMs}ms`,
      priorityProcessing: config.enablePriorityProcessing
    });
  }

  private logHealthStatus(health: JobManagerStats) {
    const uptimeMinutes = Math.floor(health.uptime / 60);
    console.log(`📈 Background Job System Status - Uptime: ${uptimeMinutes}m | Health: ${health.systemHealth} | Jobs: ${health.totalJobsProcessed} processed | Workers: ${health.workerStats.activeWorkers}/${health.workerStats.totalWorkers} active`);
  }

  // Public API methods
  async getStats(): Promise<JobManagerStats> {
    const schedulerStats = jobScheduler.getStats();
    this.totalJobsProcessed = schedulerStats.completedJobs + schedulerStats.failedJobs;
    this.totalJobsFailed = schedulerStats.failedJobs;

    const uptime = this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0;
    const failureRate = this.totalJobsProcessed > 0 ? (this.totalJobsFailed / this.totalJobsProcessed) * 100 : 0;

    return {
      isRunning: !!this.startTime,
      uptime,
      totalJobsProcessed: this.totalJobsProcessed,
      failureRate: Math.round(failureRate * 100) / 100,
      systemHealth: this.calculateSystemHealth(schedulerStats, failureRate),
      schedulerStats,
      workerStats: {
        totalWorkers: schedulerStats.availableWorkers + schedulerStats.activeWorkers, 
        activeWorkers: schedulerStats.activeWorkers,
        availableWorkers: schedulerStats.availableWorkers
      }
    };
  }

  private calculateSystemHealth(schedulerStats: any, failureRate: number): JobManagerStats['systemHealth'] {
    // Critical conditions
    if (schedulerStats.availableWorkers === 0 && schedulerStats.pendingJobs > 50) {
      return 'critical'; // No workers available with large backlog
    }
    
    if (failureRate > 50) {
      return 'critical'; // More than 50% failure rate
    }
    
    // Degraded conditions
    if (schedulerStats.availableWorkers < 2 && schedulerStats.pendingJobs > 20) {
      return 'degraded'; // Low workers with significant backlog
    }
    
    if (failureRate > 15) {
      return 'degraded'; // More than 15% failure rate
    }
    
    if (schedulerStats.averageProcessingTime > 60000) {
      return 'degraded'; // Average processing time over 1 minute
    }
    
    return 'healthy';
  }

  async checkHealth(): Promise<JobManagerStats> {
    return this.getStats();
  }

  // Convenience methods for external systems
  async createJob(
    resumeId: number,
    jobType: 'extract_text' | 'generate_summary' | 'analyze_content',
    processingData: any,
    priority: number = 0,
    userId?: number
  ) {
    return jobScheduler.createJob(resumeId, jobType, processingData, priority, userId);
  }

  async getSessionProgress(sessionId: string) {
    return jobScheduler.getSessionProgress(sessionId);
  }

  async getQueueSize() {
    return jobScheduler.getQueueSize();
  }

  // Utility methods for system management
  async pauseProcessing() {
    console.log('⏸️ Pausing job processing...');
    await jobScheduler.stop();
  }

  async resumeProcessing() {
    console.log('▶️ Resuming job processing...');
    await jobScheduler.start();
  }

  isRunning(): boolean {
    return !!this.startTime && !this.isShuttingDown;
  }

  getUptime(): number {
    return this.startTime ? (Date.now() - this.startTime.getTime()) / 1000 : 0;
  }
}

// Export singleton instance
export const backgroundJobManager = new BackgroundJobManager();

// Auto-start temporarily disabled for debugging worker threads
// Enhanced background job manager will be started manually for now
if (process.env.NODE_ENV !== 'test' && process.env.START_BACKGROUND_MANAGER === 'true') {
  // Log startup message first
  console.log(`
🎯 RecruiterTracker Background Processing System
===============================================
🔧 Worker Threads: ${process.env.MAX_WORKER_THREADS || '4'}
📊 Max Concurrent Jobs: ${process.env.MAX_CONCURRENT_JOBS || '8'}
⚡ High-Volume Processing: Ready for 500+ files
🚀 System Status: Starting...
===============================================
  `);

  // Start the background job manager with better error handling
  setTimeout(async () => {
    try {
      await backgroundJobManager.start();
      console.log('✅ Enhanced Background Job Manager successfully initialized');
    } catch (error) {
      console.error('⚠️  Failed to start Background Job Manager, running without enhanced processing:', error.message);
      // Don't exit the process - allow the application to continue without background processing
    }
  }, 1000); // Delay startup by 1 second to allow other systems to initialize first
} else {
  console.log('📋 Enhanced Background Job Manager available but not auto-started');
  console.log('💡 To enable: Set environment variable START_BACKGROUND_MANAGER=true');
}