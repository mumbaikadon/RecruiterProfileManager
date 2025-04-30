/**
 * Utility functions for the server
 */

/**
 * Simple logger with different log levels
 */
export const logger = {
  info: (message: string) => {
    console.log(`[INFO] ${message}`);
  },
  warn: (message: string) => {
    console.warn(`[WARNING] ${message}`);
  },
  error: (message: string) => {
    console.error(`[ERROR] ${message}`);
  },
  debug: (message: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`);
    }
  }
};

/**
 * Safely sanitize HTML/JS content for display
 */
export function sanitizeContent(content: string): string {
  if (!content) return '';
  
  // Basic sanitization to prevent XSS attacks
  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Alias for sanitizeContent to maintain backward compatibility
 */
export function sanitizeHtml(content: string): string {
  return sanitizeContent(content);
}

/**
 * Format error response
 */
export function formatErrorResponse(error: any): { message: string; details?: any } {
  return {
    message: error.message || 'An unknown error occurred',
    details: process.env.NODE_ENV !== 'production' ? error : undefined
  };
}

/**
 * Checks if a string is valid JSON
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}