const multer = require('multer');
const path = require('path');

// memory storage keeps file in RAM (buffer) which we need for extraction & embeddings
const storage = multer.memoryStorage();

// limit to 50MB per document by default (adjustable via env)
const MAX_FILE_SIZE = parseInt(process.env.KB_UPLOAD_MAX_SIZE || '50000000');

// allowed extensions for knowledge base documents
const allowedExt = [
  '.pdf', '.txt', '.md', '.csv', '.html', '.htm',
  '.xlsx', '.xls', '.ppt', '.pptx', '.docx', '.doc',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff'
];

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  // allow images by mimetype as well
  if (allowedExt.includes(ext) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type')); // will be handled by route
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

module.exports = upload;