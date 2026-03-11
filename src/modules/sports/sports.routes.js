const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const {
  createHandler,
  getAllHandler,
  getOneHandler,
  updateHandler,
  deleteHandler,
  getByUserHandler,
} = require('./sports.controller');

router.use(protect);

/**
 * @swagger
 * /api/sports:
 *   post:
 *     summary: Create a sport profile for the logged-in user
 *     description: >
 *       Creates a new sport profile with separate `local` and `tournaments` stat sections.
 *       Each user can have only one profile per sport (enforced by a unique index).
 *       Supported sports: **cricket**, **pickleball**, **tennis**, **badminton**.
 *
 *       The shape of `local` and `tournaments` is sport-specific — see the schema examples below.
 *     tags: [Sports]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SportCreateRequest'
 *           examples:
 *             cricket:
 *               summary: Cricket profile
 *               value:
 *                 sport: cricket
 *                 local:
 *                   team: Riverside CC
 *                   league: City Premier League
 *                   season: "2025"
 *                   role: All-rounder
 *                   captain: false
 *                   batting:
 *                     matches: 20
 *                     innings: 18
 *                     runs: 640
 *                     notOuts: 3
 *                     highScore: 98
 *                     average: 42.67
 *                     strikeRate: 85.3
 *                     hundreds: 0
 *                     fifties: 5
 *                     fours: 72
 *                     sixes: 14
 *                     ducks: 1
 *                   bowling:
 *                     wickets: 18
 *                     overs: 76
 *                     runs: 340
 *                     economy: 4.47
 *                     average: 18.89
 *                     bestBowling: 4/22
 *                     maidens: 8
 *                   fielding:
 *                     catches: 14
 *                     runOuts: 3
 *                     stumpings: 0
 *                 tournaments:
 *                   batting:
 *                     matches: 5
 *                     runs: 180
 *                     average: 45.0
 *                     strikeRate: 90.0
 *                   bowling:
 *                     wickets: 6
 *                     economy: 4.8
 *                     bestBowling: 3/18
 *                   fielding:
 *                     catches: 4
 *                   events:
 *                     - name: State T20 Championship
 *                       year: 2025
 *                       format: t20
 *                       result: Winner
 *                       playerOfTournament: true
 *             pickleball:
 *               summary: Pickleball profile
 *               value:
 *                 sport: pickleball
 *                 local:
 *                   club: Westside Pickleball Club
 *                   league: Austin Parks League
 *                   city: Austin, TX
 *                   rating: 4.5
 *                   matches: 45
 *                   wins: 32
 *                   losses: 13
 *                   winPercentage: 71.1
 *                   singles:
 *                     matches: 20
 *                     wins: 13
 *                     losses: 7
 *                   doubles:
 *                     matches: 25
 *                     wins: 19
 *                     losses: 6
 *                     partner: Jane Smith
 *                 tournaments:
 *                   rating: 4.5
 *                   matches: 41
 *                   wins: 29
 *                   losses: 12
 *                   winPercentage: 70.7
 *                   titlesWon: 3
 *                   events:
 *                     - name: Texas Open Pickleball Championship
 *                       year: 2025
 *                       format: doubles
 *                       level: 4.5+
 *                       result: Gold Medal
 *                       sanctioned: true
 *                       organization: USA Pickleball
 *             tennis:
 *               summary: Tennis profile
 *               value:
 *                 sport: tennis
 *                 local:
 *                   club: Greenwood Tennis Club
 *                   league: USTA League 4.5
 *                   city: Atlanta, GA
 *                   utrRating: 9.4
 *                   coach: Carlos Mendez
 *                   matches: 60
 *                   wins: 42
 *                   losses: 18
 *                   winPercentage: 70.0
 *                   singles:
 *                     matches: 40
 *                     wins: 27
 *                     losses: 13
 *                   doubles:
 *                     matches: 20
 *                     wins: 15
 *                     losses: 5
 *                     partner: Alex Johnson
 *                   serve:
 *                     aces: 48
 *                     doubleFaults: 12
 *                     firstServePercentage: 63.5
 *                     firstServePointsWon: 74.2
 *                     secondServePointsWon: 55.1
 *                   surface:
 *                     hard:  { matches: 30, wins: 21 }
 *                     clay:  { matches: 20, wins: 14 }
 *                     grass: { matches: 10, wins: 7 }
 *                 tournaments:
 *                   ranking: 145
 *                   utrRating: 9.4
 *                   titlesWon: 6
 *                   matches: 60
 *                   wins: 45
 *                   losses: 15
 *                   winPercentage: 75.0
 *                   events:
 *                     - name: USTA Georgia State Championship
 *                       year: 2025
 *                       surface: hard
 *                       category: 4.5+
 *                       result: Winner
 *                       sanctioned: true
 *                       prize: $500
 *             badminton:
 *               summary: Badminton profile
 *               value:
 *                 sport: badminton
 *                 local:
 *                   club: Eastside Badminton Academy
 *                   league: Ontario Badminton Association League
 *                   city: Toronto, ON
 *                   level: A Division
 *                   coach: Li Wei
 *                   matches: 120
 *                   wins: 88
 *                   losses: 32
 *                   winPercentage: 73.3
 *                   singles:
 *                     matches: 50
 *                     wins: 35
 *                     losses: 15
 *                   doubles:
 *                     matches: 50
 *                     wins: 38
 *                     losses: 12
 *                     partner: Raj Patel
 *                   mixedDoubles:
 *                     matches: 20
 *                     wins: 15
 *                     losses: 5
 *                     partner: Priya Nair
 *                   performance:
 *                     topSmashedSpeed_kmh: 312
 *                     rallyWinPercentage: 58.3
 *                     avgRallyLength: 8.4
 *                     serviceAccuracy: 94.2
 *                 tournaments:
 *                   bwfRanking: 850
 *                   bwfPoints: 14200
 *                   titlesWon: 11
 *                   matches: 80
 *                   wins: 64
 *                   losses: 16
 *                   winPercentage: 80.0
 *                   events:
 *                     - name: Ontario Open Badminton Championship
 *                       year: 2025
 *                       level: Provincial
 *                       discipline: Men's Singles
 *                       result: Winner
 *                       bwfPoints: 1200
 *                       sanctioned: true
 *                       prize: CAD $800
 *     responses:
 *       201:
 *         description: Sport profile created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Profile for this sport already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: You already have a profile for this sport
 */
