/**
 * Utility functions for the server
 */

/**
 * Sanitizes a string by removing HTML tags, XML declarations, and handling special characters
 * that could cause database encoding issues
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
    
    // Handle special characters from Word documents that cause encoding issues
    
    // Replace smart quotes with regular quotes
    str = str.replace(/[\u2018\u2019]/g, "'")
             .replace(/[\u201C\u201D]/g, '"');
    
    // Replace en-dashes and em-dashes with regular hyphens
    str = str.replace(/[\u2013\u2014]/g, '-');
    
    // Replace other common problematic characters
    str = str.replace(/[\u2022]/g, '*') // bullet points
             .replace(/[\u2026]/g, '...') // ellipsis
             .replace(/[\u00A0]/g, ' ') // non-breaking space
             .replace(/[\u00B7]/g, '*') // middle dot
             .replace(/[\u2015]/g, '-') // horizontal bar
             .replace(/[\u2212]/g, '-') // minus sign
             .replace(/[\u201A\u201B\u201E\u201F]/g, '"') // other quote variants
             .replace(/[\u2039\u203A\u00AB\u00BB]/g, '"') // angle quotes
             .replace(/[\u2020\u2021]/g, '+') // dagger symbols
    
    // Handle non-printable control characters that could cause database issues
    str = str.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Normalize Unicode to improve compatibility (converts to closest ASCII representation)
    if (typeof str.normalize === 'function') {
      str = str.normalize('NFKD')
               .replace(/[\u0300-\u036f]/g, ''); // Remove combining diacritical marks
    }
    
    return str.trim();
  } catch (error) {
    // If anything goes wrong with regex, return a simpler sanitized string
    console.warn("Advanced HTML sanitization failed, using fallback:", error);
    try {
      // Fallback: strip all non-ASCII characters for maximum compatibility
      return str.replace(/[^\x20-\x7E]/g, '').trim();
    } catch (e) {
      // Ultimate fallback
      return '';
    }
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