// Type declarations for modules without type definitions

declare module 'node-nlp' {
  export class NlpManager {
    constructor(options: { language: string });
    // Add more methods as needed
  }
  
  export class NlpUtil {
    // Add methods as needed
  }
  
  export class SentimentAnalyzer {
    constructor(options: { language: string });
    // Add methods as needed
  }
  
  // Add more exports as needed
}

declare module 'pdf-parse' {
  function parse(buffer: Buffer): Promise<{ text: string }>;
  export = parse;
}

declare module 'mammoth' {
  export function extractRawText(options: { buffer: Buffer }): Promise<{ value: string }>;
}