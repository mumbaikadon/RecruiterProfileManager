/**
 * Worker Script - Handles background processing tasks in separate threads
 * Plain JavaScript worker script for Node.js Worker Threads compatibility
 */

import { parentPort } from 'worker_threads';

// Log worker startup
console.log(`🧵 Worker thread ${process.pid} started for job processing`);

// Handle messages from main thread
parentPort?.on('message', async (data) => {
  const { jobId, jobType, filePath, fileName, fileType, resumeId, candidateName, candidateEmail } = data;
  const startTime = Date.now();
  
  try {
    console.log(`🔧 Worker ${process.pid} processing job ${jobId} (type: ${jobType}, file: ${fileName})`);
    
    let result;
    switch (jobType) {
      case 'extract_text':
        result = await extractText({ filePath, fileName, fileType, resumeId, candidateName, candidateEmail });
        break;
      case 'generate_summary':
        result = await generateSummary({ filePath, fileName, resumeId });
        break;
      case 'analyze_content':
        result = await analyzeContent({ filePath, fileName, resumeId });
        break;
      default:
        throw new Error(`Unknown job type: ${jobType}`);
    }
    
    // Send successful result back to main thread
    parentPort?.postMessage({
      success: true,
      jobId,
      resumeId,
      data: result,
      processingTime: Date.now() - startTime
    });
    
    console.log(`✅ Worker ${process.pid} completed job ${jobId} successfully in ${Date.now() - startTime}ms`);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Worker ${process.pid} failed job ${jobId}:`, errorMessage);
    
    // Send error result back to main thread
    parentPort?.postMessage({
      success: false,
      jobId,
      resumeId,
      error: errorMessage,
      processingTime: Date.now() - startTime
    });
  }
});

// Processing functions with actual file reading
async function extractText(data) {
  const { filePath, fileName, fileType, resumeId } = data;
  
  try {
    // Dynamic import for document processing - NOW WORKS WITH COMPILED JS!
    const { extractTextFromDocument } = await import('./document-parser.js');
    const fs = await import('fs/promises');
    const crypto = await import('crypto');
    
    // Read file from disk
    const fileBuffer = await fs.readFile(filePath);
    
    // Extract text using document parser
    const extractedText = await extractTextFromDocument(fileBuffer, fileName);
    
    // Calculate content hash
    const contentHash = crypto.createHash('sha256').update(extractedText).digest('hex');
    
    console.log(`📄 Extracted ${extractedText.length} characters from ${fileName}`);
    
    return {
      text: extractedText,
      wordCount: extractedText.split(/\s+/).length,
      contentHash,
      fileName
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Text extraction failed for ${fileName}:`, errorMessage);
    throw error;
  }
}

async function generateSummary(data) {
  // Simulate summary generation processing  
  await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
  return {
    summary: `Generated summary for ${data.text?.substring(0, 50)}...`,
    keyPoints: ['Key point 1', 'Key point 2', 'Key point 3']
  };
}

async function analyzeContent(data) {
  // Simulate content analysis processing
  await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));
  return {
    skills: ['JavaScript', 'Node.js', 'Database Management'],
    experience: Math.floor(Math.random() * 10) + 1,
    matchScore: Math.random() * 100
  };
}

// Handle worker termination
process.on('SIGTERM', () => {
  console.log(`🔄 Worker ${process.pid} received termination signal`);
  process.exit(0);
});

console.log(`✅ Worker script ${process.pid} ready for job processing`);
