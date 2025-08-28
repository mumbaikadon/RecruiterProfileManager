/**
 * Type definitions for pdfjs-dist
 */

declare module 'pdfjs-dist/legacy/build/pdf.mjs' {
  export interface TextItem {
    str: string;
    dir: string;
    width: number;
    height: number;
    transform: number[];
    fontName: string;
  }

  export interface TextContent {
    items: TextItem[];
    styles: { [key: string]: any };
  }

  export interface PDFPageProxy {
    getTextContent(): Promise<TextContent>;
    cleanup(): void;
  }

  export interface PDFDocumentProxy {
    numPages: number;
    getPage(pageNum: number): Promise<PDFPageProxy>;
    destroy(): void;
  }

  export interface PDFLoadingTask {
    promise: Promise<PDFDocumentProxy>;
  }

  export interface PDFSource {
    data: Uint8Array;
    useSystemFonts?: boolean;
    disableFontFace?: boolean;
    verbosity?: number;
    cMapUrl?: string;
    cMapPacked?: boolean;
    standardFontDataUrl?: string;
  }

  export const GlobalWorkerOptions: {
    workerSrc: string | null;
  };

  export function getDocument(src: PDFSource): PDFLoadingTask;
}