/**
 * Enhanced Job Scheduler for High-Volume File Processing
 * Manages worker threads and job queue for processing 500+ files efficiently
 */

import { db } from "./db";
import { processingJobs, profileResumes, uploadSessions } from "@shared/schema";
import { eq, or, and, inArray, lte, desc, count } from "drizzle-orm";
import {
  WorkerThreadManager,
  createWorkerThreadManager,
} from "./worker-thread";

interface JobSchedulerConfig {
  maxConcurrentJobs: number;
  pollIntervalMs: number;
  batchSize: number;
  workerThreads: number;
  retryDelayMs: number;
  maxRetryDelay: number;
  enablePriorityProcessing: boolean;
}

interface SchedulerStats {
  totalJobs: number;
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  activeWorkers: number;
  availableWorkers: number;
  averageProcessingTime: number;
  queueThroughput: number;
}

interface SessionProgress {
  sessionId: string;
  total: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  percentage: number;
  status: "uploading" | "processing" | "completed" | "failed";
}

class JobScheduler {
  private config: JobSchedulerConfig;
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private workerManager: WorkerThreadManager;
  private processingJobIds = new Set<number>();
  private stats: SchedulerStats;
  private processingTimes: number[] = [];
  private jobsProcessedLastMinute = 0;
  private lastThroughputReset = Date.now();

  constructor(config: Partial<JobSchedulerConfig> = {}) {
    this.config = {
      maxConcurrentJobs: config.maxConcurrentJobs || 8,
      pollIntervalMs: config.pollIntervalMs || 5000, // Check every 5 seconds - optimized to prevent DB pool exhaustion
      batchSize: config.batchSize || 10, // Process 10 jobs per batch
      workerThreads: config.workerThreads || 4,
      retryDelayMs: config.retryDelayMs || 5000, // 5 seconds initial delay
      maxRetryDelay: config.maxRetryDelay || 60000, // Max 60 seconds delay
      enablePriorityProcessing: config.enablePriorityProcessing ?? true,
      ...config,
    };

    this.workerManager = createWorkerThreadManager(this.config.workerThreads);
    this.stats = this.initializeStats();

    console.log(`📊 Job Scheduler configured:`, {
      maxConcurrentJobs: this.config.maxConcurrentJobs,
      workerThreads: this.config.workerThreads,
      batchSize: this.config.batchSize,
    });
  }

  private initializeStats(): SchedulerStats {
    return {
      totalJobs: 0,
      pendingJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      activeWorkers: 0,
      availableWorkers: this.config.workerThreads,
      averageProcessingTime: 0,
      queueThroughput: 0,
    };
  }

