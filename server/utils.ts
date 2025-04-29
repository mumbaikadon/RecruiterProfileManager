/**
 * Utility functions for the server
 */

/**
 * Sanitizes a string by removing HTML tags and XML declarations
 * @param str The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeHtml(str: string): string {
  if (!str) return '';
  
  // Remove DOCTYPE, XML declarations, and HTML comments
  str = str.replace(/<!DOCTYPE[^>]*>/i, '')
           .replace(/<\?xml[^>]*\?>/i, '')
           .replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove HTML tags
  str = str.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  str = str.replace(/&lt;/g, '<')
           .replace(/&gt;/g, '>')
           .replace(/&amp;/g, '&')
           .replace(/&quot;/g, '"')
           .replace(/&#39;/g, "'");
  
  return str.trim();
}

/**
 * Validates that a string is valid JSON
 * @param str The string to validate
 * @returns True if the string is valid JSON, false otherwise
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}