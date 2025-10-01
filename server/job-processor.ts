import { db } from './db';
import { processingJobs, profileResumes, resumeContent, resumeMetadata } from '@shared/schema';
import { eq, and, inArray, lt, or, count } from 'drizzle-orm';

interface ProcessingJobData {
  filePath: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  candidateName?: string;
  candidateEmail?: string;
  userId: number;
}

class JobProcessor {
  private isProcessing = false;
  private processInterval: NodeJS.Timeout | null = null;
  private readonly MAX_CONCURRENT_JOBS = 3; // Process 3 files simultaneously
  private readonly POLL_INTERVAL = 2000; // Check for new jobs every 2 seconds
  
  async start() {
    if (this.isProcessing) {
      console.log('📋 Job processor already running');
      return;
    }
    
    this.isProcessing = true;
    console.log('🚀 Starting background job processor...');
    
    // Process any pending jobs immediately
    await this.processJobs();
    
    // Set up periodic job processing
    this.processInterval = setInterval(async () => {
      try {
        await this.processJobs();
      } catch (error) {
        console.error('❌ Error in job processor:', error);
      }
    }, this.POLL_INTERVAL);
    
    console.log('✅ Background job processor started');
  }
  
  async stop() {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    this.isProcessing = false;
    console.log('⏹️  Background job processor stopped');
  }
  
  private async processJobs() {
    try {
      // Get pending jobs with priority ordering
      const pendingJobs = await db
        .select()
        .from(processingJobs)
        .where(
          or(
            eq(processingJobs.status, 'pending'),
            eq(processingJobs.status, 'retrying')
          )
        )
        .orderBy(processingJobs.priority, processingJobs.createdAt)
        .limit(this.MAX_CONCURRENT_JOBS);

      if (pendingJobs.length === 0) {
        return; // No jobs to process
      }

      console.log(`📋 Processing ${pendingJobs.length} job(s)...`);

      // Process jobs concurrently
      const jobPromises = pendingJobs.map(job => this.processJob(job));
      await Promise.allSettled(jobPromises);
      
    } catch (error) {
      console.error('❌ Error fetching jobs:', error);
    }
  }
  
