import cron from 'node-cron';
import { DuplicateFileCleaner } from './duplicate-cleaner';

export class DuplicateCleanerScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the scheduler
   * Runs every Sunday at 3:00 AM
   * Cron expression: '0 3 * * 0' (minute=0, hour=3, day-of-week=Sunday)
   */
  start() {
    if (this.task) {
      console.log('🧹 Duplicate cleaner scheduler already running');
      return;
    }

    // Schedule: Every Sunday at 3:00 AM
    this.task = cron.schedule('0 3 * * 0', async () => {
      if (this.isRunning) {
        console.log('⏭️  Skipping duplicate cleanup - previous run still in progress');
        return;
      }

      try {
        this.isRunning = true;
        console.log('🧹 [SCHEDULED] Starting weekly duplicate file cleanup...');
        
        const cleaner = new DuplicateFileCleaner(false); // Live mode
        const result = await cleaner.cleanDuplicates();
        
        console.log('✅ [SCHEDULED] Weekly cleanup completed successfully');
        console.log(`   Files deleted: ${result.filesDeleted}`);
        console.log(`   Storage freed: ${result.storageFreed}`);
        
        // Log any errors
        if (result.errors.length > 0) {
          console.warn(`   Errors encountered: ${result.errors.length}`);
          result.errors.forEach(err => {
            console.warn(`   - ${err.filename}: ${err.error}`);
          });
        }
      } catch (error) {
        console.error('❌ [SCHEDULED] Weekly cleanup failed:', error);
      } finally {
        this.isRunning = false;
      }
    }, {
      scheduled: true,
      timezone: 'America/Los_Angeles' // Adjust to your server timezone
    });

    console.log('✅ Duplicate cleaner scheduler started');
    console.log('   Schedule: Every Sunday at 3:00 AM');
    console.log('   Next run:', this.getNextRunTime());
  }

  /**
   * Stop the scheduler
   */
  stop() {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('🛑 Duplicate cleaner scheduler stopped');
    }
  }

  /**
   * Get the next scheduled run time
   */
  getNextRunTime(): string {
    if (!this.task) {
      return 'Not scheduled';
    }

    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    const nextSunday = new Date(now);
    nextSunday.setDate(now.getDate() + daysUntilSunday);
    nextSunday.setHours(3, 0, 0, 0);

    // If it's already past 3 AM on Sunday, schedule for next Sunday
    if (now.getDay() === 0 && now.getHours() >= 3) {
      nextSunday.setDate(nextSunday.getDate() + 7);
    }

    return nextSunday.toLocaleString();
  }

  /**
   * Check if scheduler is currently running a cleanup
   */
  isCleanupRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Run cleanup immediately (manual trigger)
   */
  async runNow(dryRun: boolean = false): Promise<any> {
    if (this.isRunning) {
      throw new Error('Cleanup already in progress');
    }

    try {
      this.isRunning = true;
      console.log(`🧹 [MANUAL] Running duplicate cleanup (${dryRun ? 'DRY RUN' : 'LIVE'})...`);
      
      const cleaner = new DuplicateFileCleaner(dryRun);
      const result = await cleaner.cleanDuplicates();
      
      console.log(`✅ [MANUAL] Cleanup completed`);
      return result;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get statistics without running cleanup
   */
  async getStatistics(): Promise<any> {
    const cleaner = new DuplicateFileCleaner(true);
    return await cleaner.getStatistics();
  }
}

// Export singleton instance
export const duplicateCleanerScheduler = new DuplicateCleanerScheduler();
