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
            console.log('[VoiceAgents] GET / list called');
            console.log('[VoiceAgents] tenantId:', tenantId);
            console.log('[VoiceAgents] user:', req.user);
            
            if (!tenantId) {
                console.error('[VoiceAgents] No tenantId found');
                return res.status(400).json({ success: false, error: 'No tenant context' });
            }
            
            const agents = await prisma.voiceAgent.findMany({
                where: { tenantId },
                orderBy: { updatedAt: 'desc' }
            });
            
            console.log('[VoiceAgents] Query successful, found', agents.length, 'agents');
            console.log('[VoiceAgents] agents:', JSON.stringify(agents, null, 2));
            
            res.json({ success: true, agents });
        } catch (error) {
            console.error('[VoiceAgents] GET / error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch voice agents', details: error.message });
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
                mode,
                agentConfig,
                status
            } = req.body;

            // agentConfig must be provided and should be an objects
            if (!name || !agentConfig || typeof agentConfig !== 'object') {
                return res.status(400).json({ success: false, error: 'name and agentConfig are required' });
            }

            const agent = await prisma.voiceAgent.create({
                data: {
                    name,
                    agentType: agentType || 'Single Prompt',
                    mode: mode || 'single',
                    agentConfig,
                    status: status || 'active',
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
            const { agentConfig, name, mode, agentType, status } = req.body;
            const updateData = {};
            if (agentConfig !== undefined) updateData.agentConfig = agentConfig;
            if (name !== undefined) updateData.name = name;
            if (mode !== undefined) updateData.mode = mode;
            if (agentType !== undefined) updateData.agentType = agentType;
            if (status !== undefined) updateData.status = status;

            if (Object.keys(updateData).length === 0) {
                return res.status(400).json({ success: false, error: 'No valid fields to update' });
            }

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
