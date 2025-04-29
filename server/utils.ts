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
  
  try {
    // Remove DOCTYPE, XML declarations, and HTML comments
    str = str.replace(/<!DOCTYPE[^>]*>/gi, '')
             .replace(/<\?xml[^>]*\?>/gi, '')
             .replace(/<!--[\s\S]*?-->/g, '');
    
    // Remove HTML tags - more thorough regex that handles malformed tags better
    str = str.replace(/<[^>]*>?/g, '');
    
    // Decode HTML entities
    str = str.replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, " ");
    
    // Remove any leftover angle brackets that might cause JSON parsing issues
    str = str.replace(/[<>]/g, '');
    
    return str.trim();
  } catch (error) {
    // If anything goes wrong with regex, return a simpler sanitized string
    console.warn("Advanced HTML sanitization failed, using fallback:", error);
    return str.replace(/<[^>]*>/g, '').trim();
  }
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