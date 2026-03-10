// This script runs in a separate Node process (forked by knowledgeIngestionService)
// to perform the heavy text extraction / embedding work. Keeping it out of the
// main server process prevents a single upload from blowing up the heap and also
// allows us to give the worker its own memory limits (via execArgv).

const prisma = require('../lib/prisma');
// lazily require the big services inside the worker so the main process doesn't
// load them until a job is actually processed.
const textExtractionService = require('./textExtractionService');
const chunkingService = require('./chunkingService');
const embeddingService = require('./embeddingService');
const crypto = require('crypto');

// When the parent sends a message we assume it's the ingestion payload
process.on('message', async (msg) => {
  console.log('[KnowledgeIngestionWorker] received message', msg && msg.document && msg.document.id);
  if (!msg || !msg.document) {
    process.send({ error: 'Invalid ingestion message' });
    process.exit(1);
    return;
  }

  const { document, buffer: incomingBuffer, fileType, mimeType } = msg;

  // IPC serialization can convert Buffers into plain objects, so do a quick
  // coercion here as well before handing it off to the extraction service.
  let buffer = incomingBuffer;
  if (buffer && !Buffer.isBuffer(buffer)) {
    try {
      if (buffer.type === 'Buffer' && Array.isArray(buffer.data)) {
        buffer = Buffer.from(buffer.data);
      } else if (ArrayBuffer.isView(buffer) || buffer instanceof ArrayBuffer) {
        buffer = Buffer.from(buffer);
      } else {
        buffer = Buffer.from(buffer);
      }
    } catch (e) {
      console.error('[KnowledgeIngestionWorker] failed to normalize buffer', e.message);
      buffer = null;
    }
  }

  console.log('[KnowledgeIngestionWorker] starting text extraction', { fileType, mimeType, length: buffer && buffer.length });

  try {
    // perform the same steps that used to live in knowledgeIngestionService
    const extractedText = await textExtractionService.extractText({ buffer, fileType, mimeType });
    console.log('[KnowledgeIngestionWorker] extraction complete, length', extractedText.length);
    const chunks = chunkingService.chunkText(extractedText);
    const texts = chunks.map(c => c.content);
    const embeddings = await embeddingService.getEmbeddings(texts);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const emb = embeddings[i];
      const chunkId = crypto.randomUUID();
      await prisma.$executeRaw`
        INSERT INTO knowledge_chunks
          (id, tenant_id, document_id, chunk_index, content, embedding)
        VALUES
          (${chunkId}, ${document.tenantId}, ${document.id}, ${chunk.chunkIndex}, ${chunk.content}, ${emb}::vector)
      `;
    }

    await prisma.knowledgeDocuments.update({
      where: { id: document.id },
      data: {
        status: 'ready',
        extractedText,
        chunkCount: chunks.length
      }
    });

    process.send({ success: true });
    console.log('[KnowledgeIngestionWorker] done');
    process.exit(0);
  } catch (err) {
    console.error('[KnowledgeIngestionWorker] error', err.message);
    try {
      await prisma.knowledgeDocuments.update({
        where: { id: document.id },
        data: { status: 'failed', errorMessage: err.message }
      });
    } catch (e) {
      console.error('[KnowledgeIngestionWorker] failed to update document status', e.message);
    }
    process.send({ error: err.message });
    process.exit(1);
  }
});
