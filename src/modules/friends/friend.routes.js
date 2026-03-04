const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const {
  sendRequestHandler,
  acceptRequestHandler,
  rejectRequestHandler,
  cancelRequestHandler,
  unfriendHandler,
  blockUserHandler,
  unblockUserHandler,
  getFriendsHandler,
  getIncomingRequestsHandler,
  getOutgoingRequestsHandler,
  getFriendshipStatusHandler,
  getFriendStatsHandler,
} = require('./friend.controller');

router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// Swagger component schemas (picked up by swagger-jsdoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Friends
 *   description: Friend request lifecycle — send, accept, reject, cancel, unfriend, block, unblock
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     FriendRequest:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: 664a3c4d2e1f3a0045678901
 *         requester:
 *           $ref: '#/components/schemas/User'
 *         recipient:
 *           $ref: '#/components/schemas/User'
 *         status:
 *           type: string
 *           enum: [pending, accepted, rejected, blocked]
 *           example: pending
 *         blockedBy:
 *           type: string
 *           nullable: true
 *           example: null
 *           description: userId of the person who issued the block
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     FriendListItem:
 *       type: object
 *       description: A populated friend entry returned from GET /api/friends
 *       properties:
 *         friendshipId:
 *           type: string
 *           example: 664a3c4d2e1f3a0045678901
 *         friend:
 *           $ref: '#/components/schemas/User'
 *         since:
 *           type: string
 *           format: date-time
 *           description: When the friendship was accepted
 *
 *     FriendshipStatusResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [self, none, pending, accepted, rejected, blocked]
 *           example: pending
 *         requestId:
 *           type: string
 *           nullable: true
 *           example: 664a3c4d2e1f3a0045678901
 *         direction:
 *           type: string
 *           enum: [incoming, outgoing]
 *           nullable: true
 *           example: outgoing
 *           description: Whether you sent or received the request
 *         initiatedBy:
 *           type: string
 *           nullable: true
 *           example: 664a1f3e2b5c1a0012345678
 *         blockedBy:
 *           type: string
 *           nullable: true
 *           example: null
 *         since:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         user:
 *           $ref: '#/components/schemas/User'
 *
 *     FriendStatsResponse:
 *       type: object
 *       properties:
 *         friends:
 *           type: number
 *           example: 14
 *           description: Total accepted friends
 *         incoming:
 *           type: number
 *           example: 3
 *           description: Pending requests waiting for your response
 *         outgoing:
 *           type: number
 *           example: 2
 *           description: Pending requests you sent
 *         blocked:
 *           type: number
 *           example: 1
 *           description: Users you have blocked
 */

// ─────────────────────────────────────────────────────────────────────────────
// READ endpoints (defined before param routes to avoid conflicts)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/friends:
 *   get:
 *     summary: List all accepted friends
 *     description: Returns all accepted friendships for the logged-in user with populated friend profiles.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of friends
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FriendListItem'
 *             example:
 *               - friendshipId: 664a3c4d2e1f3a0045678901
 *                 friend:
 *                   _id: 664a1f3e2b5c1a0012345678
 *                   name: Jane Doe
 *                   email: jane@example.com
 *                   avatar: https://cdn.example.com/jane.jpg
 *                 since: "2025-05-21T08:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getFriendsHandler);

