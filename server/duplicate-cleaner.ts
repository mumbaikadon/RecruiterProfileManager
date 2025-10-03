import { db } from './db';
import { profileResumes, resumeContent } from '../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { unlink } from 'fs/promises';

interface DuplicateGroup {
  normalizedName: string;
  resumes: Array<{
    id: number;
    filename: string;
    fileType: string;
    filePath: string | null;
    uploadedAt: Date;
    fileSize: number;
  }>;
}

interface CleanupResult {
  scannedCount: number;
  duplicateGroupsFound: number;
  filesDeleted: number;
  storageFreed: number;
  deletedFiles: Array<{
    id: number;
    filename: string;
    reason: string;
  }>;
  errors: Array<{
    id: number;
    filename: string;
    error: string;
  }>;
}

export class DuplicateFileCleaner {
  private dryRun: boolean;
  
  constructor(dryRun: boolean = false) {
    this.dryRun = dryRun;
  }

  /**
   * Main entry point: Scan for duplicates and delete them
   */
  async cleanDuplicates(): Promise<CleanupResult> {
    const startTime = Date.now();
    console.log(`🧹 Starting duplicate file cleanup (${this.dryRun ? 'DRY RUN' : 'LIVE MODE'})...`);
    
    const result: CleanupResult = {
      scannedCount: 0,
      duplicateGroupsFound: 0,
      filesDeleted: 0,
      storageFreed: 0,
      deletedFiles: [],
      errors: []
    };

    try {
      // Step 1: Scan all profile resumes
      console.log('📊 Step 1: Scanning all profile resumes...');
      const allResumes = await this.scanAllResumes();
      result.scannedCount = allResumes.length;
      console.log(`   Found ${allResumes.length} total resumes`);

      // Step 2: Group duplicates
      console.log('🔍 Step 2: Identifying duplicate groups...');
      const duplicateGroups = this.groupDuplicates(allResumes);
      result.duplicateGroupsFound = duplicateGroups.length;
      console.log(`   Found ${duplicateGroups.length} duplicate groups`);

      // Step 3: Delete duplicates (keep newest in each group)
      console.log('🗑️  Step 3: Deleting duplicate files...');
      for (const group of duplicateGroups) {
        const deleteResult = await this.deleteDuplicatesInGroup(group);
        result.filesDeleted += deleteResult.filesDeleted;
        result.storageFreed += deleteResult.storageFreed;
        result.deletedFiles.push(...deleteResult.deletedFiles);
        result.errors.push(...deleteResult.errors);
      }

      const duration = Date.now() - startTime;
      console.log(`✅ Cleanup completed in ${duration}ms`);
      console.log(`   Files deleted: ${result.filesDeleted}`);
      console.log(`   Storage freed: ${this.formatBytes(result.storageFreed)}`);
      
      if (result.errors.length > 0) {
        console.warn(`⚠️  Encountered ${result.errors.length} errors during cleanup`);
      }

    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }

    return result;
  }

  /**
   * Scan all resumes from database
   */
  private async scanAllResumes() {
    const resumes = await db
      .select({
        id: profileResumes.id,
        filename: profileResumes.filename,
        fileType: profileResumes.fileType,
        filePath: profileResumes.filePath,
        uploadedAt: profileResumes.uploadedAt,
        fileSize: profileResumes.fileSize,
      })
      .from(profileResumes)
      .orderBy(profileResumes.uploadedAt);

    return resumes;
  }

  /**
   * Group resumes by normalized filename to find duplicates
   */
  private groupDuplicates(resumes: Array<{
    id: number;
    filename: string;
    fileType: string;
    filePath: string | null;
    uploadedAt: Date;
    fileSize: number;
  }>): DuplicateGroup[] {
    const groups = new Map<string, DuplicateGroup>();

    for (const resume of resumes) {
      const normalized = this.normalizeFilename(resume.filename);
      
      if (!groups.has(normalized)) {
        groups.set(normalized, {
          normalizedName: normalized,
          resumes: []
        });
      }
      
      groups.get(normalized)!.resumes.push(resume);
    }

    // Filter to only groups with duplicates (more than 1 file)
    return Array.from(groups.values()).filter(group => group.resumes.length > 1);
  }

