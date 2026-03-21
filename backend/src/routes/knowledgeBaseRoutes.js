const express = require('express');
const upload = require('../middleware/uploadMiddleware');
const controller = require('../controllers/knowledgeBaseController');

const router = express.Router();

// list all knowledge bases for tenant
router.get('/', controller.listBases);
// create a new knowledge base
router.post('/', controller.createBase);

// list documents for a specific KB
router.get('/:knowledgeBaseId/documents', controller.listDocuments);

// POST /api/knowledge-bases/:knowledgeBaseId/documents
router.post('/:knowledgeBaseId/documents', upload.single('file'), controller.uploadDocument);

// DELETE /api/knowledge-bases/:knowledgeBaseId/documents/:documentId
router.delete('/:knowledgeBaseId/documents/:documentId', controller.deleteDocument);

// list websites for a specific KB
router.get('/:knowledgeBaseId/websites', controller.listWebsites);

// POST /api/knowledge-bases/:knowledgeBaseId/websites
router.post('/:knowledgeBaseId/websites', controller.addWebsite);

// DELETE /api/knowledge-bases/:knowledgeBaseId/websites/:websiteId
router.delete('/:knowledgeBaseId/websites/:websiteId', controller.deleteWebsite);

module.exports = router;