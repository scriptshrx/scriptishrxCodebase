const pdfParse = require('pdf-parse');
const xlsx = require('xlsx');
const csvParse = require('csv-parse/lib/sync');
const cheerio = require('cheerio');
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// optional parser for powerpoint
let pptx2json = null;
try {
  pptx2json = require('pptx2json');
} catch (e) {
  // library may not be installed; caller must add dependency or fallback will be used
}

async function extractText({ buffer, fileType, mimeType }) {
  let text = '';

  fileType = (fileType || '').toLowerCase();

  if (fileType === 'pdf') {
    const data = await pdfParse(buffer);
    text = data.text || '';
  } else if (fileType === 'txt' || fileType === 'md') {
    text = buffer.toString('utf8');
  } else if (fileType === 'xlsx' || fileType === 'xls') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    text = workbook.SheetNames
      .map((name) => {
        const sheet = workbook.Sheets[name];
        return xlsx.utils.sheet_to_csv(sheet);
      })
      .join('\n');
  } else if (fileType === 'csv') {
    const str = buffer.toString('utf8');
    const records = csvParse(str, { columns: false, skip_empty_lines: true });
    text = records.map((r) => r.join(', ')).join('\n');
  } else if (fileType === 'html' || fileType === 'htm') {
    const html = buffer.toString('utf8');
    const $ = cheerio.load(html);
    text = $('body').text();
  } else if (fileType === 'ppt' || fileType === 'pptx') {
    if (pptx2json) {
      // write buffer to temp file because pptx2json expects file path
      const tmpPath = path.join(os.tmpdir(), `${crypto.randomUUID()}.${fileType}`);
      await fs.promises.writeFile(tmpPath, buffer);
      try {
        const result = await pptx2json.parse(tmpPath);
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

  // normalization
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

module.exports = {
  extractText
};