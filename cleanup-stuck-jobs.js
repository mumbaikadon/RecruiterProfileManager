// Script to manually clean up stuck processing jobs
import 'dotenv/config';
import { jobProcessor } from './server/job-processor.js';

async function cleanupStuckJobs() {
  console.log('🚀 Starting stuck jobs cleanup...\n');
  
  try {
    await jobProcessor.cleanupStuckJobsNow();
    
    // Show current queue stats
    const stats = await jobProcessor.getQueueStats();
    console.log('\n📊 Current queue statistics:');
    stats.forEach(stat => {
      console.log(`  - ${stat.status}: ${stat.count}`);
    });
    
    console.log('\n✅ Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupStuckJobs();
