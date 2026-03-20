const express = require('express');
const auth = require('../lib/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const controller = require('../controllers/knowledgeBaseController');

const router = express.Router();

// list all knowledge bases for tenant
router.get('/', auth, controller.listBases);
// create a new knowledge base
router.post('/', auth, controller.createBase);

// list documents for a specific KB
router.get('/:knowledgeBaseId/documents', auth, controller.listDocuments);

// POST /api/knowledge-bases/:knowledgeBaseId/documents
router.post('/:knowledgeBaseId/documents', auth, upload.single('file'), controller.uploadDocument);

// DELETE /api/knowledge-bases/:knowledgeBaseId/documents/:documentId
router.delete('/:knowledgeBaseId/documents/:documentId', auth, controller.deleteDocument);

module.exports = router;