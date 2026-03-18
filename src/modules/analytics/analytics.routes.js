const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const {
  getTrendsHandler,
  getPlatformSummaryHandler,
  getEngagementHandler,
  getGrowthHandler,
  getRevenueHandler,
  getMatchAnalyticsHandler,
} = require('./analytics.controller');

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

/**
 * @swagger
 * /api/analytics/platform-summary:
 *   get:
 *     summary: Get platform summary counts
 *     description: Returns total users, matches, rooms, and active sport types.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Platform summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalUsers: { type: integer, example: 1200 }
 *                 totalMatches: { type: integer, example: 350 }
 *                 totalRooms: { type: integer, example: 400 }
 *                 totalSportTypes: { type: integer, example: 4 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/platform-summary', getPlatformSummaryHandler);

/**
 * @swagger
 * /api/analytics/engagement:
 *   get:
 *     summary: Get user engagement metrics
 *     description: >
 *       Returns active users (who participated in matches), matches per user,
 *       and average session duration for the last N days.
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
 *         description: Engagement data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 activeUsers: { type: integer, example: 85 }
 *                 matchesPerUser: { type: number, example: 2.3 }
 *                 avgSessionDuration: { type: number, example: 1800, description: "Average in seconds" }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/engagement', getEngagementHandler);

/**
 * @swagger
 * /api/analytics/growth:
 *   get:
 *     summary: Get growth comparison
 *     description: >
 *       Compares current period vs previous period for user signups and match
 *       creation, returning counts and percentage growth rate.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema: { type: integer, default: 30, maximum: 365 }
 *         description: Number of days per period
 *     responses:
 *       200:
 *         description: Growth data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userGrowth:
 *                   type: object
 *                   properties:
 *                     current: { type: integer, example: 50 }
 *                     previous: { type: integer, example: 40 }
 *                     rate: { type: number, example: 25.0 }
 *                 matchGrowth:
 *                   type: object
 *                   properties:
 *                     current: { type: integer, example: 30 }
 *                     previous: { type: integer, example: 20 }
 *                     rate: { type: number, example: 50.0 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/growth', getGrowthHandler);

/**
 * @swagger
 * /api/analytics/revenue:
 *   get:
 *     summary: Get revenue data (placeholder)
 *     description: Revenue tracking placeholder — returns stub data until payment system is implemented.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRevenue: { type: number, example: 0 }
 *                 subscriptions: { type: integer, example: 0 }
 *                 message: { type: string, example: "Revenue tracking coming soon" }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/revenue', getRevenueHandler);

/**
 * @swagger
 * /api/analytics/match-analytics:
 *   get:
 *     summary: Get detailed match analytics
 *     description: >
 *       Returns match completion/abandon rates, average duration by sport,
 *       and peak usage hours for the last N days.
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
 *         description: Match analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 statusBreakdown:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       status: { type: string }
 *                       count: { type: integer }
 *                 total: { type: integer }
 *                 completionRate: { type: number, example: 72.5 }
 *                 abandonRate: { type: number, example: 15.3 }
 *                 avgDurationBySport:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sport: { type: string }
 *                       avgDurationMinutes: { type: number }
 *                       count: { type: integer }
 *                 peakHours:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       hour: { type: integer, example: 18 }
 *                       count: { type: integer }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/match-analytics', getMatchAnalyticsHandler);

module.exports = router;
