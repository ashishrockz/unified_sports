const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const ctrl = require('./match.controller');

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Match
 *   description: >
 *     Match lifecycle — scoring, innings/set transitions, and completion.
 *     All endpoints are **application-scoped** via the user's JWT.
 *     Only the **room creator** can modify match state (others have read-only access).
 */

/**
 * @swagger
 * /api/matches/room/{roomId}:
 *   get:
 *     summary: Get match by room ID
 *     description: Returns the active or completed match associated with the room.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/room/:roomId', ctrl.getByRoomHandler);

/**
 * @swagger
 * /api/matches/{matchId}:
 *   get:
 *     summary: Get match by match ID
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match document
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.get('/:matchId', ctrl.getByIdHandler);

/**
 * @swagger
 * /api/matches/{matchId}/commentary:
 *   get:
 *     summary: Get live commentary feed
 *     description: Returns the last 50 auto-generated commentary entries for a match.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Commentary feed
 */
router.get('/:matchId/commentary', ctrl.getCommentaryHandler);

/**
 * @swagger
 * /api/matches/{matchId}/start:
 *   post:
 *     summary: Start the match
 *     description: Creator only. Transitions match status from `not_started` to `active`.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/start', ctrl.startHandler);

/**
 * @swagger
 * /api/matches/{matchId}/complete:
 *   post:
 *     summary: Mark match as completed
 *     description: >
 *       Creator only. Declares the winner manually.
 *       For cricket, completion can also be triggered automatically when all wickets fall or overs are exhausted.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [winner]
 *             properties:
 *               winner:
 *                 type: string
 *                 enum: [A, B, draw, no_result]
 *                 example: A
 *               margin:
 *                 type: string
 *                 example: "5 wickets"
 *               description:
 *                 type: string
 *                 example: Team A wins by 5 wickets
 *     responses:
 *       200:
 *         description: Match completed with result
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/complete', ctrl.completeHandler);

/**
 * @swagger
 * /api/matches/{matchId}/abandon:
 *   post:
 *     summary: Abandon the match
 *     description: Creator only. Marks match as abandoned with no result.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match abandoned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/abandon', ctrl.abandonHandler);

// ── Cricket ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/matches/{matchId}/cricket/lineup:
 *   post:
 *     summary: Set batting lineup and bowler for cricket innings
 *     description: >
 *       Creator only. Sets the opening batsmen (striker + non-striker) and the
 *       opening bowler for the current innings. Uses player slot `_id` values.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               inningsNum:
 *                 type: number
 *                 description: Innings number (defaults to current)
 *                 example: 1
 *               strikerId:
 *                 type: string
 *                 description: Player slot _id of the striker
 *               nonStrikerId:
 *                 type: string
 *                 description: Player slot _id of the non-striker
 *               bowlerId:
 *                 type: string
 *                 description: Player slot _id of the bowler
 *     responses:
 *       200:
 *         description: Lineup set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/cricket/lineup', ctrl.lineupHandler);

/**
 * @swagger
 * /api/matches/{matchId}/cricket/ball:
 *   post:
 *     summary: Record a delivery (ball-by-ball)
 *     description: >
 *       Creator only. Records each ball in the current over.
 *       Automatically tracks over completion (6 legal balls), innings completion
 *       (all out or overs exhausted), and match completion.
 *
 *       **Auto-transitions:**
 *       - After 6 legal balls → over marked complete, new over starts
 *       - After all wickets or max overs → innings marked complete
 *       - If last innings → match auto-completes with winner
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecordBallRequest'
 *           examples:
 *             normalRun:
 *               summary: Normal 4 runs
 *               value:
 *                 batsmanId: 664a3c4d2e1f3a0045678901
 *                 bowlerId:  664a5e6f4g3h5c0067890123
 *                 runs: 4
 *                 isLegal: true
 *             wide:
 *               summary: Wide ball
 *               value:
 *                 batsmanId: 664a3c4d2e1f3a0045678901
 *                 bowlerId:  664a5e6f4g3h5c0067890123
 *                 runs: 0
 *                 extras: { type: wide, runs: 1 }
 *                 isLegal: false
 *             wicket:
 *               summary: Caught out
 *               value:
 *                 batsmanId: 664a3c4d2e1f3a0045678901
 *                 bowlerId:  664a5e6f4g3h5c0067890123
 *                 runs: 0
 *                 wicket: { type: caught, fielderId: 664a7g8h5i6j7k0089012345 }
 *                 isLegal: true
 *     responses:
 *       200:
 *         description: Ball recorded — returns updated match state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/cricket/ball', ctrl.ballHandler);

/**
 * @swagger
 * /api/matches/{matchId}/cricket/resume-innings:
 *   post:
 *     summary: Resume after innings break
 *     description: Creator only. Resumes the match after innings_break status (2nd innings start in cricket).
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match resumed for next innings
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/cricket/resume-innings', ctrl.resumeInningsHandler);

// ── Racket sports (Tennis / Badminton / Pickleball) ───────────────────────────

/**
 * @swagger
 * /api/matches/{matchId}/racket/point:
 *   post:
 *     summary: Record a point (Tennis / Badminton / Pickleball)
 *     description: >
 *       Creator only. Adds a point to the specified team.
 *
 *       **Auto-transitions:**
 *       - Game won → next game in same set
 *       - Set won → `set_break` status
 *       - Match won → `completed` with result
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [team]
 *             properties:
 *               team:
 *                 type: string
 *                 enum: [A, B]
 *                 example: A
 *     responses:
 *       200:
 *         description: Point recorded — returns updated match state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/racket/point', ctrl.pointHandler);

/**
 * @swagger
 * /api/matches/{matchId}/racket/resume-set:
 *   post:
 *     summary: Resume after set break
 *     description: Creator only. Resumes the match after a set_break.
 *     tags: [Match]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match resumed for next set
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 */
router.post('/:matchId/racket/resume-set', ctrl.resumeSetHandler);

module.exports = router;
