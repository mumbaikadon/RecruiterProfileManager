/**
 * Advanced search query parser for Profile Record system
 * Converts recruiter-friendly search syntax to PostgreSQL tsquery format
 */

import { profileLogger } from './logger';

export interface ParsedSearchQuery {
  tsquery: string;
  originalQuery: string;
  searchTerms: string[];
  hasComplexLogic: boolean;
}

/**
 * Parse complex search queries with Boolean logic and phrase matching
 * Supports: ("term1" OR "term2") AND (term3 OR term4)
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  profileLogger.searchStart(query, 0);
  
  const originalQuery = query;
  let searchTerms: string[] = [];
  let hasComplexLogic = false;
  
  try {
    // Clean and normalize the query
    let normalizedQuery = query.trim();
    
    // Check if query contains Boolean operators
    hasComplexLogic = /\b(AND|OR)\b/i.test(normalizedQuery) || /[\(\)]/.test(normalizedQuery);
    
    if (!hasComplexLogic) {
      // Simple search - treat as phrase or individual terms
      const terms = extractSearchTerms(normalizedQuery);
      searchTerms = terms;
      const tsquery = terms.map(term => 
        term.includes(' ') ? `"${term}"` : term
      ).join(' & ');
      
      return {
        tsquery,
        originalQuery,
        searchTerms,
        hasComplexLogic: false
      };
    }
    
    // Complex search with Boolean logic
    const tsquery = convertToTsquery(normalizedQuery);
    searchTerms = extractAllTerms(normalizedQuery);
    
    return {
      tsquery,
      originalQuery,
      searchTerms,
      hasComplexLogic: true
    };
    
  } catch (error) {
    profileLogger.searchError(query, `Parse error: ${error}`);
    
    // Fallback to simple search
    const fallbackTerms = query.split(/\s+/).filter(term => term.length > 0);
    return {
      tsquery: fallbackTerms.join(' & '),
      originalQuery,
      searchTerms: fallbackTerms,
      hasComplexLogic: false
    };
  }
}

/**
 * Convert recruiter search syntax to PostgreSQL tsquery format
 */
function convertToTsquery(query: string): string {
  let tsquery = query;
  
  // Step 1: Handle quoted phrases - convert to PostgreSQL phrase syntax
  tsquery = tsquery.replace(/"([^"]+)"/g, (match, phrase) => {
    // Convert phrase to PostgreSQL phrase search format
    const words = phrase.trim().split(/\s+/);
    return words.join(' <-> ');
  });
  
  // Step 2: Handle parentheses - keep them for grouping
  // PostgreSQL tsquery supports parentheses for grouping
  
  // Step 3: Convert Boolean operators
  tsquery = tsquery.replace(/\bOR\b/gi, ' | ');
  tsquery = tsquery.replace(/\bAND\b/gi, ' & ');
  
  // Step 4: Handle implicit AND between terms (space-separated)
  // First normalize spaces around operators
  tsquery = tsquery.replace(/\s*\|\s*/g, ' | ');
  tsquery = tsquery.replace(/\s*&\s*/g, ' & ');
  
  // Split by operators and parentheses to find terms that need connecting
  const parts = tsquery.split(/(\s*[\|\&]\s*|\s*[\(\)]\s*)/);
  const processed = parts.map(part => {
    const trimmed = part.trim();
    // If it's not an operator or parenthesis, treat multiple words as AND
    if (trimmed && !/(^\s*[\|\&\(\)]\s*$)/.test(trimmed)) {
      return trimmed.replace(/\s+/g, ' & ');
    }
    return trimmed;
  });
  
  tsquery = processed.join(' ');
  
  // Step 5: Clean up extra spaces and duplicate operators
  tsquery = tsquery.replace(/\s+/g, ' ').trim();
  tsquery = tsquery.replace(/(&\s*&+|&\s*\||\|\s*&)/g, (match) => {
    if (match.includes('|')) return ' | ';
    return ' & ';
  });
  
  // Remove leading/trailing operators
  tsquery = tsquery.replace(/^[\s&|]+|[\s&|]+$/g, '');
  
  return tsquery;
}

