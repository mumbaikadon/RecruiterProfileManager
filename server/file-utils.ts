import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';
import zlib from 'zlib';

const pipelineAsync = promisify(pipeline);

// File storage configuration
const STORAGE_DIR = process.env.RESUME_STORAGE_DIR || '/tmp/resumes';
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size (increased for enterprise-scale uploads)
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];

// Ensure storage directory exists
export async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

// Generate unique file path
export function generateFilePath(originalName: string, contentHash?: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const timestamp = Date.now();
  const randomId = crypto.randomBytes(8).toString('hex');
  const hashSuffix = contentHash ? `_${contentHash.substring(0, 8)}` : '';
  const filename = `${timestamp}_${randomId}${hashSuffix}${ext}`;
  return path.join(STORAGE_DIR, filename);
}

// Save file to filesystem
export async function saveFile(buffer: Buffer, originalName: string, contentHash?: string): Promise<string> {
  await ensureStorageDir();
  
  // Validate file size
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File size ${Math.round(buffer.length / 1024 / 1024)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }
  
  // Validate file extension
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`File extension ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }
  
  const filePath = generateFilePath(originalName, contentHash);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

// Read file from filesystem
export async function readFile(filePath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    throw new Error(`File not found or cannot be read: ${filePath}`);
  }
}

// Delete file from filesystem
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    // Ignore errors for file deletion - file might already be deleted
    console.warn(`Could not delete file ${filePath}:`, error);
  }
}

// Compress text for storage
export async function compressText(text: string): Promise<string> {
  const buffer = Buffer.from(text, 'utf8');
  const compressed = await new Promise<Buffer>((resolve, reject) => {
    zlib.gzip(buffer, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
  return compressed.toString('base64');
}

// Decompress text from storage
export async function decompressText(compressedText: string): Promise<string> {
  const buffer = Buffer.from(compressedText, 'base64');
  const decompressed = await new Promise<Buffer>((resolve, reject) => {
    zlib.gunzip(buffer, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
  return decompressed.toString('utf8');
}

// Get file metadata
export async function getFileStats(filePath: string): Promise<{
  size: number;
  created: Date;
  modified: Date;
  exists: boolean;
}> {
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true
    };
  } catch {
    return {
      size: 0,
      created: new Date(),
      modified: new Date(),
      exists: false
    };
  }
}

// Clean up old files (for maintenance)
export async function cleanupOldFiles(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  await ensureStorageDir();
  
  const files = await fs.readdir(STORAGE_DIR);
  const now = Date.now();
  let deletedCount = 0;
  
  for (const file of files) {
    const filePath = path.join(STORAGE_DIR, file);
    const stats = await getFileStats(filePath);
    
    if (now - stats.modified.getTime() > maxAgeMs) {
      await deleteFile(filePath);
      deletedCount++;
    }
  }
  
  return deletedCount;
}

// Hash file content for duplicate detection
export function hashContent(content: Buffer | string): string {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Create file backup (for important files)
export async function backupFile(filePath: string): Promise<string> {
  const backupPath = `${filePath}.backup`;
  const content = await readFile(filePath);
  await fs.writeFile(backupPath, content);
  return backupPath;
}