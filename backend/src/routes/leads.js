const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const { authenticateToken } = require('../middleware/auth');
const { verifyTenantAccess } = require('../middleware/permissions');

/**
 * GET /api/leads - Fetch all AI-captured leads
 */
router.get('/', authenticateToken, verifyTenantAccess, async (req, res) => {
    try {
        const tenantId = req.scopedTenantId;
        const { page = 1, limit = 10, search = '' } = req.query;
        const skip = (page - 1) * limit;

        const where = {
            tenantId,
            source: 'AI_AGENT',
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phone: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        const [leads, total] = await Promise.all([
            prisma.client.findMany({
                where,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.client.count({ where })
        ]);

        res.json({
            success: true,
            leads,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[LeadsRoute] Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch leads' });
    }
});

/**
 * GET /api/leads/inbound - Fetch all inbound call leads
 */
router.get('/inbound', authenticateToken, verifyTenantAccess, async (req, res) => {
    try {
        const tenantId = req.scopedTenantId;
        const { page = 1, limit = 20, search = '' } = req.query;
        const skip = (page - 1) * limit;

        // first try to get team members (same as bookings page)
        const userWhere = {
            tenantId,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phoneNumber: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        const [users, totalUsers] = await Promise.all([
            prisma.user.findMany({
                where: userWhere,
                skip: parseInt(skip),
                take: parseInt(limit),
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where: userWhere })
        ]);

        let leads = [];
        let total = 0;

        if (users.length > 0) {
            leads = users.map(u => ({
                id: `user-${u.id}`,
                callerName: u.name || u.email || 'Unknown',
                callerPhone: u.phoneNumber || u.email || '',
                duration: null,
                status: 'Lead',
                createdAt: u.createdAt,
                type: 'client'
            }));
            total = totalUsers;
        } else {
            // no team members, fall back to clients (similar to bookings page)
            const clientWhere = {
                tenantId,
                ...(search && {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { phone: { contains: search, mode: 'insensitive' } }
                    ]
                })
            };

            const [clients, totalClients] = await Promise.all([
                prisma.client.findMany({
                    where: clientWhere,
                    skip: parseInt(skip),
                    take: parseInt(limit),
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.client.count({ where: clientWhere })
            ]);

            leads = clients.map(c => ({
                id: `client-${c.id}`,
                callerName: c.name,
                callerPhone: c.phone || c.email || '',
                duration: null,
                status: 'Lead',
                createdAt: c.createdAt,
                type: 'client'
            }));
            total = totalClients;
        }

        res.json({
            success: true,
            inboundCalls: leads,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[LeadsRoute] Inbound Error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch inbound leads' });
    }
});

/**
 * DELETE /api/leads/inbound/:id - Delete an inbound call lead
 */
router.delete('/inbound/:id', authenticateToken, verifyTenantAccess, async (req, res) => {
    try {
        const tenantId = req.scopedTenantId;
        const { id } = req.params;

        const inboundCall = await prisma.inboundCall.findUnique({ where: { id } });

        if (!inboundCall) {
            return res.status(404).json({ success: false, error: 'Inbound call not found' });
        }

        if (inboundCall.tenantId !== tenantId) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        await prisma.inboundCall.delete({ where: { id } });

        res.json({ success: true, message: 'Inbound call deleted' });
    } catch (error) {
        console.error('[LeadsRoute] Delete Error:', error);
        res.status(500).json({ success: false, error: 'Failed to delete inbound call' });
    }
});

module.exports = router;