router.post('/', createHandler);

/**
 * @swagger
 * /api/sports:
 *   get:
 *     summary: Get all sport profiles for the logged-in user
 *     description: Returns an array of all sport profiles belonging to the authenticated user.
 *     tags: [Sports]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of sport profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SportProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getAllHandler);

/**
 * @swagger
 * /api/sports/user/{userId}:
 *   get:
 *     summary: Get all sport profiles for a specific user
 *     description: Returns an array of all sport profiles belonging to the specified user. Any authenticated user can view.
 *     tags: [Sports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the user
 *     responses:
 *       200:
 *         description: List of sport profiles
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SportProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/user/:userId', getByUserHandler);

/**
 * @swagger
 * /api/sports/{id}:
 *   get:
 *     summary: Get a single sport profile by ID
 *     description: Fetches one sport profile. The profile must belong to the authenticated user.
 *     tags: [Sports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the sport profile
 *         example: 664a2b3c1d0e2f0034567890
 *     responses:
 *       200:
 *         description: Sport profile found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', getOneHandler);

/**
 * @swagger
 * /api/sports/{id}:
 *   put:
 *     summary: Update local or tournament statistics for a sport profile
 *     description: >
 *       Provide `local`, `tournaments`, or both.
 *       Only the supplied sections are overwritten — omitting one leaves it untouched.
 *     tags: [Sports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the sport profile
 *         example: 664a2b3c1d0e2f0034567890
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SportUpdateRequest'
 *           examples:
 *             updateLocal:
 *               summary: Update only local stats
 *               value:
 *                 local:
 *                   batting:
 *                     matches: 25
 *                     runs: 820
 *                     average: 46.8
 *             updateTournaments:
 *               summary: Add a new tournament event
 *               value:
 *                 tournaments:
 *                   events:
 *                     - name: District Cup 2025
 *                       year: 2025
 *                       format: odi
 *                       result: Runner-up
 *             updateBoth:
 *               summary: Update both sections at once
 *               value:
 *                 local:
 *                   batting:
 *                     matches: 25
 *                     runs: 820
 *                 tournaments:
 *                   batting:
 *                     matches: 8
 *                     runs: 210
 *     responses:
 *       200:
 *         description: Sport profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SportProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.put('/:id', updateHandler);

/**
 * @swagger
 * /api/sports/{id}:
 *   delete:
 *     summary: Delete a sport profile
 *     description: Permanently deletes the sport profile. Only the owner can delete their profile.
 *     tags: [Sports]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId of the sport profile
 *         example: 664a2b3c1d0e2f0034567890
 *     responses:
 *       200:
 *         description: Profile deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageResponse'
 *             example:
 *               message: Sport profile deleted
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.delete('/:id', deleteHandler);

module.exports = router;
