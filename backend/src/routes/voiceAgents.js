// backend/src/routes/voiceAgents.js
const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess } = require('../middleware/subscription');

/**
 * GET /api/voice-agents - list
 */
router.get(
    '/',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const agents = await prisma.voiceAgent.findMany({
                where: { tenantId },
                orderBy: { updatedAt: 'desc' }
            });
            res.json({ success: true, agents });
        } catch (error) {
            console.error('[VoiceAgents] fetch list error', error);
            res.status(500).json({ success: false, error: 'Failed to fetch voice agents' });
        }
    }
);

/**
 * POST /api/voice-agents - create
 */
router.post(
    '/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('voice_agents', 'create'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const userId = req.user?.userId || req.user?.id;
            const {
                name,
                agentType,
                voiceName,
                provider,
                providerAgentId,
                phoneNumber,
                status,
                prompt,
                promptsJson,
                llmConfigJson,
                // new single-prompt specific
                mode,
                welcomeMessage,
                llmModel,
                language,
                template,
                config
            } = req.body;

            if (!name || !agentType || !voiceName) {
                return res.status(400).json({ success: false, error: 'name, agentType and voiceName are required' });
            }

            const agent = await prisma.voiceAgent.create({
                data: {
                    name,
                    agentType,
                    voiceName,
                    provider,
                    providerAgentId,
                    phoneNumber,
                    status: status || 'draft',
                    prompt,
                    promptsJson,
                    llmConfigJson,
                    mode: mode || 'single',
                    welcomeMessage,
                    llmModel,
                    language,
                    // store raw template for reference
                    template,
                    configJson: config,
                    tenantId
                }
            });

            res.status(201).json({ success: true, agent });
        } catch (error) {
            console.error('[VoiceAgents] create error', error);
            res.status(500).json({ success: false, error: 'Failed to create voice agent' });
        }
    }
);

/**
 * GET /api/voice-agents/:id
 */
router.get(
    '/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const agent = await prisma.voiceAgent.findFirst({ where: { id, tenantId } });
            if (!agent) {
                return res.status(404).json({ success: false, error: 'Agent not found' });
            }
            res.json({ success: true, agent });
        } catch (error) {
            console.error('[VoiceAgents] get error', error);
            res.status(500).json({ success: false, error: 'Failed to fetch agent' });
        }
    }
);

/**
 * PATCH /api/voice-agents/:id
 */
router.patch(
    '/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'update'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const data = req.body;
            // only allow certain fields
            const allowed = [
                'name',
                'agentType',
                'voiceName',
                'provider',
                'providerAgentId',
                'phoneNumber',
                'status',
                'prompt',
                'promptsJson',
                'llmConfigJson',
                // single prompt extras
                'mode',
                'welcomeMessage',
                'llmModel',
                'language',
                'template',
                'configJson'
            ];
            const updateData = {};
            allowed.forEach(k => {
                if (data[k] !== undefined) updateData[k] = data[k];
            });
            const agent = await prisma.voiceAgent.updateMany({
                where: { id, tenantId },
                data: updateData
            });
            if (agent.count === 0) {
                return res.status(404).json({ success: false, error: 'Agent not found or not updated' });
            }
            const updated = await prisma.voiceAgent.findUnique({ where: { id } });
            res.json({ success: true, agent: updated });
        } catch (error) {
            console.error('[VoiceAgents] patch error', error);
            res.status(500).json({ success: false, error: 'Failed to update agent' });
        }
    }
);

/**
 * DELETE /api/voice-agents/:id
 */
router.delete(
    '/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'delete'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const deleted = await prisma.voiceAgent.deleteMany({ where: { id, tenantId } });
            if (deleted.count === 0) {
                return res.status(404).json({ success: false, error: 'Agent not found' });
            }
            res.json({ success: true, message: 'Agent deleted' });
        } catch (error) {
            console.error('[VoiceAgents] delete error', error);
            res.status(500).json({ success: false, error: 'Failed to delete agent' });
        }
    }
);

/**
 * POST /api/voice-agents/:id/test - simple health/test endpoint
 */
router.post(
    '/:id/test',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'read'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const agent = await prisma.voiceAgent.findFirst({ where: { id, tenantId } });
            if (!agent) {
                return res.status(404).json({ success: false, error: 'Agent not found' });
            }
            // placeholder response
            res.json({ ok: true });
        } catch (error) {
            console.error('[VoiceAgents] test error', error);
            res.status(500).json({ success: false, error: 'Failed to test agent' });
        }
    }
);

/**
 * POST /api/voice-agents/:id/assign-phone
 */
router.post(
    '/:id/assign-phone',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'update'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const { phoneNumber } = req.body;
            if (!phoneNumber) {
                return res.status(400).json({ success: false, error: 'phoneNumber required' });
            }
            const agent = await prisma.voiceAgent.updateMany({
                where: { id, tenantId },
                data: { phoneNumber }
            });
            if (agent.count === 0) {
                return res.status(404).json({ success: false, error: 'Agent not found' });
            }
            const updated = await prisma.voiceAgent.findUnique({ where: { id } });
            res.json({ success: true, agent: updated });
        } catch (error) {
            console.error('[VoiceAgents] assign phone error', error);
            res.status(500).json({ success: false, error: 'Failed to assign phone' });
        }
    }
);

module.exports = router;
