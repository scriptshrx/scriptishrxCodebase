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
  if (!msg || !msg.document) {
    process.send({ error: 'Invalid ingestion message' });
    process.exit(1);
    return;
  }

  const { document, buffer, fileType, mimeType } = msg;

  try {
    // perform the same steps that used to live in knowledgeIngestionService
    const extractedText = await textExtractionService.extractText({ buffer, fileType, mimeType });
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
