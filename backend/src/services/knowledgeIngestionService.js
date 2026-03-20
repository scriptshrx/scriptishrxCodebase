const prisma = require('../lib/prisma');
const crypto = require('crypto');

// the ingestion work is delegated to a separate process to avoid blowing the
// heap of the main server.  Render / other small containers frequently have
// <1GB RAM and libraries like pdf-parse, tesseract, etc. can consume several
// hundred megabytes; running them in-process makes even a tiny upload trigger an
// out‑of‑memory crash.

const { fork } = require('child_process');
const path = require('path');

function ingestDocument({ document, buffer, fileType, mimeType }) {
  console.log('[IngestionService] ingestDocument called', {
    documentId: document.id,
    fileType,
    mimeType,
    size: buffer?.length,
    isBuffer: Buffer.isBuffer(buffer)
  });
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(__dirname, './knowledgeIngestionWorker.js');

    // fork a new node process with a slightly larger heap so the worker can
    // comfortably handle extraction/embedding.  You can tweak the size or move
    // the flag to NODE_OPTIONS in your Render environment.
    // memory for the worker can be raised with NODE_HEAP_SIZE env var (MB)
    const memSize = process.env.NODE_HEAP_SIZE || '512';
    
    // Pass along critical env vars to worker
    const workerEnv = {
      ...process.env,
      NODE_HEAP_SIZE: memSize,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      NODE_ENV: process.env.NODE_ENV || 'production'
    };
    
    const child = fork(workerPath, [], {
      execArgv: [`--max-old-space-size=${memSize}`],
      env: workerEnv
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      console.error('[IngestionService] worker timeout after 5 minutes');
      child.kill('SIGTERM');
      reject(new Error('Document processing timeout (5 minutes exceeded)'));
    }, 5 * 60 * 1000);

    child.on('message', (msg) => {
      console.log('[IngestionService] worker message', msg);
      if (!timedOut) {
        clearTimeout(timeout);
      }
      if (msg && msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg);
      }
    });

    child.on('error', (err) => {
      console.error('[IngestionService] worker error', err);
      clearTimeout(timeout);
      reject(err);
    });
    
    child.on('exit', (code, signal) => {
      console.log(`[IngestionService] worker exited with code ${code}, signal ${signal}`);
      clearTimeout(timeout);
      if (!timedOut && code !== 0) {
        reject(new Error(`ingestion worker exited with code ${code}`));
      }
    });

    // send payload and let the worker do the heavy lifting
    child.send({ document, buffer, fileType, mimeType });
    console.log('[IngestionService] payload sent to worker');
  });
}

module.exports = {
  ingestDocument
};