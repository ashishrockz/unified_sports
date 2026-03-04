const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const { getTrendsHandler } = require('./analytics.controller');

router.use(protect, requireAdmin);

/**
 * @swagger
 * /api/analytics/trends:
 *   get:
 *     summary: Get platform trends
 *     description: >
 *       Returns daily user signups, match creation, room creation trends
 *       for the last N days (default 30, max 365), plus sport popularity breakdown.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30, maximum: 365 }
 *         description: Number of days to look back
 *     responses:
 *       200:
 *         description: Trend data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string, example: "2026-02-15" }
 *                       count: { type: integer, example: 12 }
 *                 matches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string }
 *                       count: { type: integer }
 *                 rooms:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       date: { type: string }
 *                       count: { type: integer }
 *                 sportPopularity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sport: { type: string, example: "cricket" }
 *                       count: { type: integer, example: 45 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/trends', getTrendsHandler);

module.exports = router;
