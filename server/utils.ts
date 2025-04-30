/**
 * Utility functions for the server
 */

/**
 * Improved sanitization function that preserves more content while ensuring DB safety
 * Preserves technical terms, keywords, and skills that are important for resume analysis
 * @param str The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeHtml(str: string): string {
  if (!str) return '';
  
  try {
    console.log(`Original text length before sanitizing: ${str.length}`);
    
    // Store the original length for logging
    const originalLength = str.length;
    
    // Only remove problematic DOCTYPE, XML declarations, and HTML comments
    if (str.includes('<!DOCTYPE') || str.includes('<?xml') || str.includes('<!--')) {
      str = str.replace(/<!DOCTYPE[^>]*>/gi, ' ')
               .replace(/<\?xml[^>]*\?>/gi, ' ')
               .replace(/<!--[\s\S]*?-->/g, ' ');
    }
    
    // More careful HTML tag removal that preserves content
    if (str.includes('<') && str.includes('>')) {
      // Replace tags with spaces to avoid word concatenation
      str = str.replace(/<[^>]*>?/g, ' ');
    }
    
    // Decode common HTML entities to preserve content
    str = str.replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&amp;/g, '&')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'")
             .replace(/&nbsp;/g, " ");
    
    // Handle special characters from Word documents that cause encoding issues
    
    // Replace smart quotes with straight quotes
    str = str.replace(/[\u2018\u2019\u201A\u201B]/g, "'") // single quotes
             .replace(/[\u201C\u201D\u201E\u201F]/g, '"'); // double quotes
    
    // Replace en-dashes and em-dashes with regular hyphens
    str = str.replace(/[\u2013\u2014\u2015\u2212]/g, '-');
    
    // Preserve technical terms with special characters like C++, C#
    // First, temporarily replace known technical terms
    const techTerms = [
      { pattern: /\bC\+\+\b/g, replacement: '_CPP_PLACEHOLDER_' },
      { pattern: /\bC#\b/g, replacement: '_CSHARP_PLACEHOLDER_' },
      { pattern: /\.NET\b/gi, replacement: '_DOTNET_PLACEHOLDER_' },
      { pattern: /\bNode\.js\b/gi, replacement: '_NODEJS_PLACEHOLDER_' },
      { pattern: /\bTypeScript\b/gi, replacement: '_TYPESCRIPT_PLACEHOLDER_' },
      { pattern: /\bJavaScript\b/gi, replacement: '_JAVASCRIPT_PLACEHOLDER_' }
    ];
    
    // Apply placeholder replacements
    techTerms.forEach(term => {
      str = str.replace(term.pattern, term.replacement);
    });
    
    // Replace other common problematic characters - more conservative approach
    str = str.replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, '* ') // bullet points to asterisks with space
             .replace(/[\u2026]/g, '...') // ellipsis
             .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // normalize spaces
             .replace(/[\u00B7\u2024\u2027\u2219\u22C5\u30FB]/g, '* ') // middle dots to asterisks with space
             
             // Handle formatting characters
             .replace(/[\u00AB\u00BB\u2329\u232A\u27E8\u27E9\u3008-\u300B]/g, '"') // angle quotes to regular quotes
             .replace(/[\u0085\u2028\u2029]/g, '\n') // convert special linebreaks to standard ones
             
             // Standardize common symbols
             .replace(/[\u00AE]/g, '(R)') // registered
             .replace(/[\u00A9]/g, '(C)') // copyright
             .replace(/[\u2122]/g, '(TM)') // trademark
    
    // Handle non-printable control characters that could cause database issues
    // But preserve basic whitespace (space, tab, newline)
    str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
    
    // Standard whitespace normalization that preserves paragraph structure
    str = str.replace(/[ \t]+/g, ' ') // Normalize spaces/tabs to single spaces
             .replace(/\n{3,}/g, '\n\n') // Normalize multiple newlines to max 2
             .trim();
    
    // If we've destroyed more than 40% of the content, something went wrong
    // Use a more conservative approach
    if (str.length < originalLength * 0.6) {
      console.warn(`Sanitization removed too much content (${str.length}/${originalLength}), using conservative approach`);
      
      // More conservative sanitization that focuses mainly on control characters
      str = originalLength > 0 ? 
        originalLength.toString()
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Just remove control chars
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim() : '';
    }
    
    // Restore technical terms from placeholders
    str = str.replace(/_CPP_PLACEHOLDER_/g, 'C++')
             .replace(/_CSHARP_PLACEHOLDER_/g, 'C#')
             .replace(/_DOTNET_PLACEHOLDER_/g, '.NET')
             .replace(/_NODEJS_PLACEHOLDER_/g, 'Node.js')
             .replace(/_TYPESCRIPT_PLACEHOLDER_/g, 'TypeScript')
             .replace(/_JAVASCRIPT_PLACEHOLDER_/g, 'JavaScript');
    
    console.log(`Sanitized text final length: ${str.length} (${Math.round(str.length/originalLength*100)}% of original)`);
    
    return str;
  } catch (error) {
    // If anything goes wrong with regex, use a simpler approach
    console.warn("Advanced HTML sanitization failed, using fallback:", error);
    try {
      // Better fallback that preserves basic structure
      const simpleClean = str
        .replace(/<[^>]*>/g, ' ') // Remove HTML tags
        .replace(/[^\x20-\x7E\r\n]/g, ' ') // Replace non-ASCII with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      console.log(`Fallback sanitization resulted in ${simpleClean.length} characters`);
      return simpleClean;
    } catch (e) {
      // Ultimate fallback
      console.error("All sanitization attempts failed:", e);
      return str.substring(0, 10000); // Return truncated original as last resort
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