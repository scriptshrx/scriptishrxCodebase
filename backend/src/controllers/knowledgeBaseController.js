const prisma = require('../lib/prisma');
const knowledgeIngestionService = require('../services/knowledgeIngestionService');

// tenant validation helpers
function getTenantId(req) {
    return req.user?.tenantId || req.headers['x-tenant-id'];
}

async function uploadDocument(req, res) {
    const tenantId = getTenantId(req);
    if (!tenantId) {
        return res.status(400).json({ error: 'Missing tenant context' });
    }

    const knowledgeBaseId = req.params.knowledgeBaseId;
    if (!knowledgeBaseId) {
        return res.status(400).json({ error: 'Missing knowledge base id' });
    }

    // check file presence
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;

    try {
        // verify KB exists and belongs to tenant
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
        if (!kb || kb.tenantId !== tenantId) {
            return res.status(403).json({ error: 'Knowledge base not found or access denied' });
        }

        // create document record
        const ext = file.originalname.split('.').pop().toLowerCase();
        const doc = await prisma.knowledgeDocuments.create({
            data: {
                tenantId,
                knowledgeBaseId,
                title: req.body.title || file.originalname,
                fileName: file.originalname,
                fileType: ext,
                mimeType: file.mimetype,
                fileSize: file.size,
                status: 'processing'
            }
        });

        // trigger ingestion asynchronously
        knowledgeIngestionService
            .ingestDocument({
                document: doc,
                buffer: file.buffer,
                fileType: ext,
                mimeType: file.mimetype
            })
            .catch(err => {
                console.error('[KB Controller] ingestion failed', err.message);
            });

        // respond early
        res.status(202).json({
            message: 'File received, ingestion started',
            documentId: doc.id
        });
    } catch (err) {
        console.error('[KB Controller] uploadDocument error', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
}

async function listBases(req, res) {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json({ error: 'Missing tenant context' });
    const bases = await prisma.knowledgeBase.findMany({ where: { tenantId } });
    res.json({ bases });
}

async function createBase(req, res) {
    const tenantId = getTenantId(req);
    const { name, description } = req.body || {};
    if (!tenantId || !name) {
        return res.status(400).json({ error: 'Tenant and name required' });
    }
    const newKb = await prisma.knowledgeBase.create({
        data: { tenantId, name, description }
    });
    res.status(201).json({ base: newKb });
}

async function listDocuments(req, res) {
    const tenantId = getTenantId(req);
    const { knowledgeBaseId } = req.params;
    if (!tenantId || !knowledgeBaseId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
    if (!kb || kb.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const docs = await prisma.knowledgeDocuments.findMany({
        where: { knowledgeBaseId, tenantId }
    });
    res.json({ documents: docs });
}

module.exports = {
    uploadDocument,
    listBases,
    createBase,
    listDocuments
};