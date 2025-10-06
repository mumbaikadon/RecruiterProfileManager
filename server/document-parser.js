import path from 'path';
// Small utility to timebox async operations that may hang on malformed files
async function withTimeout(p, ms, label = 'operation') {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
        const result = await Promise.race([p, timeout]);
        return result;
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * Extract text from a PDF file using pdf-parse
 */
export async function extractTextFromPdf(buffer) {
    try {
        console.log(`PDF extraction: Processing buffer of size ${buffer.length} bytes`);
        // Quick sanity check for PDF signature to avoid mis-typed files
        const isLikelyPdf = buffer.slice(0, 4).toString('ascii') === '%PDF';
        if (!isLikelyPdf) {
            console.warn('PDF extraction: Buffer does not start with %PDF signature; continuing anyway');
        }
        // Load pdf-parse robustly (supports both ESM/CJS builds)
        let pdfParse;
        try {
            const mod = await import('pdf-parse');
            pdfParse = mod.default ?? mod;
        }
        catch (e1) {
            // Fallback to legacy internal path if needed (some bundlers cache this)
            try {
                const modLegacy = await import('pdf-parse/lib/pdf-parse.js');
                pdfParse = modLegacy.default ?? modLegacy;
            }
            catch (e2) {
                console.error('Failed to load pdf-parse module via both entry points');
                throw e1;
            }
        }
        // Limit pages to prevent extreme memory usage on huge PDFs
        const parsePromise = pdfParse(buffer, { max: 50 /* pages */ });
        const data = await withTimeout(parsePromise, 15000, 'pdf-parse');
        const text = (data?.text ?? '').toString();
        const normalized = text.replace(/[\u0000\r]/g, ' ').replace(/\s+/g, ' ').trim();
        console.log(`PDF extraction successful: Extracted ${normalized.length} characters`);
        return normalized;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Provide clearer reasons for common failure modes
        if (/Password/i.test(message)) {
            console.error('PDF extraction error: Password-protected PDF');
            throw new Error('Failed to extract text from PDF: file is password-protected');
        }
        if (/timed out/i.test(message)) {
            console.error('PDF extraction error: Parsing timed out');
            throw new Error('Failed to extract text from PDF: parsing timed out');
        }
        console.error('PDF extraction error:', message);
        throw new Error(`Failed to extract text from PDF: ${message}`);
    }
}
/**
 * Extract text from a DOCX file using mammoth
 */
export async function extractTextFromDocx(buffer) {
    try {
        const mammoth = await import('mammoth');
        const result = await withTimeout(mammoth.extractRawText({ buffer }), 10000, 'mammoth');
        const text = (result?.value ?? '').toString();
        const normalized = text.replace(/[\u0000\r]/g, ' ').replace(/\s+/g, ' ').trim();
        return normalized;
    }
    catch (error) {
        console.error("DOCX extraction error:", error);
        throw new Error("Failed to extract text from DOCX");
    }
}
/**
 * Extract text from a TXT file
 */
export function extractTextFromTxt(buffer) {
    return buffer.toString('utf8');
}
/**
 * Extract text from a document file (pdf, docx, txt)
 */
export async function extractTextFromDocument(buffer, fileType) {
    console.log(`Document extraction: Processing ${fileType} file of size ${buffer.length} bytes`);
    // Handle file type which might be a MIME type or file extension
    const type = fileType.toLowerCase();
    // Handle case where fileType might be a filename with extension
    if (fileType.includes('.')) {
        const extension = path.extname(fileType).toLowerCase().replace('.', '');
        if (extension === 'pdf')
            return extractTextFromPdf(buffer);
        if (extension === 'docx')
            return extractTextFromDocx(buffer);
        if (extension === 'txt')
            return extractTextFromTxt(buffer);
    }
    // Handle by MIME type or direct type string
    switch (type) {
        case "pdf":
        case "application/pdf":
            return extractTextFromPdf(buffer);
        case "docx":
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return extractTextFromDocx(buffer);
        case "txt":
        case "text/plain":
            return extractTextFromTxt(buffer);
        default:
            const guidance = 'Please upload PDF or DOCX files only.';
            console.error(`Unsupported file type: ${fileType}. ${guidance}`);
            throw new Error(`Unsupported file type: ${fileType}. ${guidance}`);
    }
}
