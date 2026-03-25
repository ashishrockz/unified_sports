const router = require('express').Router();
const { protect }        = require('../../middlewares/auth.middleware');
const { requireStaff, requirePermission } = require('../../middlewares/admin.middleware');
const { loginLimiter }   = require('../../middlewares/rateLimiter');
const upload = require('../../config/upload');
const {
  adminLoginHandler,
  getAllUsersHandler,
  getUserDetailHandler,
  banUserHandler,
  unbanUserHandler,
  activateUserHandler,
  deactivateUserHandler,
  getMyProfileHandler,
  changePasswordHandler,
  getAdminDashboardHandler,
  getAllRoomsAdminHandler,
  getRoomByIdAdminHandler,
  getAllMatchesAdminHandler,
  getMatchByIdAdminHandler,
  bulkUserActionHandler,
  exportUsersHandler,
  updateProfileHandler,
  uploadAvatarHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  abandonMatchAdminHandler,
  abandonRoomAdminHandler,
  getNotificationsAdminHandler,
  getNotificationStatsHandler,
  deleteNotificationHandler,
} = require('./admin.controller');
const {
  adminGetAllPlansHandler,
  adminUpdatePlanHandler,
  adminGetAllMatchPacksHandler,
  adminUpdateMatchPackHandler,
  adminGetSubscriptionsHandler,
  adminGetOrdersHandler,
  adminGetRevenueStatsHandler,
} = require('../subscription/subscription.controller');

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC — no token required
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Login as Admin or Super Admin
 *     description: >
 *       Authenticates with email + bcrypt password.
 *       Works for both **admin** (employee) and **superadmin** accounts.
 *       Returns a JWT valid for 7 days and the full user object (with role).
 *
 *       **Status checks after password match:**
 *       - `inactive` account → 403 with clear message
 *       - `banned` account   → 403 with clear message
 *       - Wrong credentials  → 401 (same message for both cases, for security)
 *
 *       Seed accounts:
 *       - Super admin → `npm run seed:superadmin`
 *       - Admin       → created by super admin via `POST /api/superadmin/admins`
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminLoginRequest'
 *           example:
 *             email: admin@unifiedsports.com
 *             password: Admin@123
 *     responses:
 *       200:
 *         description: Login successful — returns JWT + user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *                 user:
 *                   $ref: '#/components/schemas/AdminUser'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Wrong email or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Invalid email or password
 *       403:
 *         description: Account is deactivated or banned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               deactivated:
 *                 value:
 *                   message: Your admin account has been deactivated. Contact the super admin.
 *               banned:
 *                 value:
 *                   message: Your admin account has been banned. Contact the super admin.
 */
router.post('/login', loginLimiter, adminLoginHandler);

/**
 * @swagger
 * /api/admin/forgot-password:
 *   post:
 *     summary: Request password reset
 *     description: Sends a password reset email to the admin. Does not reveal if email exists.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@unifiedsports.com
 *     responses:
 *       200:
 *         description: Reset email sent (if email exists)
 */
router.post('/forgot-password', forgotPasswordHandler);

/**
 * @swagger
 * /api/admin/reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Resets the admin password using the token received via email.
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 6
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', resetPasswordHandler);

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED — all staff roles (super_admin, admin, manager, editor, viewer)
// ─────────────────────────────────────────────────────────────────────────────
router.use(protect, requireStaff);

// ── Profile & Dashboard ──────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/me:
 *   get:
 *     summary: Get own profile
 *     description: Returns the authenticated admin/superadmin's profile. Used by the frontend on page load to validate the stored JWT.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/me', getMyProfileHandler);

/**
 * @swagger
 * /api/admin/me:
 *   put:
 *     summary: Update own profile
 *     description: Update the authenticated admin's profile (currently supports name).
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: Updated Admin Name
 *     responses:
 *       200:
 *         description: Profile updated
 *       400:
 *         description: No valid fields
 */
router.put('/me', updateProfileHandler);

