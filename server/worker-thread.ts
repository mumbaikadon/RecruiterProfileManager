/**
 * Worker Thread for Background File Processing
 * Handles text extraction and content analysis in separate threads
 */

import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { db } from './db';
import { processingJobs, profileResumes, resumeContent, resumeMetadata } from '@shared/schema';
import { eq } from 'drizzle-orm';
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WorkerJobData {
  jobId: number;
  resumeId: number;
  filePath: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  candidateName?: string;
  candidateEmail?: string;
  jobType: 'extract_text' | 'generate_summary' | 'analyze_content';
}

interface WorkerResult {
  success: boolean;
  jobId: number;
  resumeId: number;
  error?: string;
  data?: any;
  processingTime: number;
}

// Worker thread execution (runs in separate thread)
if (!isMainThread) {
  const processJobInWorker = async (jobData: WorkerJobData): Promise<WorkerResult> => {
    const startTime = Date.now();
    
    try {
      console.log(`🔧 Worker processing job ${jobData.jobId} for resume ${jobData.resumeId}`);
      
      let result: any = {};
      
      switch (jobData.jobType) {
        case 'extract_text':
          result = await extractTextInWorker(jobData);
          break;
        case 'generate_summary':
          result = await generateSummaryInWorker(jobData);
          break;
        case 'analyze_content':
          result = await analyzeContentInWorker(jobData);
          break;
        default:
          throw new Error(`Unknown job type: ${jobData.jobType}`);
      }
      
      const processingTime = Date.now() - startTime;
      console.log(`✅ Worker completed job ${jobData.jobId} in ${processingTime}ms`);
      
      return {
        success: true,
        jobId: jobData.jobId,
        resumeId: jobData.resumeId,
        data: result,
        processingTime
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown worker error';
      const processingTime = Date.now() - startTime;
      
      console.error(`❌ Worker job ${jobData.jobId} failed:`, errorMessage);
      
      return {
        success: false,
        jobId: jobData.jobId,
        resumeId: jobData.resumeId,
        error: errorMessage,
        processingTime
      };
    }
  };

  const extractTextInWorker = async (jobData: WorkerJobData) => {
    // Dynamic import to avoid loading heavy modules in main thread
    const { extractTextFromDocument } = await import('./document-parser');
    const fs = await import('fs/promises');
    const crypto = await import('crypto');
    
    // Read file asynchronously
    const fileBuffer = await fs.readFile(jobData.filePath);
    
    // Extract text
    const extractedText = await extractTextFromDocument(fileBuffer, jobData.fileName);
    
    // Calculate content hash for duplicate detection
    const contentHash = crypto.createHash('sha256').update(extractedText).digest('hex');
    
    // Check for duplicates
    const existingContent = await db
      .select()
      .from(resumeContent)
      .where(eq(resumeContent.contentHash, contentHash))
      .limit(1);
    
    const isDuplicate = existingContent.length > 0;
    
    if (!isDuplicate) {
      // Store extracted content
      await db
        .insert(resumeContent)
        .values({
          profileResumeId: jobData.resumeId,
          extractedText,
          contentHash,
          wordCount: extractedText.split(/\s+/).length
        });
    }
    
    console.log(`📄 Text extracted from ${jobData.fileName}: ${extractedText.length} chars ${isDuplicate ? '(duplicate detected)' : ''}`);
    
    // Clean up file after processing to save disk space
    try {
      await fs.unlink(jobData.filePath);
    } catch (error) {
      console.warn(`⚠️ Could not delete temporary file ${jobData.filePath}`);
    }
    
    return {
      extractedText: extractedText.substring(0, 500), // Return preview only
      fullTextLength: extractedText.length,
      contentHash,
      isDuplicate,
      wordCount: extractedText.split(/\s+/).length
    };
  };

  const generateSummaryInWorker = async (jobData: WorkerJobData) => {
    // Get the extracted text first
    const content = await db
      .select()
      .from(resumeContent)
      .where(eq(resumeContent.profileResumeId, jobData.resumeId))
      .limit(1);
    
    if (content.length === 0) {
      throw new Error('No extracted text found for summary generation');
    }
    
    // Simple summary generation (could be enhanced with OpenAI)
    const text = content[0].extractedText;
    const words = text.split(/\s+/);
    const summary = `Resume for ${jobData.candidateName || 'Unknown'} - ${words.length} words, ${jobData.fileType.toUpperCase()} format`;
    
    // Store metadata
    await db
      .insert(resumeMetadata)
      .values({
        profileResumeId: jobData.resumeId,
        summaryText: summary,
        candidateNameNormalized: jobData.candidateName?.toLowerCase(),
        candidateEmailNormalized: jobData.candidateEmail?.toLowerCase(),
        wordCount: words.length
      })
      .onConflictDoNothing();
    
    console.log(`📊 Summary generated for resume ${jobData.resumeId}`);
    return { summary, wordCount: words.length };
  };

  const analyzeContentInWorker = async (jobData: WorkerJobData) => {
    // Advanced content analysis (placeholder for AI integration)
    const content = await db
      .select()
      .from(resumeContent)
      .where(eq(resumeContent.profileResumeId, jobData.resumeId))
      .limit(1);
    
    if (content.length === 0) {
      throw new Error('No extracted text found for content analysis');
    }
    
    // Simple analysis - extract skills, experience, etc.
    const text = content[0].extractedText.toLowerCase();
    
    // Basic skill extraction
    const commonSkills = ['javascript', 'python', 'java', 'react', 'node.js', 'sql', 'aws', 'docker', 'kubernetes'];
    const detectedSkills = commonSkills.filter(skill => text.includes(skill));
    
    // Experience estimation
    const experienceMatches = text.match(/(\d+)[\s]*(?:years?|yrs?)[\s]*(?:of[\s]*)?experience/gi);
    const yearMatches = text.match(/(?:20\d{2})/g);
    
    console.log(`🔍 Content analysis completed for resume ${jobData.resumeId}`);
    return {
      detectedSkills,
      experienceMatches: experienceMatches ? experienceMatches.slice(0, 3) : [],
      yearCount: yearMatches ? yearMatches.length : 0,
      analyzed: true
    };
  };

  // Listen for messages from main thread
  if (parentPort) {
    parentPort.on('message', async (jobData: WorkerJobData) => {
      const result = await processJobInWorker(jobData);
      parentPort!.postMessage(result);
    });
  }
}

// Main thread interface
export class WorkerThreadManager {
  private workers: Worker[] = [];
  private workerPool: Worker[] = [];
  private activeJobs = new Map<number, Worker>();
  private maxWorkers: number;
  
  constructor(maxWorkers: number = 4) {
    this.maxWorkers = Math.max(1, Math.min(maxWorkers, 8)); // Limit between 1-8 workers
    this.initializeWorkerPool();
  }
  
  private initializeWorkerPool() {
    console.log(`🧵 Initializing ${this.maxWorkers} worker threads...`);
    
    for (let i = 0; i < this.maxWorkers; i++) {
      // Use TypeScript worker script - tsx loader will compile it automatically
      // Handle both development and production paths
      let workerScriptPath: string;
      
      if (import.meta.url.includes('tsx') || process.env.NODE_ENV === 'development') {
        // Development mode with tsx - TypeScript files work directly
        workerScriptPath = path.resolve(__dirname, "worker-script.ts");
      } else {
        // Production mode - would use compiled .js file
        workerScriptPath = path.resolve(process.cwd(), 'server/worker-script.js');
      }
      
      const worker = new Worker(workerScriptPath);
      
      worker.on('error', (error) => {
        console.error(`❌ Worker ${i} error:`, error);
        this.replaceWorker(worker);
      });
      
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.warn(`⚠️ Worker ${i} exited with code ${code}`);
          this.replaceWorker(worker);
        }
      });
      
      this.workers.push(worker);
      this.workerPool.push(worker);
    }
    
    console.log(`✅ ${this.maxWorkers} worker threads initialized successfully!`);
    console.log(`🔧 Worker pool ready: ${this.getAvailableWorkers()}/${this.getTotalWorkers()} workers available`);
  }
  
  private replaceWorker(deadWorker: Worker) {
    const index = this.workers.indexOf(deadWorker);
    if (index > -1) {
      // Use TypeScript worker script - tsx loader will compile it automatically
      // Handle both development and production paths
      let workerScriptPath: string;
      
      if (import.meta.url.includes('tsx') || process.env.NODE_ENV === 'development') {
        // Development mode with tsx - TypeScript files work directly
        workerScriptPath = new URL('./worker-script.ts', import.meta.url).pathname;
      } else {
        // Production mode - would use compiled .js file
        const path = require('path');
        workerScriptPath = path.resolve(process.cwd(), 'server/worker-script.js');
      }
      
      const newWorker = new Worker(workerScriptPath);
      this.workers[index] = newWorker;
      
      // Remove from pool if it was there
      const poolIndex = this.workerPool.indexOf(deadWorker);
      if (poolIndex > -1) {
        this.workerPool[poolIndex] = newWorker;
      }
    }
  }
  
  async processJob(jobData: WorkerJobData): Promise<WorkerResult> {
    return new Promise((resolve, reject) => {
      // Get available worker from pool
      const worker = this.workerPool.shift();
      
      if (!worker) {
        reject(new Error('No available workers'));
        return;
      }
      
      // Track active job
      this.activeJobs.set(jobData.jobId, worker);
      
      // Set up response handler
      const onMessage = (result: WorkerResult) => {
        worker.off('message', onMessage);
        worker.off('error', onError);
        
        // Return worker to pool
        this.workerPool.push(worker);
        this.activeJobs.delete(jobData.jobId);
        
        resolve(result);
      };
      
      const onError = (error: Error) => {
        worker.off('message', onMessage);
        worker.off('error', onError);
        
        // Return worker to pool (it might still be usable)
        this.workerPool.push(worker);
        this.activeJobs.delete(jobData.jobId);
        
        reject(error);
      };
      
      worker.on('message', onMessage);
      worker.on('error', onError);
      
      // Send job to worker
      worker.postMessage(jobData);
    });
  }
  
  getAvailableWorkers(): number {
    return this.workerPool.length;
  }
  
  getActiveJobs(): number {
    return this.activeJobs.size;
  }
  
  getTotalWorkers(): number {
    return this.maxWorkers;
  }
  
  async shutdown() {
    console.log('🔄 Shutting down worker threads...');
    
    // Terminate all workers
    await Promise.all(
      this.workers.map(worker => 
        new Promise<void>((resolve) => {
          worker.terminate().then(() => resolve()).catch(() => resolve());
        })
      )
    );
    
    this.workers = [];
    this.workerPool = [];
    this.activeJobs.clear();
    
    console.log('✅ All worker threads shut down');
  }
}

// Export worker thread manager factory for use in job processor
// Note: WorkerThreadManager initialization is handled by BackgroundJobManager
export const createWorkerThreadManager = (maxWorkers?: number) => {
  return new WorkerThreadManager(
    maxWorkers || parseInt(process.env.MAX_WORKER_THREADS || '4')
  );
};

// Legacy export - disabled auto-initialization to prevent startup hang
// WorkerThreadManager will be initialized by BackgroundJobManager when needed
export const workerThreadManager = {
  getTotalWorkers: () => 0,
  getActiveJobs: () => 0,  
  getAvailableWorkers: () => 0,
  processJob: () => Promise.reject(new Error('WorkerThreadManager not initialized')),
  shutdown: () => Promise.resolve()
};