/**
 * Extract all search terms from the query (for highlighting and analysis)
 */
function extractAllTerms(query: string): string[] {
  const terms: string[] = [];
  
  // Extract quoted phrases
  const quotedMatches = query.match(/"([^"]+)"/g);
  if (quotedMatches) {
    quotedMatches.forEach(match => {
      terms.push(match.replace(/"/g, ''));
    });
  }
  
  // Extract individual words (excluding operators and quotes)
  const remainingQuery = query.replace(/"[^"]*"/g, '').replace(/\b(AND|OR)\b/gi, '');
  const words = remainingQuery.split(/[\s\(\)]+/).filter(word => 
    word.length > 2 && !/^(and|or)$/i.test(word)
  );
  
  terms.push(...words);
  
  return [...new Set(terms)]; // Remove duplicates
}

/**
 * Extract search terms from simple queries
 */
function extractSearchTerms(query: string): string[] {
  // Check if it's a quoted phrase
  if (query.startsWith('"') && query.endsWith('"')) {
    return [query.slice(1, -1)];
  }
  
  // Check if it contains quotes
  const quotedPhrases = query.match(/"([^"]+)"/g);
  const terms: string[] = [];
  
  if (quotedPhrases) {
    quotedPhrases.forEach(phrase => {
      terms.push(phrase.slice(1, -1));
    });
  }
  
  // Extract remaining words
  const remaining = query.replace(/"[^"]*"/g, '');
  const words = remaining.split(/\s+/).filter(word => word.length > 0);
  terms.push(...words);
  
  return terms;
}

/**
 * Validate and sanitize tsquery to prevent PostgreSQL errors
 */
export function sanitizeTsquery(tsquery: string): string {
  // Remove potentially problematic characters
  let sanitized = tsquery.replace(/[^\w\s&|()<>-]/g, ' ');
  
  // Ensure operators are properly spaced
  sanitized = sanitized.replace(/([&|])/g, ' $1 ');
  
  // Clean up multiple spaces
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // Ensure query doesn't start or end with operators
  sanitized = sanitized.replace(/^[&|]+|[&|]+$/g, '');
  
  return sanitized || 'empty_search_term';
}

/**
 * Build search explanation for debugging and user feedback
 */
export function explainSearchQuery(parsed: ParsedSearchQuery): string {
  const { originalQuery, searchTerms, hasComplexLogic, tsquery } = parsed;
  
  let explanation = `Original: "${originalQuery}"\n`;
  explanation += `Terms: ${searchTerms.join(', ')}\n`;
  explanation += `Complex Logic: ${hasComplexLogic ? 'Yes' : 'No'}\n`;
  explanation += `PostgreSQL Query: ${tsquery}`;
  
  return explanation;
}

/**
 * Test search parser with example queries
 */
export function testSearchParser(): void {
  const testQueries = [
    'JavaScript React',
    '"Senior Developer" AND React',
    '("Senior Front End Engineer" OR "Senior React Developer") AND (React OR "React.js")',
    'Java AND ("Spring Boot" OR "Spring Framework")',
    'PostgreSQL OR MongoDB OR NoSQL',
    '"Full Stack Developer" AND (JavaScript OR TypeScript) AND (Node.js OR Express)',
  ];
  
  console.log('Testing Search Parser:');
  testQueries.forEach(query => {
    const parsed = parseSearchQuery(query);
    console.log(`\nQuery: ${query}`);
    console.log(`TSQuery: ${parsed.tsquery}`);
    console.log(`Terms: ${parsed.searchTerms.join(', ')}`);
    console.log(`Complex: ${parsed.hasComplexLogic}`);
  });
}