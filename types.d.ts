// Type declarations for modules without type definitions

declare module 'node-nlp' {
  export class NlpManager {
    constructor(options: { language: string });
    addLanguage(language: string): void;
    addDocument(language: string, text: string, intent: string): void;
    addNamedEntityText(entity: string, option: string, languages: string[], values: string[]): void;
    train(): Promise<void>;
    process(language: string, text: string): Promise<any>;
  }
  
  export class NlpUtil {
    static getCulture(locale: string): string;
    static getLanguage(locale: string): string;
    static getLocale(str: string): string;
  }
  
  export class SentimentAnalyzer {
    constructor(options: { language: string });
    getSentiment(text: string, callback?: (err: Error, result: any) => void): any;
  }
}

declare module 'pdf-parse' {
  function parse(buffer: Buffer): Promise<{ text: string }>;
  export = parse;
}

declare module 'mammoth' {
  export function extractRawText(options: { buffer: Buffer }): Promise<{ value: string }>;
}

declare module 'natural' {
  export class WordTokenizer {
    tokenize(text: string): string[];
  }

  export const PorterStemmer: {
    stem(word: string): string;
  };

  export class WordNet {
    lookup(word: string, callback: (results: any) => void): void;
  }

  export class TfIdf {
    addDocument(text: string): void;
    tfidfs(text: string, callback: (i: number, measure: number) => void): void;
  }
}