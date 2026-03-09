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
  return new Promise((resolve, reject) => {
    const workerPath = path.resolve(__dirname, './knowledgeIngestionWorker.js');

    // fork a new node process with a slightly larger heap so the worker can
    // comfortably handle extraction/embedding.  You can tweak the size or move
    // the flag to NODE_OPTIONS in your Render environment.
    // memory for the worker can be raised with NODE_HEAP_SIZE env var (MB)
    const memSize = process.env.NODE_HEAP_SIZE || '512';
    const child = fork(workerPath, [], {
      execArgv: [`--max-old-space-size=${memSize}`],
      env: { ...process.env, NODE_HEAP_SIZE: memSize }
    });

    child.on('message', (msg) => {
      if (msg && msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve(msg);
      }
    });

    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`ingestion worker exited with code ${code}`));
      }
    });

    // send payload and let the worker do the heavy lifting
    child.send({ document, buffer, fileType, mimeType });
  });
}

module.exports = {
  ingestDocument
};