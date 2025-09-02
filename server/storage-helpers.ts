import { db } from "./db";
import { tempProfileUploads } from "@shared/schema";
import { eq, and, count } from "drizzle-orm";

// Helper function to count temp uploads by status for a specific batch
export async function countTempUploadsByStatus(batchId: string, status: string): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(tempProfileUploads)
    .where(
      and(
        eq(tempProfileUploads.batchId, batchId),
        eq(tempProfileUploads.uploadStatus, status)
      )
    );
  
  return result[0]?.count || 0;
}

// Helper function to get all temp uploads for a batch
export async function getTempUploadsByBatch(batchId: string) {
  return db
    .select()
    .from(tempProfileUploads)
    .where(eq(tempProfileUploads.batchId, batchId))
    .orderBy(tempProfileUploads.uploadedAt);
}

// Helper function to clean up old expired temp uploads
export async function cleanupExpiredUploads(): Promise<number> {
  const expiredUploads = await db
    .select()
    .from(tempProfileUploads)
    .where(eq(tempProfileUploads.uploadStatus, 'failed'));
  
  let deletedCount = 0;
  
  for (const upload of expiredUploads) {
    try {
      // Delete the file from filesystem if it exists
      const { deleteFile } = await import('./file-utils');
      await deleteFile(upload.filePath);
    } catch (error) {
      console.warn(`Failed to delete file ${upload.filePath}:`, error);
    }
    
    // Delete from database
    await db
      .delete(tempProfileUploads)
      .where(eq(tempProfileUploads.id, upload.id));
    
    deletedCount++;
  }
  
  return deletedCount;
}