/**
 * @swagger
 * /api/admin/me/avatar:
 *   post:
 *     summary: Upload avatar
 *     description: Upload a new profile avatar. Max 5MB. Accepts JPEG, PNG, WebP, GIF.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded
 *       400:
 *         description: No file or invalid format
 */
router.post('/me/avatar', upload.single('avatar'), uploadAvatarHandler);

/**
 * @swagger
 * /api/admin/me/password:
 *   put:
 *     summary: Change own password
 *     description: >
 *       Validates the current password, then hashes and saves the new one.
 *       Requires `newPassword` to be at least 6 characters.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 example: Admin@123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 example: NewAdmin@456
 *     responses:
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Password changed successfully
 *       400:
 *         description: Missing fields or weak password
 *       401:
 *         description: Current password is incorrect
 */
router.put('/me/password', changePasswordHandler);

/**
 * @swagger
 * /api/admin/dashboard:
 *   get:
 *     summary: Admin dashboard stats
 *     description: Returns user counts (total, active, inactive, banned). Available to both admin and superadmin.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: object
 *                   properties:
 *                     total:    { type: number, example: 1240 }
 *                     active:   { type: number, example: 1180 }
 *                     inactive: { type: number, example: 42 }
 *                     banned:   { type: number, example: 18 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/dashboard', getAdminDashboardHandler);

// ── Room / Match oversight (read-only) ───────────────────────────────────────

/**
 * @swagger
 * /api/admin/rooms:
 *   get:
 *     summary: List all rooms (admin oversight)
 *     description: >
 *       Returns all rooms. Filterable by `status`.
 *       Read-only oversight — admins cannot modify rooms.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [waiting, toss_pending, active, completed, abandoned]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated room list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/rooms', requirePermission('rooms.read'), getAllRoomsAdminHandler);

/**
 * @swagger
 * /api/admin/rooms/{roomId}:
 *   get:
 *     summary: Get room detail (admin oversight)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Room detail with players
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Room'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/rooms/:roomId', requirePermission('rooms.read'), getRoomByIdAdminHandler);

/**
 * @swagger
 * /api/admin/rooms/{roomId}/abandon:
 *   put:
 *     summary: Abandon a room (admin action)
 *     description: >
 *       Force-abandon a room. Sets room status to `abandoned` and also abandons the associated match if any.
 *       Only works on rooms that are not already completed or abandoned.
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
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
 *               type: object
 *               properties:
 *                 message: { type: string, example: Room abandoned by admin }
 *                 room:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Room is already completed or abandoned
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/rooms/:roomId/abandon', requirePermission('rooms.delete'), abandonRoomAdminHandler);

/**
 * @swagger
 * /api/admin/matches:
 *   get:
 *     summary: List all matches (admin oversight)
 *     description: Returns all matches. Filterable by `status`.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [not_started, active, innings_break, set_break, completed, abandoned]
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated match list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/matches', requirePermission('matches.read'), getAllMatchesAdminHandler);

/**
 * @swagger
 * /api/admin/matches/{matchId}:
 *   get:
 *     summary: Get match detail (admin oversight)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: matchId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Match'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/matches/:matchId', requirePermission('matches.read'), getMatchByIdAdminHandler);

/**
 * @swagger
 * /api/admin/matches/{matchId}/abandon:
 *   put:
 *     summary: Abandon a match (admin action)
 *     description: >
 *       Force-abandon a match. Sets match status to `abandoned` and room status to `abandoned`.
 *       Only works on matches that are not already completed or abandoned.
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
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
 *               type: object
 *               properties:
 *                 message: { type: string, example: Match abandoned by admin }
 *                 match:
 *                   $ref: '#/components/schemas/Match'
 *       400:
 *         description: Match is already completed or abandoned
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/matches/:matchId/abandon', requirePermission('matches.delete'), abandonMatchAdminHandler);

// ── User management ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: List all users (admin panel)
 *     description: >
 *       Returns a paginated list of all regular users with their account status.
 *       Searchable by name, username, or email. Filterable by `status`.
 *
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches against name, username, or email
 *         example: john
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *         description: Filter by account status
 *         example: banned
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated user list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserListResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users', requirePermission('users.read'), getAllUsersHandler);

/**
 * @swagger
 * /api/admin/users/export:
 *   get:
 *     summary: Export users data
 *     description: Export all users as JSON or CSV. Optional status filter.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *     responses:
 *       200:
 *         description: Exported data
 */
