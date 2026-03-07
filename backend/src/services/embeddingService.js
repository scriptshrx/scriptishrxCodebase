const OpenAI = require('openai');

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

async function getEmbeddings(inputs = []) {
  if (!openai) {
    throw new Error('OpenAI client not initialized');
  }

  if (!Array.isArray(inputs)) {
    inputs = [inputs];
  }

  const results = [];
  try {
    // OpenAI supports batching directly by passing an array
    const resp = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: inputs
    });
    for (const item of resp.data) {
      results.push(item.embedding);
    }
    return results;
  } catch (err) {
    console.error('[EmbeddingService] error generating embeddings', err.message);
    throw err;
  }
}

module.exports = {
  getEmbeddings
};