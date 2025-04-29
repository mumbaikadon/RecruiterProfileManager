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