router.get('/users/export', requirePermission('users.read'), exportUsersHandler);

/**
 * @swagger
 * /api/admin/users/bulk-action:
 *   put:
 *     summary: Bulk user status change
 *     description: >
 *       Apply a status action to multiple users at once.
 *       Maximum 100 users per request. Skips users that cannot be modified.
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userIds, action]
 *             properties:
 *               userIds:
 *                 type: array
 *                 items: { type: string }
 *                 example: ["664a1f3e2b5c1a0012345678", "664a1f3e2b5c1a0012345679"]
 *               action:
 *                 type: string
 *                 enum: [ban, unban, activate, deactivate]
 *     responses:
 *       200:
 *         description: Bulk action result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message: { type: string }
 *                 success: { type: integer }
 *                 skipped: { type: integer }
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: string }
 *                       message: { type: string }
 */
router.put('/users/bulk-action', requirePermission('users.update'), bulkUserActionHandler);

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   get:
 *     summary: Get a user's full detail (admin view)
 *     description: >
 *       Returns full profile of a regular user including account status and timestamps.
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUser'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/users/:userId', requirePermission('users.read'), getUserDetailHandler);

/**
 * @swagger
 * /api/admin/users/{userId}/ban:
 *   put:
 *     summary: Ban a user
 *     description: >
 *       Sets status to `banned`. The user is immediately blocked — any active JWT
 *       returns 403 on the next request. Use `unban` to restore access.
 *
 *       **Protection rules:**
 *       - Cannot ban a `superadmin`
 *       - `admin` cannot ban another `admin` — superadmin panel required
 *       - Cannot ban an already-banned user (409)
 *       - Cannot ban yourself (400)
 *
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User banned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStatusActionResponse'
 *             example:
 *               message: User "John Doe" has been banned
 *               user: { _id: 664a1f3e2b5c1a0012345678, name: John Doe, status: banned }
 *       400:
 *         description: Self-action or already in that status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               self: { value: { message: You cannot change your own status } }
 *               already: { value: { message: User is already banned } }
 *       403:
 *         description: Target is superadmin or admin-on-admin restriction
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               superadmin:
 *                 value: { message: Super admin account cannot be modified }
 *               adminOnAdmin:
 *                 value: { message: Admins cannot manage other admin accounts — contact the super admin }
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/users/:userId/ban', requirePermission('users.delete'), banUserHandler);

/**
 * @swagger
 * /api/admin/users/{userId}/unban:
 *   put:
 *     summary: Unban a user
 *     description: >
 *       Restores status to `active` from `banned`. The user can log in again immediately.
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User unbanned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStatusActionResponse'
 *             example:
 *               message: User "John Doe" has been unbanned
 *               user: { _id: 664a1f3e2b5c1a0012345678, status: active }
 *       409:
 *         description: User is already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: User is already active
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/users/:userId/unban', requirePermission('users.update'), unbanUserHandler);

/**
 * @swagger
 * /api/admin/users/{userId}/activate:
 *   put:
 *     summary: Activate a user account
 *     description: >
 *       Sets status from `inactive` → `active`. The user can log in again immediately.
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User activated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStatusActionResponse'
 *             example:
 *               message: User "John Doe" has been activated
 *               user: { _id: 664a1f3e2b5c1a0012345678, status: active }
 *       409:
 *         description: User is already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: User is already active
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/users/:userId/activate', requirePermission('users.update'), activateUserHandler);

/**
 * @swagger
 * /api/admin/users/{userId}/deactivate:
 *   put:
 *     summary: Deactivate a user account
 *     description: >
 *       Sets status to `inactive`. The user is immediately blocked from logging in.
 *       Existing JWTs are invalidated on the next request. Use `activate` to restore.
 *
 *       **Rules (same as ban):**
 *       - Cannot deactivate a `superadmin`
 *       - `admin` cannot deactivate another `admin`
 *       - Cannot deactivate yourself
 *
 *       Accessible by: **admin**, **superadmin**
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *         example: 664a1f3e2b5c1a0012345678
 *     responses:
 *       200:
 *         description: User deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStatusActionResponse'
 *             example:
 *               message: User "John Doe" has been deactivated
 *               user: { _id: 664a1f3e2b5c1a0012345678, status: inactive }
 *       403:
 *         description: Cannot deactivate superadmin or admin (as admin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/users/:userId/deactivate', requirePermission('users.update'), deactivateUserHandler);

// ── Notifications oversight ─────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/notifications:
 *   get:
 *     summary: List all notifications (admin oversight)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [match_completed, added_to_match, friend_request_received, friend_request_accepted, friend_request_rejected]
 *       - in: query
 *         name: read
 *         schema: { type: string, enum: [true, false] }
 *     responses:
 *       200:
 *         description: Paginated notification list
 */
