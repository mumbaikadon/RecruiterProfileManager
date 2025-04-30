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

  export class WordTokenizer {
    tokenize(text: string): string[];
  }

  export const PorterStemmer: {
    stem(word: string): string;
  };
}