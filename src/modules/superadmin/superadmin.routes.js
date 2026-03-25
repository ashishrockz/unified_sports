const router = require('express').Router();
const { protect }            = require('../../middlewares/auth.middleware');
const { requireSuperAdmin }  = require('../../middlewares/admin.middleware');
const {
  createAdminHandler,
  getAllAdminsHandler,
  getAdminByIdHandler,
  activateAdminHandler,
  deactivateAdminHandler,
  removeAdminHandler,
  getDashboardStatsHandler,
} = require('./superadmin.controller');
const {
  superadminCreatePlanHandler,
  superadminDeletePlanHandler,
  superadminCreateMatchPackHandler,
  superadminDeleteMatchPackHandler,
} = require('../subscription/subscription.controller');

// All superadmin routes require a valid JWT + superadmin role
router.use(protect, requireSuperAdmin);

// ─────────────────────────────────────────────────────────────────────────────
// Swagger component schemas (picked up by swagger-jsdoc)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: SuperAdmin
 *   description: Super admin only — admin (employee) management and platform dashboard
 */

/**
 * @swagger
 * components:
 *   schemas:
 *
 *     AdminUser:
 *       type: object
 *       description: A user with role admin or superadmin (includes status field)
 *       properties:
 *         _id:
 *           type: string
 *           example: 664a1f3e2b5c1a0012345678
 *         name:
 *           type: string
 *           example: John Admin
 *         username:
 *           type: string
 *           nullable: true
 *           example: john_admin
 *         email:
 *           type: string
 *           example: admin@unifiedsports.com
 *         phone:
 *           type: string
 *           nullable: true
 *         avatar:
 *           type: string
 *           nullable: true
 *         role:
 *           type: string
 *           enum: [user, super_admin, admin, manager, editor, viewer]
 *           example: admin
 *         status:
 *           type: string
 *           enum: [active, inactive, banned]
 *           example: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     AdminUserListResponse:
 *       type: object
 *       properties:
 *         users:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AdminUser'
 *         pagination:
 *           $ref: '#/components/schemas/PaginationMeta'
 *
 *     AdminListResponse:
 *       type: object
 *       properties:
 *         admins:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/AdminUser'
 *         pagination:
 *           $ref: '#/components/schemas/PaginationMeta'
 *
 *     UserStatusActionResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: User "John Doe" has been banned
 *         user:
 *           $ref: '#/components/schemas/AdminUser'
 *
 *     CreateAdminRequest:
 *       type: object
 *       required: [name, email, password]
 *       properties:
 *         name:
 *           type: string
 *           example: Jane Admin
 *         email:
 *           type: string
 *           format: email
 *           example: jane.admin@unifiedsports.com
 *         password:
 *           type: string
 *           format: password
 *           minLength: 6
 *           example: SecurePass@99
 *
 *     DashboardStats:
 *       type: object
 *       properties:
 *         users:
 *           type: object
 *           properties:
 *             total:    { type: number, example: 1240 }
 *             active:   { type: number, example: 1180 }
 *             inactive: { type: number, example: 42 }
 *             banned:   { type: number, example: 18 }
 *         admins:
 *           type: object
 *           properties:
 *             total:    { type: number, example: 8 }
 *             active:   { type: number, example: 7 }
 *             inactive: { type: number, example: 1 }
 */

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/superadmin/dashboard:
 *   get:
 *     summary: Platform dashboard stats
 *     description: >
 *       Returns a snapshot of all user and admin counts broken down by status.
 *       Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *             example:
 *               users:
 *                 total: 1240
 *                 active: 1180
 *                 inactive: 42
 *                 banned: 18
 *               admins:
 *                 total: 8
 *                 active: 7
 *                 inactive: 1
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/dashboard', getDashboardStatsHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Admin (employee) management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/superadmin/admins:
 *   post:
 *     summary: Create a new admin (employee)
 *     description: >
 *       Creates a new admin account with email + bcrypt-hashed password.
 *       The admin can immediately log in via `POST /api/admin/login`.
 *
 *       **Rules:**
 *       - Email must be unique across the whole system
 *       - Password minimum 6 characters
 *       - Role is forced to `admin` (cannot create another superadmin via API)
 *       - Status starts as `active`
 *
 *       Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAdminRequest'
 *           example:
 *             name: Jane Admin
 *             email: jane.admin@unifiedsports.com
 *             password: SecurePass@99
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Admin account created successfully
 *                 admin:
 *                   $ref: '#/components/schemas/AdminUser'
 *             example:
 *               message: Admin account created successfully
 *               admin:
 *                 _id: 664a9b8c7d6e5f0078901234
 *                 name: Jane Admin
 *                 email: jane.admin@unifiedsports.com
 *                 role: admin
 *                 status: active
 *                 createdAt: "2025-05-21T10:00:00.000Z"
 *       400:
 *         description: Missing fields or weak password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 value: { message: name, email, and password are required }
 *               weakPassword:
 *                 value: { message: Password must be at least 6 characters }
 *       409:
 *         description: Email already in use
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: An account with this email already exists
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/admins', createAdminHandler);