  /**
   * Normalize filename to detect duplicates
   * Handles:
   * 1. Case insensitivity
   * 2. Strip (1), (2) duplicate markers
   * 3. Remove file extensions
   * 4. Normalize spaces/underscores
   * 5. UTF-8 encoding normalization
   */
  private normalizeFilename(filename: string): string {
    let normalized = filename;

    // Remove file extension
    normalized = normalized.replace(/\.(pdf|docx)$/i, '');

    // Normalize UTF-8 encoding (handle RÃ©sumÃ© -> Resume)
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Convert to lowercase
    normalized = normalized.toLowerCase();

    // Replace multiple underscores or spaces with single space
    normalized = normalized.replace(/[_\s]+/g, ' ');

    // Remove OS duplicate markers: (1), (2), (3), etc.
    // Also handles nested: (1) (1), (2) (1), etc.
    normalized = normalized.replace(/\s*\(\d+\)(\s*\(\d+\))*/g, '');

    // Remove extra spaces and trim
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // Remove special characters except letters, numbers, spaces, and hyphens
    normalized = normalized.replace(/[^a-z0-9\s-]/g, '');

    return normalized;
  }

  /**
   * Delete duplicate files in a group, keeping the newest one
   */
  private async deleteDuplicatesInGroup(group: DuplicateGroup) {
    const result = {
      filesDeleted: 0,
      storageFreed: 0,
      deletedFiles: [] as Array<{ id: number; filename: string; reason: string }>,
      errors: [] as Array<{ id: number; filename: string; error: string }>
    };

    // Sort by uploadedAt (newest first)
    const sortedResumes = [...group.resumes].sort((a, b) => 
      b.uploadedAt.getTime() - a.uploadedAt.getTime()
    );

    // Keep the newest, delete the rest
    const toKeep = sortedResumes[0];
    const toDelete = sortedResumes.slice(1);

    console.log(`   Group "${group.normalizedName}": Keeping newest (${toKeep.filename}), deleting ${toDelete.length} duplicates`);

    for (const resume of toDelete) {
      try {
        if (!this.dryRun) {
          await this.deleteResume(resume.id, resume.filePath);
        }
        
        result.filesDeleted++;
        result.storageFreed += resume.fileSize;
        result.deletedFiles.push({
          id: resume.id,
          filename: resume.filename,
          reason: `Duplicate of ${toKeep.filename} (kept newer version)`
        });

        console.log(`      ✓ Deleted: ${resume.filename} (ID: ${resume.id})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push({
          id: resume.id,
          filename: resume.filename,
          error: errorMsg
        });
        console.error(`      ✗ Failed to delete ${resume.filename}:`, errorMsg);
      }
    }

    return result;
  }

  /**
   * Delete a resume from database and filesystem
   */
  private async deleteResume(resumeId: number, filePath: string | null) {
    // Use transaction for safety
    await db.transaction(async (tx) => {
      // Delete resume content first (foreign key constraint)
      await tx
        .delete(resumeContent)
        .where(eq(resumeContent.profileResumeId, resumeId));

      // Delete resume record
      await tx
        .delete(profileResumes)
        .where(eq(profileResumes.id, resumeId));
    });

    // Delete file from filesystem if path exists
    if (filePath) {
      try {
        await unlink(filePath);
      } catch (error) {
        // File might already be deleted or path invalid, log but don't fail
        console.warn(`      Could not delete file at ${filePath}:`, error);
      }
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get statistics without performing cleanup
   */
  async getStatistics() {
    console.log('📊 Gathering duplicate statistics...');
    
    const allResumes = await this.scanAllResumes();
    const duplicateGroups = this.groupDuplicates(allResumes);
    
    let totalDuplicates = 0;
    let potentialStorageSavings = 0;

    for (const group of duplicateGroups) {
      // All except the first (newest) are duplicates
      const duplicates = group.resumes.slice(1);
      totalDuplicates += duplicates.length;
      potentialStorageSavings += duplicates.reduce((sum, r) => sum + r.fileSize, 0);
    }

    return {
      totalFiles: allResumes.length,
      duplicateGroups: duplicateGroups.length,
      totalDuplicates,
      potentialStorageSavings: this.formatBytes(potentialStorageSavings),
      potentialStorageSavingsBytes: potentialStorageSavings,
      groups: duplicateGroups.map(g => ({
        normalizedName: g.normalizedName,
        count: g.resumes.length,
        files: g.resumes.map(r => ({
          filename: r.filename,
          fileType: r.fileType,
          uploadedAt: r.uploadedAt,
          size: this.formatBytes(r.fileSize)
        }))
      }))
    };
  }
}
