/**
 * Winston logger configuration for Profile Record system
 * This provides comprehensive logging across all operations
 */

import winston from 'winston';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

// Create logger instance
export const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.colorize({ all: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let logMessage = `[${timestamp}] ${level}: ${message}`;
      
      // Add metadata if present
      if (Object.keys(meta).length > 0) {
        logMessage += ` | Meta: ${JSON.stringify(meta)}`;
      }
      
      // Add stack trace for errors
      if (stack) {
        logMessage += `\n${stack}`;
      }
      
      return logMessage;
    })
  ),
  transports: [
    // Console transport for development
    new winston.transports.Console({
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    }),
    
    // File transport for errors
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Profile Record specific logger functions
export const profileLogger = {
  // File upload operations
  uploadStart: (filename: string, userId: number, fileSize: number) => {
    logger.info('File upload started', { 
      operation: 'upload_start', 
      filename, 
      userId, 
      fileSize 
    });
  },
  
  uploadSuccess: (filename: string, userId: number, resumeId: number) => {
    logger.info('File upload completed successfully', { 
      operation: 'upload_success', 
      filename, 
      userId, 
      resumeId 
    });
  },
  
  uploadError: (filename: string, userId: number, error: string) => {
    logger.error('File upload failed', { 
      operation: 'upload_error', 
      filename, 
      userId, 
      error 
    });
  },
  
  // Text extraction operations
  extractionStart: (filename: string, fileType: string) => {
    logger.debug('Text extraction started', { 
      operation: 'extraction_start', 
      filename, 
      fileType 
    });
  },
  
  extractionSuccess: (filename: string, textLength: number) => {
    logger.info('Text extraction completed', { 
      operation: 'extraction_success', 
      filename, 
      textLength 
    });
  },
  
  extractionError: (filename: string, error: string) => {
    logger.error('Text extraction failed', { 
      operation: 'extraction_error', 
      filename, 
      error 
    });
  },
  
  // Search operations
  searchStart: (query: string, userId: number) => {
    logger.debug('Resume search started', { 
      operation: 'search_start', 
      query, 
      userId 
    });
  },
  
  searchSuccess: (query: string, resultCount: number, duration: number) => {
    logger.info('Resume search completed', { 
      operation: 'search_success', 
      query, 
      resultCount, 
      duration 
    });
  },
  
  searchError: (query: string, error: string) => {
    logger.error('Resume search failed', { 
      operation: 'search_error', 
      query, 
      error 
    });
  },
  
  // Database operations
  dbOperation: (operation: string, table: string, id?: number) => {
    logger.debug('Database operation', { 
      operation: 'db_operation', 
      dbAction: operation, 
      table, 
      recordId: id 
    });
  },
  
  dbError: (operation: string, table: string, error: string) => {
    logger.error('Database operation failed', { 
      operation: 'db_error', 
      dbAction: operation, 
      table, 
      error 
    });
  },
  
  // API requests
  apiRequest: (method: string, path: string, userId?: number) => {
    logger.debug('API request received', { 
      operation: 'api_request', 
      method, 
      path, 
      userId 
    });
  },
  
  apiResponse: (method: string, path: string, statusCode: number, duration: number) => {
    logger.info('API response sent', { 
      operation: 'api_response', 
      method, 
      path, 
      statusCode, 
      duration 
    });
  },
  
  apiError: (method: string, path: string, error: string, statusCode: number) => {
    logger.error('API request failed', { 
      operation: 'api_error', 
      method, 
      path, 
      error, 
      statusCode 
    });
  }
};

// Ensure logs directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync('logs', { recursive: true });
} catch (error) {
  // Directory already exists or cannot be created
}

export default logger;