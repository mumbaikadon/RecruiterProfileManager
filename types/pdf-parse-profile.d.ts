/**
 * Type definitions for pdf-parse module used in Profile Document Parser
 */

declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion?: string;
      IsAcroFormPresent?: boolean;
      IsXFAPresent?: boolean;
      Title?: string;
      Author?: string;
      Subject?: string;
      Keywords?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: Date;
      ModDate?: Date;
      [key: string]: any;
    };
    metadata?: {
      [key: string]: any;
    };
    version?: string;
  }

  interface PDFOptions {
    max?: number;
    version?: string;
    normalizeWhitespace?: boolean;
    disableCombineTextItems?: boolean;
    [key: string]: any;
  }

  function pdfParse(buffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  
  export = pdfParse;
}