  async start() {
    if (this.isRunning) {
      console.log("📋 Job Scheduler already running");
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting Enhanced Job Scheduler...");

    // Process any pending jobs immediately
    await this.processJobBatch();

    // Start periodic processing
    this.pollInterval = setInterval(async () => {
      try {
        await this.processJobBatch();
        await this.updateStats();
        await this.updateSessionStatuses();
        await this.cleanupOldJobs();
      } catch (error) {
        console.error("❌ Error in job scheduler:", error);
      }
    }, this.config.pollIntervalMs);

    console.log("✅ Enhanced Job Scheduler started");
  }

  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isRunning = false;

    // Wait for current jobs to complete
    console.log("⏳ Waiting for current jobs to complete...");
    const maxWait = 30000; // 30 seconds max
    const startTime = Date.now();

    while (this.processingJobIds.size > 0 && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await this.workerManager.shutdown();
    console.log("⏹️ Enhanced Job Scheduler stopped");
  }

  private async processJobBatch() {
    try {
      // Calculate how many jobs we can process
      const availableSlots = Math.min(
        this.config.maxConcurrentJobs - this.processingJobIds.size,
        this.workerManager.getAvailableWorkers(),
        this.config.batchSize,
      );

      if (availableSlots <= 0) {
        return; // No capacity for new jobs
      }

      // Get pending jobs with priority ordering
      const whereClause = or(
        eq(processingJobs.status, "pending"),
        and(
          eq(processingJobs.status, "retrying"),
          lte(processingJobs.retryAt, new Date()),
        ),
      );

      const pendingJobs = await db
        .select()
        .from(processingJobs)
        .where(whereClause)
        .orderBy(
          this.config.enablePriorityProcessing
            ? desc(processingJobs.priority)
            : processingJobs.createdAt,
          processingJobs.createdAt,
        )
        .limit(availableSlots);

      if (pendingJobs.length === 0) {
        return; // No jobs to process
      }

      console.log(`📋 Processing batch of ${pendingJobs.length} job(s)...`);

      // Process jobs concurrently using worker threads
      const jobPromises = pendingJobs.map((job) =>
        this.processJobWithWorker(job),
      );
      await Promise.allSettled(jobPromises);
    } catch (error) {
      console.error("❌ Error processing job batch:", error);
    }
  }

  private async processJobWithWorker(job: any) {
    const jobId = job.id;
    this.processingJobIds.add(jobId);

    try {
      // Mark job as processing
      await db
        .update(processingJobs)
        .set({
          status: "processing",
          startedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));

      console.log(
        `⚙️ Processing job ${jobId} for resume ${job.profileResumeId}`,
      );

      // Get resume details for processing
      const resume = await db
        .select()
        .from(profileResumes)
        .where(eq(profileResumes.id, job.profileResumeId))
        .limit(1);

      if (resume.length === 0) {
        throw new Error(`Resume ${job.profileResumeId} not found`);
      }

      // Parse processing data
      const processingData = JSON.parse(job.processingData || "{}");

      // Prepare job data for worker thread
      const workerJobData = {
        jobId: jobId,
        resumeId: job.profileResumeId,
        filePath: processingData.filePath || resume[0].filePath,
        fileName: resume[0].filename,
        fileType: resume[0].fileType,
        fileSize: resume[0].fileSize,
        candidateName: processingData.candidateName,
        candidateEmail: processingData.candidateEmail,
        jobType: job.jobType,
      };

      // Files are already on disk, no need to create temp file
      // (processingData.filePath or resume.filePath points to actual file)

      // Process job in worker thread
      const startTime = Date.now();
      const result = await this.workerManager.processJob(workerJobData);
      const processingTime = Date.now() - startTime;

      // Track processing time for statistics
      this.processingTimes.push(processingTime);
      if (this.processingTimes.length > 1000) {
        this.processingTimes = this.processingTimes.slice(-1000); // Keep last 1000
      }

      if (result.success) {
        // Mark job as completed
        await db
          .update(processingJobs)
          .set({
            status: "completed",
            completedAt: new Date(),
          })
          .where(eq(processingJobs.id, jobId));

        // Update resume processing status
        await db
          .update(profileResumes)
          .set({ processingStatus: "completed" })
          .where(eq(profileResumes.id, job.profileResumeId));

        console.log(
          `✅ Job ${jobId} completed successfully in ${processingTime}ms`,
        );
        this.jobsProcessedLastMinute++;
      } else {
        await this.handleJobFailure(
          job,
          result.error || "Worker processing failed",
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await this.handleJobFailure(job, errorMessage);
    } finally {
      this.processingJobIds.delete(jobId);
    }
  }

  private async createTempFileForWorker(resume: any, tempPath: string) {
    // Convert base64 file data to temporary file
    const fs = await import("fs/promises");
    const buffer = Buffer.from(resume.fileData, "base64");
    await fs.writeFile(tempPath, buffer);
  }

  private async handleJobFailure(job: any, errorMessage: string) {
    const jobId = job.id;
    const shouldRetry = job.retryCount < job.maxRetries;

    console.error(`❌ Job ${jobId} failed: ${errorMessage}`);

    if (shouldRetry) {
      // Calculate retry delay with exponential backoff
      const retryDelay = Math.min(
        this.config.retryDelayMs * Math.pow(2, job.retryCount),
        this.config.maxRetryDelay,
      );

      await db
        .update(processingJobs)
        .set({
          status: "retrying",
          retryCount: job.retryCount + 1,
          errorMessage,
          retryAt: new Date(Date.now() + retryDelay), // Schedule retry
        })
        .where(eq(processingJobs.id, jobId));

      console.log(
        `🔄 Job ${jobId} scheduled for retry ${job.retryCount + 1}/${job.maxRetries} in ${retryDelay}ms`,
      );
    } else {
      // Mark as permanently failed
      await db
        .update(processingJobs)
        .set({
          status: "failed",
          errorMessage,
          completedAt: new Date(),
        })
        .where(eq(processingJobs.id, jobId));

      // Mark resume as failed
      await db
        .update(profileResumes)
        .set({ processingStatus: "failed" })
        .where(eq(profileResumes.id, job.profileResumeId));

      console.log(
        `💀 Job ${jobId} permanently failed after ${job.retryCount} retries`,
      );
    }
  }

  private getRetryDelay(): number {
    return this.config.retryDelayMs;
  }

  private async updateStats() {
    try {
      const jobStats = await db
        .select({
          status: processingJobs.status,
          count: count(),
        })
        .from(processingJobs)
        .groupBy(processingJobs.status);

      const statsMap = new Map(
        jobStats.map((s) => [s.status, Number(s.count)]),
      );

      this.stats = {
        totalJobs: Array.from(statsMap.values()).reduce(
          (sum, count) => sum + count,
          0,
        ),
        pendingJobs: statsMap.get("pending") || 0,
        processingJobs: statsMap.get("processing") || 0,
        completedJobs: statsMap.get("completed") || 0,
        failedJobs: statsMap.get("failed") || 0,
        activeWorkers: this.workerManager.getActiveJobs(),
        availableWorkers: this.workerManager.getAvailableWorkers(),
        averageProcessingTime:
          this.processingTimes.length > 0
            ? Math.round(
                this.processingTimes.reduce((sum, time) => sum + time, 0) /
                  this.processingTimes.length,
              )
            : 0,
        queueThroughput: this.jobsProcessedLastMinute,
      };

      // Reset throughput counter every minute
      const now = Date.now();
      if (now - this.lastThroughputReset > 60000) {
        this.jobsProcessedLastMinute = 0;
        this.lastThroughputReset = now;
      }
    } catch (error) {
      console.error("❌ Error updating stats:", error);
    }
  }

  private async updateSessionStatuses() {
    try {
      // Get all processing sessions
      const processingSessions = await db
        .select()
        .from(uploadSessions)
        .where(eq(uploadSessions.status, "processing"));

      for (const session of processingSessions) {
        const progress = await this.getSessionProgress(session.sessionId);

        // Update session status if completed
        if (progress.percentage === 100) {
          await db
            .update(uploadSessions)
            .set({
              status: "completed",
              processedFiles: progress.completed + progress.failed,
            })
            .where(eq(uploadSessions.sessionId, session.sessionId));
        } else {
          // Update progress fields
          await db
            .update(uploadSessions)
            .set({
              processedFiles: progress.completed + progress.failed,
              failedFiles: progress.failed,
            })
            .where(eq(uploadSessions.sessionId, session.sessionId));
        }
      }
    } catch (error) {
      console.error("❌ Error updating session statuses:", error);
    }
  }

  private async cleanupOldJobs() {
    try {
      // Clean up completed jobs older than 24 hours
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const cleanedUp = await db
        .delete(processingJobs)
        .where(
          and(
            or(
              eq(processingJobs.status, "completed"),
              eq(processingJobs.status, "failed"),
            ),
            lte(processingJobs.completedAt, cutoffTime),
          ),
        )
        .returning({ id: processingJobs.id });

      if (cleanedUp.length > 0) {
        console.log(`🧹 Cleaned up ${cleanedUp.length} old jobs`);
      }
    } catch (error) {
      console.error("❌ Error cleaning up old jobs:", error);
    }
  }

  // Public API methods
  async createJob(
    profileResumeId: number,
    jobType: "extract_text" | "generate_summary" | "analyze_content",
    processingData: any,
    priority: number = 0,
    userId?: number,
  ) {
    // Extract sessionId from processingData for indexed column
    const sessionId = processingData?.sessionId || null;
    
    const result = await db
      .insert(processingJobs)
      .values({
        profileResumeId,
        jobType,
        processingData: JSON.stringify(processingData),
        sessionId, // Add sessionId to indexed column
        priority,
        createdBy: userId,
      })
      .returning({ id: processingJobs.id });

    console.log(
      `➕ Created ${jobType} job ${result[0].id} for resume ${profileResumeId}`,
    );
    return result[0];
  }

  async getSessionProgress(sessionId: string): Promise<SessionProgress> {
    // Use efficient SQL aggregation with indexed sessionId column
    const results = await db
      .select({
        status: processingJobs.status,
        count: count(),
      })
      .from(processingJobs)
      .where(eq(processingJobs.sessionId, sessionId))
      .groupBy(processingJobs.status);

    // Build counts from aggregated results
    let total = 0;
    let completed = 0;
    let processing = 0;
    let pending = 0;
    let failed = 0;

    for (const row of results) {
      const statusCount = Number(row.count);
      total += statusCount;

      switch (row.status) {
        case "completed":
          completed = statusCount;
          break;
        case "processing":
          processing = statusCount;
          break;
        case "pending":
        case "retrying":
          pending += statusCount;
          break;
        case "failed":
          failed = statusCount;
          break;
      }
    }

    const percentage =
      total > 0 ? Math.round(((completed + failed) / total) * 100) : 0;

    let status: SessionProgress["status"] = "processing";
    if (percentage === 100) {
      status = failed === total ? "failed" : "completed";
    }

    return {
      sessionId,
      total,
      completed,
      processing,
      pending,
      failed,
      percentage,
      status,
    };
  }

  getStats(): SchedulerStats {
    return { ...this.stats };
  }

  getConfig(): JobSchedulerConfig {
    return { ...this.config };
  }

  async getQueueSize(): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(processingJobs)
      .where(
        or(
          eq(processingJobs.status, "pending"),
          eq(processingJobs.status, "retrying"),
        ),
      );

    return Number(result[0].count);
  }
}

// Export singleton instance with environment-based configuration
const schedulerConfig: Partial<JobSchedulerConfig> = {
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || "8"),
  workerThreads: parseInt(process.env.MAX_WORKER_THREADS || "4"),
  batchSize: parseInt(process.env.JOB_BATCH_SIZE || "10"),
  pollIntervalMs: parseInt(process.env.JOB_POLL_INTERVAL || "5000"), // Reduced from 1s to 5s to prevent DB connection pool exhaustion
  enablePriorityProcessing: process.env.ENABLE_PRIORITY_PROCESSING !== "false",
};

export const jobScheduler = new JobScheduler(schedulerConfig);

// Auto-start when module is imported (except in tests)
if (process.env.NODE_ENV !== "test") {
  jobScheduler.start().catch(console.error);

  // Graceful shutdown handling
  process.on("SIGTERM", async () => {
    console.log("🔄 Graceful shutdown initiated...");
    await jobScheduler.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("🔄 Graceful shutdown initiated...");
    await jobScheduler.stop();
    process.exit(0);
  });
}
