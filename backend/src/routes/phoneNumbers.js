const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { checkPermission, verifyTenantAccess } = require('../middleware/permissions');
const { checkSubscriptionAccess } = require('../middleware/subscription');

// list phone numbers for the current tenant
router.get(
    '/',
    authenticateToken,
    verifyTenantAccess,
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const numbers = await prisma.phoneNumber.findMany({
                where: { tenantId },
                orderBy: { updatedAt: 'desc' }
            });
            res.json({ success: true, numbers });
        } catch (error) {
            console.error('[PhoneNumbers] GET / error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch phone numbers' });
        }
    }
);

// fetch a single number by id
router.get(
    '/:id',
    authenticateToken,
    verifyTenantAccess,
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;
            const number = await prisma.phoneNumber.findFirst({ where: { id, tenantId } });
            if (!number) {
                return res.status(404).json({ success: false, error: 'Phone number not found' });
            }
            // return the record directly so frontend can assign it to formData
            res.json(number);
        } catch (error) {
            console.error('[PhoneNumbers] GET /:id error:', error);
            res.status(500).json({ success: false, error: 'Failed to fetch phone number' });
        }
    }
);

// create a new phone number
router.post(
    '/',
    authenticateToken,
    verifyTenantAccess,
    checkSubscriptionAccess,
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const {
                phoneNumber,
                provider,
                nickname,
                inboundAgents,
                outboundAgents,
                inboundWebhookUrl,
                allowedInboundCountryList,
                allowedOutboundCountryList
            } = req.body;

            if (!phoneNumber) {
                return res.status(400).json({ success: false, error: 'phoneNumber required' });
            }

            const newNumber = await prisma.phoneNumber.create({
                data: {
                    tenantId,
                    phoneNumber,
                    provider,
                    nickname,
                    inboundAgents: inboundAgents || [],
                    outboundAgents: outboundAgents || [],
                    inboundWebhookUrl,
                    allowedInboundCountryList: allowedInboundCountryList || [],
                    allowedOutboundCountryList: allowedOutboundCountryList || []
                }
            });

            res.status(201).json(newNumber);
        } catch (error) {
            console.error('[PhoneNumbers] POST / error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to create phone number',
                details: error.message
            });
        }
    }
);

// update an existing phone number
router.patch(
    '/:id',
    authenticateToken,
    verifyTenantAccess,
    checkPermission('voice_agents', 'configure'),
    async (req, res) => {
        try {
            const tenantId = req.scopedTenantId;
            const { id } = req.params;

            const updateData = { ...req.body };
            const updated = await prisma.phoneNumber.updateMany({
                where: { id, tenantId },
                data: updateData
            });
            if (updated.count === 0) {
                return res.status(404).json({ success: false, error: 'Phone number not found' });
            }
            const record = await prisma.phoneNumber.findUnique({ where: { id } });
            res.json(record);
        } catch (error) {
            console.error('[PhoneNumbers] PATCH /:id error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update phone number',
                details: error.message
            });
        }
    }
);

module.exports = router;
