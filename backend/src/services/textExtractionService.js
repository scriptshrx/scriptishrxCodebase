// Dependencies are loaded lazily inside extractText() to avoid pulling big
// modules into memory when the worker is first spawned or when the main
// process requires this file for testing.  some of these packages (pdf-parse,
// tesseract, pptx2json, xlsx) are large and account for a sizable portion of
// the heap.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// optional parser for powerpoint - we'll require it only if needed
let pptx2json = null;
function lazyLoadPptx() {
  if (pptx2json !== null) return pptx2json;
  try {
    pptx2json = require('pptx2json');
  } catch (e) {
    pptx2json = null;
  }
  return pptx2json;
}

async function extractText({ buffer, fileType, mimeType }) {
  // Buffers may be serialized over the child process IPC channel and arrive
  // as plain objects like `{ type: 'Buffer', data: [...] }`.  We also want to
  // support callers accidentally passing an ArrayBuffer/Uint8Array.  Convert
  // whatever we received into a proper Node Buffer so downstream libraries
  // (mammoth, pdf-parse, etc.) have a consistent input.  The error seen in the
  // logs (`Can't read the data of 'the loaded zip file'`) was caused by
  // mammoth getting something it didn't understand.
  if (buffer) {
    if (!Buffer.isBuffer(buffer)) {
      if (buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
        buffer = Buffer.from(buffer.data);
      } else if (ArrayBuffer.isView(buffer) || buffer instanceof ArrayBuffer) {
        buffer = Buffer.from(buffer);
      } else {
        // last-ditch attempt; this may throw if the value is truly invalid
        buffer = Buffer.from(buffer);
      }
    }
  }

  let text = '';

  fileType = (fileType || '').toLowerCase();

  // lazy require the big libraries only when we actually use them
  const requirePdf = () => require('pdf-parse');
  const requireXlsx = () => require('xlsx');
  const requireCsv = () => {
    const { parse: csvParse } = require('csv-parse/sync');
    return csvParse;
  };
  const requireCheerio = () => require('cheerio');
  const requireMammoth = () => require('mammoth');
  const requireTesseract = () => require('tesseract.js').createWorker;

  try{

  if (fileType === 'pdf') {
    const pdfParse = requirePdf();
    const data = await pdfParse(buffer);
    text = data.text || '';
  } else if (fileType === 'txt' || fileType === 'md') {
    text = buffer.toString('utf8');
  } else if (fileType === 'xlsx' || fileType === 'xls') {
    const xlsx = requireXlsx();
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    text = workbook.SheetNames
      .map((name) => {
        const sheet = workbook.Sheets[name];
        return xlsx.utils.sheet_to_csv(sheet);
      })
      .join('\n');
  } else if (fileType === 'csv') {
    const csvParse = requireCsv();
    const str = buffer.toString('utf8');
    const records = csvParse(str, { columns: false, skip_empty_lines: true });
    text = records.map((r) => r.join(', ')).join('\n');
  } else if (fileType === 'html' || fileType === 'htm') {
    const cheerio = requireCheerio();
    const html = buffer.toString('utf8');
    const $ = cheerio.load(html);
    text = $('body').text();
  } else if (fileType === 'docx' || fileType === 'doc') {
    const mammoth = requireMammoth();
    const result = await mammoth.extractRawText({ buffer });
    text = result.value || '';
  } else if (fileType === 'ppt' || fileType === 'pptx') {
    const pptx = lazyLoadPptx();
    if (pptx) {
      // write buffer to temp file because pptx2json expects file path
      const tmpPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.${fileType}`);
      await fs.promises.writeFile(tmpPath, buffer);
      try {
        const result = await pptx.parse(tmpPath);
        // flatten by serializing; the json object usually contains slides/text
        text = JSON.stringify(result);
      } finally {
        try { fs.unlinkSync(tmpPath); } catch (e) {}
      }
    } else {
      throw new Error('PPTX parsing library not installed (pptx2json)');
    }
  } else if (mimeType && mimeType.startsWith('image/')) {
    // OCR path
    const createWorker = requireTesseract();
    const worker = createWorker();
    await worker.load();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    const { data } = await worker.recognize(buffer);
    text = data.text || '';
    await worker.terminate();
    if (!text || !text.trim()) {
      throw new Error('OCR failed or produced no text');
    }
  } else {
    throw new Error(`Unsupported file type for text extraction: ${fileType}`);
  }

  if (!text || !text.trim()) {
    throw new Error('Extracted text is empty');
  }
  }
  catch(err){
    console.error('[TextExtraction] error extracting text:', err.message);
    throw err;
  }
  // normalization
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

module.exports = {
  extractText
};