const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { requireSuperAdmin } = require('../../middlewares/admin.middleware');
const { getAuditLogsHandler } = require('./auditLog.controller');

router.use(protect, requireSuperAdmin);

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get audit logs
 *     description: Returns paginated admin activity logs. SuperAdmin only.
 *     tags: [AuditLog]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Filter by action type (e.g. user.ban, admin.create)
 *       - in: query
 *         name: actorId
 *         schema: { type: string }
 *         description: Filter by actor (admin) ID
 *       - in: query
 *         name: targetModel
 *         schema:
 *           type: string
 *           enum: [User, Room, Match, SportType]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated audit logs
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/', getAuditLogsHandler);

module.exports = router;
