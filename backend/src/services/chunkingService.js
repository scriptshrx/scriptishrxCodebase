// backend/src/services/chunkingService.js
// Simple character-based chunking with overlap

function chunkText(text, { minSize = 800, maxSize = 1200, overlap = 100 } = {}) {
  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + maxSize;
    if (end >= text.length) {
      end = text.length;
    } else {
      // try to break at last space before maxSize for nicer boundaries
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start + minSize) {
        end = lastSpace;
      }
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({ chunkIndex: index++, content });
    }

    start = end - overlap;
    if (start < 0) start = 0;
  }

  return chunks;
}

module.exports = {
  chunkText
};