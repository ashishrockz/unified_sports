const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const {
  getProfileHandler,
  updateProfileHandler,
  getAllUsersHandler,
  getUserByIdHandler,
  getPlayerStatsHandler,
} = require('./user.controller');

// ─── Swagger component additions ─────────────────────────────────────────────

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     FriendshipMeta:
 *       type: object
 *       description: How the viewing user relates to the target user
 *       properties:
 *         status:
 *           type: string
 *           enum: [self, none, pending, accepted, rejected, blocked]
 *           example: pending
 *         friendshipId:
 *           type: string
 *           nullable: true
 *           example: 664a3c4d2e1f3a0045678901
 *         direction:
 *           type: string
 *           enum: [incoming, outgoing]
 *           nullable: true
 *           example: outgoing
 *           description: Present only when status is pending
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
 *
 *     UserListItem:
 *       type: object
 *       description: A user entry in the list view, enriched with friend context
 *       properties:
 *         _id:
 *           type: string
 *           example: 664a1f3e2b5c1a0012345678
 *         name:
 *           type: string
 *           example: Jane Doe
 *         username:
 *           type: string
 *           example: jane_doe
 *         email:
 *           type: string
 *           example: jane@example.com
 *         phone:
 *           type: string
 *           nullable: true
 *           example: "+919876543210"
 *         avatar:
 *           type: string
 *           nullable: true
 *           example: https://cdn.example.com/jane.jpg
 *         role:
 *           type: string
 *           example: user
 *         createdAt:
 *           type: string
 *           format: date-time
 *         friendsCount:
 *           type: number
 *           example: 12
 *           description: How many accepted friends this user has
 *         friendship:
 *           $ref: '#/components/schemas/FriendshipMeta'
 *
 *     PaginationMeta:
 *       type: object
 *       properties:
 *         page:
 *           type: number
 *           example: 1
 *         limit:
 *           type: number
 *           example: 20
 *         total:
 *           type: number
 *           example: 84
 *         totalPages:
 *           type: number
 *           example: 5
 *
 *     UserListResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/UserListItem'
 *         pagination:
 *           $ref: '#/components/schemas/PaginationMeta'
 *
 *     FriendEntry:
 *       type: object
 *       description: A friend in someone's friends list
 *       properties:
 *         friendshipId:
 *           type: string
 *           example: 664a3c4d2e1f3a0045678901
 *         user:
 *           $ref: '#/components/schemas/User'
 *         since:
 *           type: string
 *           format: date-time
 *           description: When the friendship was accepted
 *
 *     UserProfileResponse:
 *       type: object
 *       description: >
 *         Full public profile of a user.
 *         When viewing your own profile (`GET /api/user/profile` or `GET /api/user/:myId`),
 *         extra counts are included — incomingRequestsCount, outgoingRequestsCount, blockedCount.
 *       properties:
 *         _id:
 *           type: string
 *           example: 664a1f3e2b5c1a0012345678
 *         name:
 *           type: string
 *           example: John Doe
 *         username:
 *           type: string
 *           example: john_doe
 *         email:
 *           type: string
 *           example: john@example.com
 *         phone:
 *           type: string
 *           nullable: true
 *         avatar:
 *           type: string
 *           nullable: true
 *         role:
 *           type: string
 *           example: user
 *         createdAt:
 *           type: string
 *           format: date-time
 *         friendsCount:
 *           type: number
 *           example: 14
 *         friends:
 *           type: array
 *           description: First 20 accepted friends (populated)
 *           items:
 *             $ref: '#/components/schemas/FriendEntry'
 *         friendship:
 *           $ref: '#/components/schemas/FriendshipMeta'
 *         incomingRequestsCount:
 *           type: number
 *           example: 3
 *           description: Only present when viewing your own profile
 *         outgoingRequestsCount:
 *           type: number
 *           example: 2
 *           description: Only present when viewing your own profile
 *         blockedCount:
 *           type: number
 *           example: 1
 *           description: Only present when viewing your own profile
 */

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/user:
 *   get:
 *     summary: Search and list all users
 *     description: >
 *       Returns a paginated list of all regular users (admins excluded).
 *       Searchable by **name** or **username** (case-insensitive).
 *
 *       Each item includes:
 *       - Basic profile fields
 *       - `friendsCount` — how many friends that user has
 *       - `friendship` — current user's relationship status with that user
 *         (`none` | `pending` | `accepted` | `rejected` | `blocked`)
 *
 *       **Use this list to send, accept, or manage friend requests.**
 *       Take the `_id` from a user item and call `POST /api/friends/request/{userId}`.
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term matched against name and username (case-insensitive)
 *         example: john
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Results per page (max 100)
 *         example: 20
 *     responses:
 *       200:
 *         description: Paginated user list with friendship context
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserListResponse'
 *             examples:
 *               noSearch:
 *                 summary: All users (no filter)
 *                 value:
 *                   users:
 *                     - _id: 664a1f3e2b5c1a0012345678
 *                       name: Jane Doe
 *                       username: jane_doe
 *                       email: jane@example.com
 *                       phone: null
 *                       avatar: https://cdn.example.com/jane.jpg
 *                       role: user
 *                       createdAt: "2025-05-20T08:00:00.000Z"
 *                       friendsCount: 12
 *                       friendship:
 *                         status: none
 *                     - _id: 664a2b3c1d0e2f0034567890
 *                       name: Alex Smith
 *                       username: alex_smith
 *                       email: alex@example.com
 *                       friendsCount: 8
 *                       friendship:
 *                         status: pending
 *                         friendshipId: 664a3c4d2e1f3a0045678901
 *                         direction: outgoing
 *                     - _id: 664a4d5e3f2g4b0056789012
 *                       name: Maria Garcia
 *                       username: maria_g
 *                       email: maria@example.com
 *                       friendsCount: 25
 *                       friendship:
 *                         status: accepted
 *                         friendshipId: 664a5e6f4g3h5c0067890123
 *                   pagination:
 *                     page: 1
 *                     limit: 20
 *                     total: 84
 *                     totalPages: 5
 *               withSearch:
 *                 summary: Searching by username "jane"
 *                 value:
 *                   users:
 *                     - _id: 664a1f3e2b5c1a0012345678
 *                       name: Jane Doe
 *                       username: jane_doe
 *                       friendsCount: 12
 *                       friendship:
 *                         status: none
 *                   pagination:
 *                     page: 1
 *                     limit: 20
 *                     total: 1
 *                     totalPages: 1
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', protect, getAllUsersHandler);

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get my own full profile
 *     description: >
 *       Returns the logged-in user's complete profile including:
 *       - All user fields (including username)
 *       - `friendsCount` — total accepted friends
 *       - `friends[]` — first 20 accepted friends (populated)
 *       - `incomingRequestsCount` — pending requests awaiting your response
 *       - `outgoingRequestsCount` — pending requests you sent
 *       - `blockedCount` — users you have blocked
 *       - `friendship.status` will be `self`
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Your own full profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfileResponse'
 *             example:
 *               _id: 664a2b3c1d0e2f0034567890
 *               name: John Doe
 *               username: john_doe
 *               email: john@example.com
 *               phone: "+919876543210"
 *               avatar: https://cdn.example.com/john.jpg
 *               role: user
 *               friendsCount: 14
 *               friends:
 *                 - friendshipId: 664a3c4d2e1f3a0045678901
 *                   user: { _id: 664a1f3e2b5c1a0012345678, name: Jane Doe, username: jane_doe }
 *                   since: "2025-05-18T10:00:00.000Z"
 *               friendship:
 *                 status: self
 *               incomingRequestsCount: 3
 *               outgoingRequestsCount: 2
 *               blockedCount: 1
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/profile', protect, getProfileHandler);

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update my profile
 *     description: >
 *       Updatable fields: `name`, `username`, `avatar`.
 *
 *       **Username rules:**
 *       - 3–25 characters
 *       - Lowercase letters, numbers, and underscores only (`a-z`, `0-9`, `_`)
 *       - Must be globally unique
 *
 *       Phone and email are managed through the OTP auth flow and cannot be changed here.
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           examples:
 *             setUsername:
 *               summary: Set a username for the first time
 *               value:
 *                 username: john_doe
 *             updateAll:
 *               summary: Update name, username, and avatar
 *               value:
 *                 name: John Doe
 *                 username: john_doe99
 *                 avatar: https://cdn.example.com/new-avatar.jpg
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *             example:
 *               _id: 664a2b3c1d0e2f0034567890
 *               name: John Doe
 *               username: john_doe99
 *               email: john@example.com
 *               avatar: https://cdn.example.com/new-avatar.jpg
 *               role: user
 *       400:
 *         description: Username validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               tooShort:
 *                 value: { message: Username must be at least 3 characters }
 *               invalidChars:
 *                 value: { message: Username can only contain lowercase letters, numbers, and underscores }
 *       409:
 *         description: Username already taken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Username is already taken
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/profile', protect, updateProfileHandler);

