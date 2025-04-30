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
    str = str.replace(/[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F]/g, '"');
    
    // Replace en-dashes and em-dashes with regular hyphens
    str = str.replace(/[\u2013\u2014\u2015\u2212]/g, '-');
    
    // Replace other common problematic characters
    str = str.replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '*') // bullet points
             .replace(/[\u2026]/g, '...') // ellipsis
             .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // various space types
             .replace(/[\u00B7\u2024\u2027\u2219\u22C5\u30FB]/g, '*') // middle dots
             .replace(/[\u2039\u203A\u00AB\u00BB\u2329\u232A\u27E8\u27E9\u3008-\u300B]/g, '"') // angle quotes
             .replace(/[\u2020\u2021\u2022\u2023\u2032\u2033\u2034]/g, '+') // dagger symbols, primes
             .replace(/[\u0085\u2028\u2029]/g, ' ') // line breaks
             .replace(/[\u00AE\u00A9\u2122]/g, '') // registered, copyright, trademark
             .replace(/[\u00B1\u00D7\u00F7\u2044\u2215]/g, '') // math symbols
             .replace(/[\u02DC\u0060\u00B4\u2018\u2019]/g, "'") // Various apostrophes and accents
    
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