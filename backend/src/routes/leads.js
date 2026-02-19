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

        // search condition for inbound calls
        const inboundWhere = {
            tenantId,
            ...(search && {
                OR: [
                    { callerPhone: { contains: search, mode: 'insensitive' } },
                    { callerName: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        // search condition for client leads (people from bookings page)
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

        // search condition for team members (same as bookings page)
        const teamWhere = {
            tenantId,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { phoneNumber: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        // fetch inbound calls, clients, and team members in parallel
        const [inboundCalls, totalInbound, clients, users] = await Promise.all([
            prisma.inboundCall.findMany({
                where: inboundWhere,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.inboundCall.count({ where: inboundWhere }),
            prisma.client.findMany({
                where: clientWhere,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.findMany({
                where: teamWhere,
                orderBy: { createdAt: 'desc' }
            })
        ]);

        // convert clients into same shape as inbound calls for display
        const clientLeads = clients.map(c => ({
            id: `client-${c.id}`,
            callerName: c.name,
            callerPhone: c.phone || c.email || '',
            duration: null,
            status: 'Lead',
            createdAt: c.createdAt,
            type: 'client'
        }));

        // convert team members into lead shape as well
        const teamLeads = users.map(u => ({
            id: `user-${u.id}`,
            callerName: u.name || u.email || 'Unknown',
            callerPhone: u.phoneNumber || u.email || '',
            duration: null,
            status: 'Lead',
            createdAt: u.createdAt,
            type: 'client'
        }));

        const inboundWithType = inboundCalls.map(c => ({ ...c, type: 'inbound' }));

        // merge all lead sources and sort by createdAt descending
        const combined = [...clientLeads, ...teamLeads, ...inboundWithType].sort((a, b) => {
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const total = combined.length;
        const pageInt = parseInt(page);
        const limitInt = parseInt(limit);
        const paged = combined.slice((pageInt - 1) * limitInt, (pageInt - 1) * limitInt + limitInt);

        res.json({
            success: true,
            inboundCalls: paged,
            pagination: {
                total,
                page: pageInt,
                limit: limitInt,
                totalPages: Math.ceil(total / limitInt)
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
