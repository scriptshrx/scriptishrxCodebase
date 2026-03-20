const prisma = require('../lib/prisma');
const knowledgeIngestionService = require('../services/knowledgeIngestionService');
const webScraperService = require('../services/webScraperService');
const chunkingService = require('../services/chunkingService');
const embeddingService = require('../services/embeddingService');

// tenant validation helpers
function getTenantId(req) {
    return req.user?.tenantId || req.headers['x-tenant-id'];
}

async function uploadDocument(req, res) {
    const tenantId = getTenantId(req);
    console.log('\x1b[1m[KB Controller]\x1b[0m uploadDocument called');
    if (!tenantId) {
        console.warn('[KB Controller] missing tenant context');
        return res.status(400).json({ error: 'Missing tenant context' });
    }

    const knowledgeBaseId = req.params.knowledgeBaseId;
    if (!knowledgeBaseId) {
        console.warn('[KB Controller] missing knowledgeBaseId');
        return res.status(400).json({ error: 'Missing knowledge base id' });
    }

    // check file presence
    if (!req.file) {
        console.warn('[KB Controller] no file uploaded');
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    console.log(`\x1b[1m[KB Controller]\x1b[0m received file ${file.originalname} (${file.mimetype}, ${file.size} bytes) bufferIsBuffer=${Buffer.isBuffer(file.buffer)} length=${file.buffer?.length}`);

    try {
        // verify KB exists and belongs to tenant
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
        if (!kb || kb.tenantId !== tenantId) {
            console.warn('[KB Controller] knowledge base not found or wrong tenant');
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
console.log(`\x1b[1m[KB Controller]\x1b[0m document record created ${doc.id}`);

        // trigger ingestion asynchronously
        knowledgeIngestionService
            .ingestDocument({
                document: doc,
                buffer: file.buffer,
                fileType: ext,
                mimeType: file.mimetype
            })
            .then(() => {
                console.log(`\x1b[1m[KB Controller]\x1b[0m ingestion promise resolved for ${doc.id}`);
            })
            .catch(err => {
                console.error('\x1b[1m[KB Controller]\x1b[0m ingestion failed', err.stack || err.message);
            });

        // respond early
        res.status(202).json({
            message: 'File received, ingestion started',
            documentId: doc.id
        });
    } catch (err) {
        console.error('[KB Controller] uploadDocument error', err.stack || err);
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

async function deleteDocument(req, res) {
    const tenantId = getTenantId(req);
    const { knowledgeBaseId, documentId } = req.params;
    
    if (!tenantId || !knowledgeBaseId || !documentId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        // Verify access
        const doc = await prisma.knowledgeDocuments.findUnique({
            where: { id: documentId }
        });

        if (!doc || doc.tenantId !== tenantId || doc.knowledgeBaseId !== knowledgeBaseId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Delete associated chunks first
        await prisma.knowledgeChunks.deleteMany({
            where: { documentId }
        });

        // Delete document
        await prisma.knowledgeDocuments.delete({
            where: { id: documentId }
        });

        res.json({ success: true, message: 'Document deleted' });
    } catch (err) {
        console.error('[KB Controller] deleteDocument error', err);
        res.status(500).json({ error: 'Failed to delete document', details: err.message });
    }
}

async function listWebsites(req, res) {
    const tenantId = getTenantId(req);
    const { knowledgeBaseId } = req.params;
    if (!tenantId || !knowledgeBaseId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
    if (!kb || kb.tenantId !== tenantId) {
        return res.status(403).json({ error: 'Access denied' });
    }
    const websites = await prisma.knowledgeWebsites.findMany({
        where: { knowledgeBaseId, tenantId }
    });
    res.json({ websites });
}

async function addWebsite(req, res) {
    const tenantId = getTenantId(req);
    const { knowledgeBaseId } = req.params;
    const { url } = req.body || {};

    if (!tenantId || !knowledgeBaseId || !url) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    // Validate URL
    try {
        new URL(url);
    } catch {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
        // Verify KB exists and belongs to tenant
        const kb = await prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId } });
        if (!kb || kb.tenantId !== tenantId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Create website record
        const website = await prisma.knowledgeWebsites.create({
            data: {
                tenantId,
                knowledgeBaseId,
                url,
                status: 'processing'
            }
        });

        console.log(`[KB Controller] website record created ${website.id} for URL ${url}`);

        // Trigger scraping asynchronously
        scrapeAndIngestWebsite(website).catch(err => {
            console.error('[KB Controller] website scraping failed', err.stack || err.message);
        });

        // Response early
        res.status(202).json({
            message: 'Website added, scraping started',
            websiteId: website.id
        });
    } catch (err) {
        console.error('[KB Controller] addWebsite error', err);
        res.status(500).json({ error: 'Failed to add website', details: err.message });
    }
}

async function deleteWebsite(req, res) {
    const tenantId = getTenantId(req);
    const { knowledgeBaseId, websiteId } = req.params;

    if (!tenantId || !knowledgeBaseId || !websiteId) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    try {
        // Verify access
        const website = await prisma.knowledgeWebsites.findUnique({
            where: { id: websiteId }
        });

        if (!website || website.tenantId !== tenantId || website.knowledgeBaseId !== knowledgeBaseId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Delete associated chunks first
        await prisma.knowledgeChunks.deleteMany({
            where: { 
                AND: [
                    { documentId: { in: [] } }, // This won't match any, but we handle websites differently
                    { tenantId }
                ]
            }
        });

        // For now, we're storing website content in the website record itself
        // In future, we could create document-like chunks for websites too

        // Delete website
        await prisma.knowledgeWebsites.delete({
            where: { id: websiteId }
        });

        res.json({ success: true, message: 'Website deleted' });
    } catch (err) {
        console.error('[KB Controller] deleteWebsite error', err);
        res.status(500).json({ error: 'Failed to delete website', details: err.message });
    }
}

/**
 * Background task: Scrape website and ingest content
 */
async function scrapeAndIngestWebsite(website) {
    try {
        console.log(`[KB Controller] Starting website scraping for ${website.id}`);

        // Scrape the website
        const scrapedData = await webScraperService.scrapeWebsite(website.url);

        // Update website with scraped content and title
        const updated = await prisma.knowledgeWebsites.update({
            where: { id: website.id },
            data: {
                title: scrapedData.title || website.url,
                scrapedContent: scrapedData.content,
                status: 'completed'
            }
        });

        console.log(`[KB Controller] Website scraping completed for ${website.id}`);
        return updated;
    } catch (err) {
        console.error(`[KB Controller] Website scraping failed for ${website.id}:`, err.message);

        // Update status to failed
        await prisma.knowledgeWebsites.update({
            where: { id: website.id },
            data: {
                status: 'failed',
                errorMessage: err.message
            }
        }).catch(updateErr => {
            console.error('[KB Controller] Failed to update website status:', updateErr.message);
        });

        throw err;
    }
}

module.exports = {
    uploadDocument,
    listBases,
    createBase,
    listDocuments,
    deleteDocument,
    listWebsites,
    addWebsite,
    deleteWebsite
};