const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const ctrl = require('./room.controller');

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Room
 *   description: >
 *     Match rooms — creation, player management, toss flow, and match start.
 *
 *     **State machine:**
 *     `waiting` → (lock) → `toss_pending` → (toss + assign) → `active` → `completed` / `abandoned`
 *
 *     Room creators manage all lifecycle actions (add/remove players, toss, start match).
 */

/**
 * @swagger
 * /api/rooms:
 *   post:
 *     summary: Create a room
 *     description: >
 *       Creates a new match room. The creator is automatically added as the first player.
 *       A user can only be in **one active room** at a time.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoomRequest'
 *           example:
 *             sportTypeId: 664a1f3e2b5c1a0012345678
 *             name: Friday Night T20
 *     responses:
 *       201:
 *         description: Room created with creator as first player
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       409:
 *         description: User is already in an active room
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/', ctrl.createHandler);

/**
 * @swagger
 * /api/rooms:
 *   get:
 *     summary: List rooms
 *     description: Returns paginated rooms. Filterable by status and sportTypeId.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, toss_pending, active, completed, abandoned]
 *         description: Filter by room status
 *       - in: query
 *         name: sportTypeId
 *         schema: { type: string }
 *         description: Filter by sport type
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated room list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RoomListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', ctrl.getAllHandler);

/**
 * @swagger
 * /api/rooms/{roomId}:
 *   get:
 *     summary: Get room details
 *     description: Returns full room state including players, toss result, and match ID.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:roomId', ctrl.getByIdHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/players/friend:
 *   post:
 *     summary: Add a registered friend as player
 *     description: >
 *       Creator only. Adds an accepted friend to the room.
 *
 *       **Validations:**
 *       - Must be an accepted friend of the creator
 *       - Friend must not already be in this room
 *       - Friend must not be in another active room
 *       - Room must not exceed maxPlayers
 *       - Room must be in `waiting` status
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [friendUserId]
 *             properties:
 *               friendUserId:
 *                 type: string
 *                 example: 664a1f3e2b5c1a0012345678
 *               playerName:
 *                 type: string
 *                 description: Override display name (defaults to friend's name)
 *                 example: Ravi
 *     responses:
 *       200:
 *         description: Player added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       403:
 *         description: Not a friend or not the creator
 *       409:
 *         description: Already in this room or another active room
 */
router.post('/:roomId/players/friend', ctrl.addFriendPlayerHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/players/static:
 *   post:
 *     summary: Add a static (non-registered) player
 *     description: >
 *       Creator only. Adds a walk-in player who doesn't have an account.
 *       Static players are identified by name only and have no linked userId.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Rahul (local player)
 *     responses:
 *       200:
 *         description: Static player added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 */
router.post('/:roomId/players/static', ctrl.addStaticPlayerHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/players/{slotId}:
 *   delete:
 *     summary: Remove a player from the room
 *     description: Creator only. Removes a player slot. Cannot remove the creator.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string }
 *         description: Player slot _id
 *     responses:
 *       200:
 *         description: Player removed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         description: Slot not found
 */
router.delete('/:roomId/players/:slotId', ctrl.removePlayerHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/lock:
 *   post:
 *     summary: Lock the room and start toss phase
 *     description: >
 *       Creator only. Closes player registration and transitions status to `toss_pending`.
 *       Requires at least `minPlayers` players in the room.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room locked — status is now toss_pending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       400:
 *         description: Not enough players or wrong status
 */
router.post('/:roomId/lock', ctrl.lockRoomHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/toss:
 *   post:
 *     summary: Perform the coin toss
 *     description: >
 *       Creator only. Records toss result and winner's choice.
 *
 *       **Flow:**
 *       1. Creator specifies which player slot called heads/tails (`callerSlotId` + `call`)
 *       2. Server flips the coin randomly (`coinResult`)
 *       3. Creator specifies which slot wins (`winnerSlotId`) — validated against coin result
 *       4. Winner picks their `choice` from the sport's `tossOptions`
 *          - Cricket: `bat` | `bowl`
 *          - Tennis/Badminton: `serve` | `receive` | `court_A` | `court_B`
 *          - Pickleball: `serve` | `receive` | `side_A` | `side_B`
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TossRequest'
 *           examples:
 *             cricket:
 *               summary: Cricket toss — winner bats
 *               value:
 *                 callerSlotId: 664a3c4d2e1f3a0045678901
 *                 call: heads
 *                 winnerSlotId: 664a3c4d2e1f3a0045678901
 *                 choice: bat
 *             tennis:
 *               summary: Tennis toss — winner serves
 *               value:
 *                 callerSlotId: 664a3c4d2e1f3a0045678901
 *                 call: tails
 *                 winnerSlotId: 664a5e6f4g3h5c0067890123
 *                 choice: serve
 *     responses:
 *       200:
 *         description: Toss recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       400:
 *         description: Invalid choice or wrong room status
 */
router.post('/:roomId/toss', ctrl.tossHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/start:
 *   post:
 *     summary: Assign teams and start the match
 *     description: >
 *       Creator only. Assigns each player slot to Team A or Team B with an optional role,
 *       then transitions the room to `active` status.
 *       Must be called AFTER toss is completed.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartMatchRequest'
 *           example:
 *             assignments:
 *               - slotId: 664a3c4d2e1f3a0045678901
 *                 team: A
 *                 role: batsman
 *               - slotId: 664a5e6f4g3h5c0067890123
 *                 team: B
 *                 role: bowler
 *     responses:
 *       200:
 *         description: Match started — room status is now active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       400:
 *         description: Toss not completed or wrong status
 */
router.post('/:roomId/start', ctrl.startHandler);

/**
 * @swagger
 * /api/rooms/{roomId}/abandon:
 *   post:
 *     summary: Abandon the room/match
 *     description: Creator only. Marks the room as abandoned. Valid from any non-terminal status.
 *     tags: [Room]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room abandoned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 */
router.post('/:roomId/abandon', ctrl.abandonHandler);

module.exports = router;