/**
 * @swagger
 * /api/user/{userId}:
 *   get:
 *     summary: Get any user's public profile
 *     description: >
 *       Returns a user's full public profile with their friends list and friendship context.
 *
 *       **Response includes:**
 *       - All public user fields (name, username, email, avatar, role, createdAt)
 *       - `friendsCount` — total accepted friends
 *       - `friends[]` — first 20 accepted friends (populated profiles)
 *       - `friendship` — your relationship with this user:
 *         - `status: none` — no relationship
 *         - `status: pending` — request sent or received (+ `direction`: incoming/outgoing)
 *         - `status: accepted` — you are friends
 *         - `status: rejected` — request was rejected
 *         - `status: blocked` — one of you blocked the other (+ `blockedBy`)
 *         - `status: self` — this is your own profile
 *
 *       **Friend request flow from this endpoint:**
 *       1. Browse users: `GET /api/user?search=jane`
 *       2. View their profile: `GET /api/user/{userId}`  ← you are here
 *       3. Send request: `POST /api/friends/request/{userId}`
 *       4. They accept: `PUT /api/friends/request/{requestId}/accept`
 *     tags: [User]
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
 *         description: User profile with friends and friendship context
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfileResponse'
 *             examples:
 *               noRelationship:
 *                 summary: User you have no connection with
 *                 value:
 *                   _id: 664a1f3e2b5c1a0012345678
 *                   name: Jane Doe
 *                   username: jane_doe
 *                   email: jane@example.com
 *                   friendsCount: 12
 *                   friends:
 *                     - friendshipId: 664a3c4d2e1f3a0045678901
 *                       user: { _id: 664a5e6f4g3h5c0067890123, name: Alex Smith, username: alex_s }
 *                       since: "2025-05-18T10:00:00.000Z"
 *                   friendship:
 *                     status: none
 *               pendingOutgoing:
 *                 summary: You sent them a request
 *                 value:
 *                   _id: 664a1f3e2b5c1a0012345678
 *                   name: Jane Doe
 *                   username: jane_doe
 *                   friendsCount: 12
 *                   friends: []
 *                   friendship:
 *                     status: pending
 *                     friendshipId: 664a3c4d2e1f3a0045678901
 *                     direction: outgoing
 *                     initiatedBy: 664a2b3c1d0e2f0034567890
 *                     blockedBy: null
 *                     since: "2025-05-21T07:00:00.000Z"
 *               alreadyFriends:
 *                 summary: You are friends
 *                 value:
 *                   _id: 664a1f3e2b5c1a0012345678
 *                   name: Jane Doe
 *                   username: jane_doe
 *                   friendsCount: 13
 *                   friends:
 *                     - friendshipId: 664a3c4d2e1f3a0045678901
 *                       user: { _id: 664a2b3c1d0e2f0034567890, name: John Doe }
 *                       since: "2025-05-20T12:00:00.000Z"
 *                   friendship:
 *                     status: accepted
 *                     friendshipId: 664a3c4d2e1f3a0045678901
 *                     direction: outgoing
 *                     since: "2025-05-20T12:00:00.000Z"
 *               blocked:
 *                 summary: You blocked this user
 *                 value:
 *                   _id: 664a1f3e2b5c1a0012345678
 *                   name: Jane Doe
 *                   username: jane_doe
 *                   friendsCount: 10
 *                   friends: []
 *                   friendship:
 *                     status: blocked
 *                     friendshipId: 664a3c4d2e1f3a0045678901
 *                     direction: outgoing
 *                     blockedBy: 664a2b3c1d0e2f0034567890
 *                     since: "2025-05-19T09:00:00.000Z"
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:userId', protect, getUserByIdHandler);

/**
 * @swagger
 * /api/user/{userId}/stats:
 *   get:
 *     summary: Get a user's aggregated match stats
 *     description: >
 *       Returns aggregated cricket match performance stats for a user,
 *       computed from all completed matches. Stats are split by matchType (all, local, tournament)
 *       and include batting, bowling, and win/loss records.
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: The target user's MongoDB ObjectId
 *     responses:
 *       200:
 *         description: Player stats
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/:userId/stats', protect, getPlayerStatsHandler);

module.exports = router;
