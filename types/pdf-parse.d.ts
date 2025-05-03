/**
 * Type definitions for pdf-parse
 */

declare module 'pdf-parse' {
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion: string;
      IsAcroFormPresent: boolean;
      IsXFAPresent: boolean;
      [key: string]: any;
    };
    metadata: {
      [key: string]: any;
    };
    version: string;
  };

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;
  
  export = pdfParse;
}

declare module 'pdf-parse/lib/pdf-parse.js' {
  import pdfParse from 'pdf-parse';
  export default pdfParse;
}