router.get('/notifications', requirePermission('notifications.read'), getNotificationsAdminHandler);

/**
 * @swagger
 * /api/admin/notifications/stats:
 *   get:
 *     summary: Get notification statistics
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Notification stats (total, unread, by type)
 */
router.get('/notifications/stats', requirePermission('notifications.read'), getNotificationStatsHandler);

/**
 * @swagger
 * /api/admin/notifications/{id}:
 *   delete:
 *     summary: Delete a notification
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 *       404:
 *         description: Not found
 */
router.delete('/notifications/:id', requirePermission('notifications.delete'), deleteNotificationHandler);

// ── Subscription / Plans management ─────────────────────────────────────────

/**
 * @swagger
 * /api/admin/plans:
 *   get:
 *     summary: List all plans (including inactive)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All plans
 */
router.get('/plans', requirePermission('plans.read'), adminGetAllPlansHandler);

/**
 * @swagger
 * /api/admin/plans/{id}:
 *   put:
 *     summary: Update a plan (limits, features, pricing)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan updated
 */
router.put('/plans/:id', requirePermission('plans.update'), adminUpdatePlanHandler);

/**
 * @swagger
 * /api/admin/match-packs:
 *   get:
 *     summary: List all match packs (including inactive)
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All match packs
 */
router.get('/match-packs', requirePermission('plans.read'), adminGetAllMatchPacksHandler);

/**
 * @swagger
 * /api/admin/match-packs/{id}:
 *   put:
 *     summary: Update a match pack
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match pack updated
 */
router.put('/match-packs/:id', requirePermission('plans.update'), adminUpdateMatchPackHandler);

/**
 * @swagger
 * /api/admin/subscriptions:
 *   get:
 *     summary: List all user subscriptions
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [active, expired, cancelled] }
 *       - in: query
 *         name: planId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated subscriptions
 */
router.get('/subscriptions', requirePermission('plans.read'), adminGetSubscriptionsHandler);

/**
 * @swagger
 * /api/admin/orders:
 *   get:
 *     summary: List all orders
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [created, paid, failed, refunded] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [subscription, match_pack] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated orders
 */
router.get('/orders', requirePermission('plans.read'), adminGetOrdersHandler);

/**
 * @swagger
 * /api/admin/revenue/stats:
 *   get:
 *     summary: Revenue dashboard stats
 *     tags: [Admin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue stats (total, monthly breakdown, plan distribution)
 */
router.get('/revenue/stats', requirePermission('plans.read'), adminGetRevenueStatsHandler);

module.exports = router;
