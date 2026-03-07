const prisma = require('../lib/prisma');
const textExtractionService = require('./textExtractionService');
const chunkingService = require('./chunkingService');
const embeddingService = require('./embeddingService');
const crypto = require('crypto');

async function ingestDocument({ document, buffer, fileType, mimeType }) {
  try {
    // 1. Extract text
    const extractedText = await textExtractionService.extractText({ buffer, fileType, mimeType });

    // 2. Chunk the text
    const chunks = chunkingService.chunkText(extractedText);

    // 3. Generate embeddings in batches
    const texts = chunks.map(c => c.content);
    const embeddings = await embeddingService.getEmbeddings(texts);

    // 4. Insert chunks using raw SQL to support vector type
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

    // 5. Update document record
    await prisma.knowledgeDocument.update({
      where: { id: document.id },
      data: {
        status: 'ready',
        extractedText,
        chunkCount: chunks.length
      }
    });
    return { success: true };
  } catch (err) {
    console.error('[KnowledgeIngestion] error', err.message);
    try {
      await prisma.knowledgeDocument.update({
        where: { id: document.id },
        data: { status: 'failed', errorMessage: err.message }
      });
    } catch (e) {
      console.error('[KnowledgeIngestion] failed to update document status', e.message);
    }
    throw err;
  }
}

module.exports = {
  ingestDocument
};