/**
 * @swagger
 * /api/superadmin/admins:
 *   get:
 *     summary: List all admin accounts
 *     description: >
 *       Returns a paginated list of all admin (employee) accounts.
 *       Filterable by status (`active` | `inactive`).
 *       Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Matches name, username, or email
 *         example: jane
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *         example: active
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated admin list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminListResponse'
 *             example:
 *               admins:
 *                 - _id: 664a9b8c7d6e5f0078901234
 *                   name: Jane Admin
 *                   email: jane.admin@unifiedsports.com
 *                   role: admin
 *                   status: active
 *                   createdAt: "2025-05-21T10:00:00.000Z"
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 8
 *                 totalPages: 1
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/admins', getAllAdminsHandler);

/**
 * @swagger
 * /api/superadmin/admins/{adminId}:
 *   get:
 *     summary: Get a specific admin's profile
 *     description: Returns the full profile of an admin account. Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema: { type: string }
 *         example: 664a9b8c7d6e5f0078901234
 *     responses:
 *       200:
 *         description: Admin profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUser'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.get('/admins/:adminId', getAdminByIdHandler);

/**
 * @swagger
 * /api/superadmin/admins/{adminId}/activate:
 *   put:
 *     summary: Activate an admin account
 *     description: >
 *       Sets admin status from `inactive` → `active`.
 *       The admin can log in again immediately.
 *       Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema: { type: string }
 *         example: 664a9b8c7d6e5f0078901234
 *     responses:
 *       200:
 *         description: Admin activated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStatusActionResponse'
 *             example:
 *               message: Admin "Jane Admin" has been activated
 *               admin: { _id: 664a9b8c7d6e5f0078901234, role: admin, status: active }
 *       400:
 *         description: Self-action not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: You cannot change your own status
 *       409:
 *         description: Admin is already active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Admin account is already active
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/admins/:adminId/activate', activateAdminHandler);

/**
 * @swagger
 * /api/superadmin/admins/{adminId}/deactivate:
 *   put:
 *     summary: Deactivate an admin account
 *     description: >
 *       Sets admin status to `inactive`. The admin is immediately blocked from logging in.
 *       Their existing JWT tokens return 403 on next request.
 *       Use `activate` to restore access.
 *
 *       **Rules:**
 *       - Cannot deactivate another superadmin
 *       - Cannot deactivate yourself
 *
 *       Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema: { type: string }
 *         example: 664a9b8c7d6e5f0078901234
 *     responses:
 *       200:
 *         description: Admin deactivated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserStatusActionResponse'
 *             example:
 *               message: Admin "Jane Admin" has been deactivated
 *               admin: { _id: 664a9b8c7d6e5f0078901234, role: admin, status: inactive }
 *       400:
 *         description: Self-action not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: You cannot change your own status
 *       403:
 *         description: Cannot deactivate a superadmin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Super admin account cannot be modified
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/admins/:adminId/deactivate', deactivateAdminHandler);

/**
 * @swagger
 * /api/superadmin/admins/{adminId}:
 *   delete:
 *     summary: Permanently remove an admin account
 *     description: >
 *       Deletes the admin account from the database. This action is irreversible.
 *
 *       **Rules:**
 *       - Cannot delete a superadmin account
 *       - Cannot delete yourself
 *       - Can only delete accounts with role `admin`
 *
 *       Only accessible by **superadmin**.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: adminId
 *         required: true
 *         schema: { type: string }
 *         example: 664a9b8c7d6e5f0078901234
 *     responses:
 *       200:
 *         description: Admin removed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Admin account "Jane Admin" has been permanently removed
 *       400:
 *         description: Self-deletion not allowed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: You cannot delete your own account
 *       403:
 *         description: Cannot delete a superadmin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: Super admin account cannot be deleted
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/admins/:adminId', removeAdminHandler);

// ─────────────────────────────────────────────────────────────────────────────
// Subscription plan & match pack management (superadmin only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/superadmin/plans:
 *   post:
 *     summary: Create a subscription plan
 *     description: Only superadmin can create new plans.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug, price]
 *             properties:
 *               name:        { type: string, example: Pro }
 *               slug:        { type: string, example: pro }
 *               description: { type: string }
 *               price:       { type: number, example: 99 }
 *               interval:    { type: string, enum: [monthly, yearly, lifetime] }
 *               isDefault:   { type: boolean }
 *               limits:
 *                 type: object
 *                 properties:
 *                   matchesPerDay:     { type: number }
 *                   matchesPerWeek:    { type: number }
 *                   matchHistoryCount: { type: number }
 *               features:
 *                 type: object
 *                 properties:
 *                   adFree:     { type: boolean }
 *                   commentary: { type: boolean }
 *                   analytics:  { type: boolean }
 *     responses:
 *       201:
 *         description: Plan created
 */
router.post('/plans', superadminCreatePlanHandler);

/**
 * @swagger
 * /api/superadmin/plans/{id}:
 *   delete:
 *     summary: Deactivate a plan
 *     description: Soft-deletes (deactivates) a plan. Cannot delete the default plan.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Plan deactivated
 */
router.delete('/plans/:id', superadminDeletePlanHandler);

/**
 * @swagger
 * /api/superadmin/match-packs:
 *   post:
 *     summary: Create a match pack
 *     description: Only superadmin can create new match packs.
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, matchCount, price]
 *             properties:
 *               name:       { type: string, example: "5 Matches" }
 *               matchCount: { type: number, example: 5 }
 *               price:      { type: number, example: 39 }
 *     responses:
 *       201:
 *         description: Match pack created
 */
router.post('/match-packs', superadminCreateMatchPackHandler);

/**
 * @swagger
 * /api/superadmin/match-packs/{id}:
 *   delete:
 *     summary: Deactivate a match pack
 *     tags: [SuperAdmin]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Match pack deactivated
 */
router.delete('/match-packs/:id', superadminDeleteMatchPackHandler);

module.exports = router;