  private async processJob(job: any) {
    const startTime = Date.now();
    
    try {
      // Mark job as processing
      await db
        .update(processingJobs)
        .set({ 
          status: 'processing', 
          startedAt: new Date() 
        })
        .where(eq(processingJobs.id, job.id));

      console.log(`⚙️  Processing job ${job.id} for resume ${job.profileResumeId}`);
      
      // Parse processing data
      const data: ProcessingJobData = JSON.parse(job.processingData || '{}');
      
      // Update resume status to processing
      await db
        .update(profileResumes)
        .set({ processingStatus: 'processing' })
        .where(eq(profileResumes.id, job.profileResumeId));
      
      // Process based on job type
      let result;
      switch (job.jobType) {
        case 'extract_text':
          result = await this.extractText(job.profileResumeId, data);
          break;
        case 'generate_summary':
          result = await this.generateSummary(job.profileResumeId, data);
          break;
        case 'analyze_content':
          result = await this.analyzeContent(job.profileResumeId, data);
          break;
        default:
          throw new Error(`Unknown job type: ${job.jobType}`);
      }
      
      // Mark job as completed
      await db
        .update(processingJobs)
        .set({ 
          status: 'completed', 
          completedAt: new Date() 
        })
        .where(eq(processingJobs.id, job.id));
      
      // Update resume status to completed
      await db
        .update(profileResumes)
        .set({ processingStatus: 'completed' })
        .where(eq(profileResumes.id, job.profileResumeId));
      
      const duration = Date.now() - startTime;
      console.log(`✅ Job ${job.id} completed in ${duration}ms`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Job ${job.id} failed:`, errorMessage);
      
      // Check if we should retry
      const shouldRetry = job.retryCount < job.maxRetries;
      
      if (shouldRetry) {
        // Mark for retry
        await db
          .update(processingJobs)
          .set({
            status: 'retrying',
            retryCount: job.retryCount + 1,
            errorMessage,
            startedAt: null
          })
          .where(eq(processingJobs.id, job.id));
          
        console.log(`🔄 Job ${job.id} will be retried (attempt ${job.retryCount + 1}/${job.maxRetries})`);
      } else {
        // Mark as permanently failed
        await db
          .update(processingJobs)
          .set({
            status: 'failed',
            errorMessage,
            completedAt: new Date()
          })
          .where(eq(processingJobs.id, job.id));
        
        // Mark resume as failed
        await db
          .update(profileResumes)
          .set({ processingStatus: 'failed' })
          .where(eq(profileResumes.id, job.profileResumeId));
        console.log(`💀 Job ${job.id} permanently failed after ${job.retryCount} retries`);
      }
    }
  }
  
  private async extractText(resumeId: number, data: ProcessingJobData) {
    const { extractTextFromDocument } = await import('./document-parser');
    
    let fileBuffer: Buffer;
    
    // Try to read file from filesystem first, fallback to database
    if (data.filePath) {
      try {
        console.log(`📂 Reading file from filesystem: ${data.filePath}`);
        const fs = await import('fs');
        fileBuffer = fs.readFileSync(data.filePath);
      } catch (error) {
        console.warn(`⚠️  Failed to read from filesystem, trying database fallback:`, error);
        // Fallback to database
        const resume = await db
          .select({ fileData: profileResumes.fileData })
          .from(profileResumes)
          .where(eq(profileResumes.id, resumeId))
          .limit(1);
        
        if (!resume[0]?.fileData) {
          throw new Error(`File not found in filesystem or database for resume ${resumeId}`);
        }
        
        fileBuffer = Buffer.from(resume[0].fileData, 'base64');
        console.log(`📦 Retrieved file from database (${fileBuffer.length} bytes)`);
      }
    } else {
      // No filePath provided, read from database
      console.log(`📦 No filePath provided, reading from database for resume ${resumeId}`);
      const resume = await db
        .select({ fileData: profileResumes.fileData })
        .from(profileResumes)
        .where(eq(profileResumes.id, resumeId))
        .limit(1);
      
      if (!resume[0]?.fileData) {
        throw new Error(`File data not found in database for resume ${resumeId}. The file may not have been uploaded correctly.`);
      }
      
      fileBuffer = Buffer.from(resume[0].fileData, 'base64');
      console.log(`📦 Retrieved file from database (${fileBuffer.length} bytes)`);
    }
    
    // Extract text
    const extractedText = await extractTextFromDocument(fileBuffer, data.fileName);
    
    // Calculate content hash for duplicate detection
    const crypto = await import('crypto');
    const contentHash = crypto.createHash('sha256').update(extractedText).digest('hex');
    
    // Check for duplicates
    const existingContent = await db
      .select()
      .from(resumeContent)
      .where(eq(resumeContent.contentHash, contentHash))
      .limit(1);
    
    if (existingContent.length > 0) {
      console.log(`⚠️  Duplicate content detected for resume ${resumeId}`);
    }
    
    // Store extracted content
    await db
      .insert(resumeContent)
      .values({
        profileResumeId: resumeId,
        extractedText,
        contentHash,
        wordCount: extractedText.split(/\s+/).length
      })
      .onConflictDoNothing(); // Avoid duplicate inserts
    
    console.log(`📄 Text extracted from ${data.fileName}: ${extractedText.length} characters`);
    return { extractedText, contentHash };
  }
  
  private async generateSummary(resumeId: number, data: ProcessingJobData) {
    // This would integrate with OpenAI for summary generation
    // For now, create a simple summary
    const summary = `Resume for ${data.candidateName || 'Unknown'} - ${data.fileType.toUpperCase()} file`;
    
    // Store metadata
    await db
      .insert(resumeMetadata)
      .values({
        profileResumeId: resumeId,
        summaryText: summary,
        candidateNameNormalized: data.candidateName?.toLowerCase(),
        candidateEmailNormalized: data.candidateEmail?.toLowerCase()
      })
      .onConflictDoNothing();
    
    console.log(`📊 Summary generated for resume ${resumeId}`);
    return { summary };
  }
  
  private async analyzeContent(resumeId: number, data: ProcessingJobData) {
    // This would do advanced AI analysis
    console.log(`🔍 Content analysis completed for resume ${resumeId}`);
    return { analyzed: true };
  }
  
  // Create a job for processing
  async createJob(
    profileResumeId: number, 
    jobType: 'extract_text' | 'generate_summary' | 'analyze_content',
    processingData: ProcessingJobData,
    priority: number = 0,
    userId?: number
  ) {
    const result = await db
      .insert(processingJobs)
      .values({
        profileResumeId,
        jobType,
        processingData: JSON.stringify(processingData),
        priority,
        createdBy: userId
      })
      .returning({ id: processingJobs.id });
    
    console.log(`➕ Created ${jobType} job ${result[0].id} for resume ${profileResumeId}`);
    return result[0];
  }
  
  // Get job status
  async getJobStatus(resumeId: number) {
    const jobs = await db
      .select()
      .from(processingJobs)
      .where(eq(processingJobs.profileResumeId, resumeId))
      .orderBy(processingJobs.createdAt);
    
    return jobs;
  }
  
  // Get queue statistics
  async getQueueStats() {
    const stats = await db
      .select({
        status: processingJobs.status,
        count: count()
      })
      .from(processingJobs)
      .groupBy(processingJobs.status);
    
    return stats;
  }
}

// Export singleton instance
export const jobProcessor = new JobProcessor();

// Auto-start disabled - Enhanced background job manager is now used
// The new background-job-manager.ts provides superior worker thread processing
// if (process.env.NODE_ENV !== 'test') {
//   jobProcessor.start().catch(console.error);
// }