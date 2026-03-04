const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const {
  cricketBattingHandler,
  cricketBowlingHandler,
  winsHandler,
  mostMatchesHandler,
} = require('./leaderboard.controller');

// All leaderboard routes require authentication
router.use(protect);

/**
 * @swagger
 * /api/leaderboards/cricket/batting:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Top run scorers in cricket
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [weekly, monthly, alltime], default: alltime }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/cricket/batting', cricketBattingHandler);

/**
 * @swagger
 * /api/leaderboards/cricket/bowling:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Top wicket takers in cricket
 *     parameters:
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [weekly, monthly, alltime], default: alltime }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/cricket/bowling', cricketBowlingHandler);

/**
 * @swagger
 * /api/leaderboards/wins:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Most wins (all sports or filtered)
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema: { type: string, enum: [cricket, tennis, badminton, pickleball] }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [weekly, monthly, alltime], default: alltime }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/wins', winsHandler);

/**
 * @swagger
 * /api/leaderboards/most-matches:
 *   get:
 *     tags: [Leaderboards]
 *     summary: Most matches played (all sports or filtered)
 *     parameters:
 *       - in: query
 *         name: sport
 *         schema: { type: string, enum: [cricket, tennis, badminton, pickleball] }
 *       - in: query
 *         name: period
 *         schema: { type: string, enum: [weekly, monthly, alltime], default: alltime }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 */
router.get('/most-matches', mostMatchesHandler);

module.exports = router;
