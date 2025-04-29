import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
    console.warn("Advanced HTML sanitization failed, using fallback", error);
    return str.replace(/<[^>]*>/g, '').trim();
  }
}