/**
 * @swagger
 * /api/friends/stats:
 *   get:
 *     summary: Get friend activity counts
 *     description: Returns counts of accepted friends, incoming requests, outgoing requests, and blocked users.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Friend statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FriendStatsResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/stats', getFriendStatsHandler);

/**
 * @swagger
 * /api/friends/requests/incoming:
 *   get:
 *     summary: List incoming pending friend requests
 *     description: Returns all pending requests sent TO the logged-in user that are awaiting their response.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of incoming requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FriendRequest'
 *             example:
 *               - _id: 664a3c4d2e1f3a0045678901
 *                 requester:
 *                   _id: 664a1f3e2b5c1a0012345678
 *                   name: John Doe
 *                   email: john@example.com
 *                 recipient: 664a2b3c1d0e2f0034567890
 *                 status: pending
 *                 createdAt: "2025-05-21T07:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/requests/incoming', getIncomingRequestsHandler);

/**
 * @swagger
 * /api/friends/requests/outgoing:
 *   get:
 *     summary: List outgoing pending friend requests
 *     description: Returns all pending requests sent BY the logged-in user that are awaiting others' response.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of outgoing requests
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/FriendRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/requests/outgoing', getOutgoingRequestsHandler);

/**
 * @swagger
 * /api/friends/status/{userId}:
 *   get:
 *     summary: Check friendship status with any user
 *     description: >
 *       Returns the current relationship status between the logged-in user and the specified user.
 *       Possible statuses: `none`, `pending`, `accepted`, `rejected`, `blocked`, `self`.
 *       Also returns `direction` (incoming/outgoing) when a request exists.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The target user's MongoDB ObjectId
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: Friendship status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FriendshipStatusResponse'
 *             examples:
 *               none:
 *                 summary: No relationship
 *                 value:
 *                   status: none
 *                   requestId: null
 *                   user: { _id: 664a1f3e2b5c1a0012345678, name: Jane Doe, email: jane@example.com }
 *               pendingOutgoing:
 *                 summary: You sent a request
 *                 value:
 *                   status: pending
 *                   requestId: 664a3c4d2e1f3a0045678901
 *                   direction: outgoing
 *                   initiatedBy: 664a2b3c1d0e2f0034567890
 *                   blockedBy: null
 *                   since: "2025-05-21T07:00:00.000Z"
 *                   user: { _id: 664a1f3e2b5c1a0012345678, name: Jane Doe }
 *               accepted:
 *                 summary: Friends
 *                 value:
 *                   status: accepted
 *                   requestId: 664a3c4d2e1f3a0045678901
 *                   direction: outgoing
 *                   since: "2025-05-20T12:00:00.000Z"
 *                   user: { _id: 664a1f3e2b5c1a0012345678, name: Jane Doe }
 *               blocked:
 *                 summary: You blocked this user
 *                 value:
 *                   status: blocked
 *                   blockedBy: 664a2b3c1d0e2f0034567890
 *                   user: { _id: 664a1f3e2b5c1a0012345678, name: Jane Doe }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/status/:userId', getFriendshipStatusHandler);

// ─────────────────────────────────────────────────────────────────────────────
// WRITE endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/friends/request/{userId}:
 *   post:
 *     summary: Send a friend request
 *     description: >
 *       Sends a friend request to the specified user.
 *
 *       **All edge cases handled:**
 *       - **Self-request** → 400
 *       - **User not found** → 404
 *       - **Blocked** (by either party) → 403
 *       - **Already friends** → 409
 *       - **Request already pending (you sent)** → 409
 *       - **Mutual request** (they sent you one first) → auto-accepted → 201 with `autoAccepted: true`
 *       - **Previously rejected** (they rejected your old request) → re-sends → 201
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The target user's MongoDB ObjectId
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       201:
 *         description: Friend request sent (or auto-accepted if mutual)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FriendRequest'
 *             examples:
 *               sent:
 *                 summary: Request sent normally
 *                 value:
 *                   _id: 664a3c4d2e1f3a0045678901
 *                   requester: 664a2b3c1d0e2f0034567890
 *                   recipient: 664a1f3e2b5c1a0012345678
 *                   status: pending
 *               autoAccepted:
 *                 summary: Mutual request — auto-accepted
 *                 value:
 *                   autoAccepted: true
 *                   message: Friend request accepted — you both requested each other
 *                   friendship: { _id: 664a3c4d2e1f3a0045678901, status: accepted }
 *       400:
 *         description: Cannot send request to yourself
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Cannot send a friend request to yourself
 *       403:
 *         description: Blocked — cannot send request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Cannot send a friend request to this user
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Already friends or request already pending
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               alreadyFriends:
 *                 value: { message: You are already friends with this user }
 *               alreadyPending:
 *                 value: { message: Friend request already sent and is pending }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/request/:userId', sendRequestHandler);

/**
 * @swagger
 * /api/friends/request/{requestId}/accept:
 *   put:
 *     summary: Accept an incoming friend request
 *     description: >
 *       Only the **recipient** of the pending request may accept it.
 *       Use `GET /api/friends/requests/incoming` to retrieve request IDs.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The friendship document's MongoDB ObjectId
 *         example: 664a3c4d2e1f3a0045678901
 *     responses:
 *       200:
 *         description: Request accepted — friendship is now active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FriendRequest'
 *             example:
 *               _id: 664a3c4d2e1f3a0045678901
 *               requester: 664a1f3e2b5c1a0012345678
 *               recipient: 664a2b3c1d0e2f0034567890
 *               status: accepted
 *       404:
 *         description: Request not found or you are not the recipient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Friend request not found or you are not the recipient
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/request/:requestId/accept', acceptRequestHandler);

/**
 * @swagger
 * /api/friends/request/{requestId}/reject:
 *   put:
 *     summary: Reject an incoming friend request
 *     description: >
 *       Only the **recipient** of the pending request may reject it.
 *       The document is kept with `status: rejected` so the requester may re-request in the future.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The friendship document's MongoDB ObjectId
 *         example: 664a3c4d2e1f3a0045678901
 *     responses:
 *       200:
 *         description: Request rejected
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FriendRequest'
 *             example:
 *               _id: 664a3c4d2e1f3a0045678901
 *               status: rejected
 *       404:
 *         description: Request not found or you are not the recipient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Friend request not found or you are not the recipient
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/request/:requestId/reject', rejectRequestHandler);

/**
 * @swagger
 * /api/friends/request/{requestId}:
 *   delete:
 *     summary: Cancel an outgoing friend request
 *     description: >
 *       Only the **sender** of a pending request may cancel it.
 *       The document is permanently deleted, allowing a fresh request later.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema:
 *           type: string
 *         description: The friendship document's MongoDB ObjectId
 *         example: 664a3c4d2e1f3a0045678901
 *     responses:
 *       200:
 *         description: Request cancelled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Friend request cancelled successfully
 *       404:
 *         description: Request not found or you are not the sender
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Pending request not found or you are not the sender
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.delete('/request/:requestId', cancelRequestHandler);

/**
 * @swagger
 * /api/friends/unfriend/{userId}:
 *   delete:
 *     summary: Unfriend a user
 *     description: Removes an accepted friendship. Either party may initiate. The document is deleted permanently.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The friend's MongoDB ObjectId
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: Unfriended successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Unfriended successfully
 *       404:
 *         description: Friendship not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Friendship not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.delete('/unfriend/:userId', unfriendHandler);

/**
 * @swagger
 * /api/friends/block/{userId}:
 *   post:
 *     summary: Block a user
 *     description: >
 *       Blocks the specified user. Any existing relationship (pending/accepted/rejected)
 *       is overwritten with `status: blocked`. The blocked user cannot send requests.
 *       Only the blocker can unblock.
 *
 *       **Edge cases:**
 *       - **Self-block** → 400
 *       - **User not found** → 404
 *       - **Already blocked by you** → 409
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user to block
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User blocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FriendRequest'
 *             example:
 *               _id: 664a3c4d2e1f3a0045678901
 *               requester: 664a2b3c1d0e2f0034567890
 *               recipient: 664a1f3e2b5c1a0012345678
 *               status: blocked
 *               blockedBy: 664a2b3c1d0e2f0034567890
 *       400:
 *         description: Cannot block yourself
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Cannot block yourself
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: User is already blocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: You have already blocked this user
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/block/:userId', blockUserHandler);

/**
 * @swagger
 * /api/friends/block/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     description: >
 *       Removes the block. Only the person who issued the block can unblock.
 *       The friendship document is deleted, giving both parties a clean slate to re-connect.
 *     tags: [Friends]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The user to unblock
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User unblocked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: User unblocked successfully
 *       404:
 *         description: No active block found, or you are not the blocker
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: No active block found for this user, or you are not the blocker
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.delete('/block/:userId', unblockUserHandler);

module.exports = router;
