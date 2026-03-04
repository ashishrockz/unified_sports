const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { getHighlightsHandler } = require('./highlights.controller');

router.use(protect);

/**
 * @swagger
 * /api/highlights/{matchId}:
 *   get:
 *     tags: [Highlights]
 *     summary: Get auto-generated match highlights
 *     description: Returns highlights, milestones, top performers, and innings summaries for a match.
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 */
router.get('/:matchId', getHighlightsHandler);

module.exports = router;
