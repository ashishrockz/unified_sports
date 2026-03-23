const router = require('express').Router();
const { protect }            = require('../../middlewares/auth.middleware');
const { requirePermission }  = require('../../middlewares/admin.middleware');
const ctrl = require('./sportType.controller');

/**
 * @swagger
 * tags:
 *   name: SportType
 *   description: >
 *     Configurable sport type definitions.
 *     Each sport type stores rules (team size, innings/sets, scoring model, roles, toss options).
 *     Slug-based and list endpoints are **public** (no auth required).
 */

// ─── PUBLIC slug lookup ───────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sport-types/slug/{slug}:
 *   get:
 *     summary: Get sport type by slug (public)
 *     description: Returns a sport type by its globally unique slug. No authentication required.
 *     tags: [SportType]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *         example: t20-cricket
 *     responses:
 *       200:
 *         description: Sport type config
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportType'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/slug/:slug', ctrl.getBySlugHandler);

/**
 * @swagger
 * /api/sport-types/defaults/{sport}:
 *   get:
 *     summary: Get default config for a sport (public)
 *     description: Returns the recommended default configuration for a given sport. Useful as a starting template when creating a new sport type.
 *     tags: [SportType]
 *     parameters:
 *       - in: path
 *         name: sport
 *         required: true
 *         schema:
 *           type: string
 *           enum: [cricket, tennis, badminton, pickleball]
 *         example: cricket
 *     responses:
 *       200:
 *         description: Default sport configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportConfig'
 */
router.get('/defaults/:sport', ctrl.getDefaultsHandler);

// ─── PUBLIC list / get ────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/sport-types:
 *   get:
 *     summary: List all sport types
 *     description: Returns all sport types. Filterable by search, isActive. No auth required.
 *     tags: [SportType]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Filter by name, slug, or sport
 *       - in: query
 *         name: isActive
 *         schema: { type: boolean }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: List of sport types
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportTypeListResponse'
 */
router.get('/', ctrl.getAllHandler);

/**
 * @swagger
 * /api/sport-types/{sportTypeId}:
 *   get:
 *     summary: Get a sport type by ID
 *     tags: [SportType]
 *     parameters:
 *       - in: path
 *         name: sportTypeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sport type detail
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportType'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:sportTypeId', ctrl.getByIdHandler);

// ─── PROTECTED admin routes ───────────────────────────────────────────────────

/**
 * @swagger
 * /api/sport-types:
 *   post:
 *     summary: Create a sport type
 *     description: >
 *       Creates a configurable sport type.
 *       Only **admin** or **superadmin** can create sport types.
 *       Provide sport-specific config; omitted fields use sport defaults.
 *     tags: [SportType]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSportTypeRequest'
 *           examples:
 *             t20:
 *               summary: T20 Cricket
 *               value:
 *                 name: T20 Cricket
 *                 sport: cricket
 *                 description: 20-over cricket format
 *                 config:
 *                   minPlayers: 4
 *                   maxPlayers: 22
 *                   teamSize: 11
 *                   innings: 1
 *                   oversPerInnings: 20
 *                   tossOptions: ['bat', 'bowl']
 *             tennis:
 *               summary: Club Tennis
 *               value:
 *                 name: Club Tennis
 *                 sport: tennis
 *                 description: Best of 3 sets
 *                 config:
 *                   minPlayers: 2
 *                   maxPlayers: 4
 *                   teamSize: 1
 *                   sets: 3
 *                   gamesPerSet: 6
 *                   deuceEnabled: true
 *                   tossOptions: ['serve', 'receive', 'court_A', 'court_B']
 *     responses:
 *       201:
 *         description: Sport type created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportType'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/', protect, requirePermission('sport_types.create'), ctrl.createHandler);

/**
 * @swagger
 * /api/sport-types/{sportTypeId}:
 *   put:
 *     summary: Update a sport type
 *     tags: [SportType]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sportTypeId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateSportTypeRequest'
 *     responses:
 *       200:
 *         description: Sport type updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportType'
 */
router.put('/:sportTypeId', protect, requirePermission('sport_types.update'), ctrl.updateHandler);

/**
 * @swagger
 * /api/sport-types/{sportTypeId}:
 *   delete:
 *     summary: Delete a sport type
 *     tags: [SportType]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sportTypeId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sport type deleted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 */
router.delete('/:sportTypeId', protect, requirePermission('sport_types.delete'), ctrl.deleteHandler);

module.exports = router;
