const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Unified Sports API',
      version: '1.0.0',
      description:
        'REST API for managing multi-sport career statistics — Cricket, Pickleball, Tennis & Badminton.\n\n' +
        '**Authentication:** Regular users authenticate via OTP (phone/email). ' +
        'Admins authenticate with email + password.\n\n' +
        'All protected endpoints require a `Bearer <token>` header.',
      contact: { name: 'Unified Sports Dev Team' },
    },
    servers: [
      { url: 'http://localhost:8080', description: 'Local development server' },
    ],
    tags: [
      { name: 'Auth',        description: 'OTP-based authentication for regular users' },
      { name: 'Admin',       description: 'Admin panel — user management (ban/unban/activate/deactivate regular users)' },
      { name: 'SuperAdmin',  description: 'Super admin panel — admin management, dashboard stats, full platform control' },
      { name: 'User',        description: 'User discovery (search by name/username), profile management' },
      { name: 'Friends',     description: 'Friend request lifecycle — send, accept, reject, cancel, unfriend, block, unblock' },
      { name: 'Sports',      description: 'Sport profile & statistics (Cricket | Pickleball | Tennis | Badminton)' },
      { name: 'SportType',   description: 'Configurable sport types (Cricket, Tennis, Badminton, Pickleball). Global definitions with slug-based lookup.' },
      { name: 'Room',        description: 'Match rooms — player management, toss flow, team assignments. State machine: waiting → toss_pending → active → completed/abandoned.' },
      { name: 'Match',       description: 'Match scoring — ball-by-ball (cricket) or point-by-point (racket). Auto-transitions through innings/set breaks to completion.' },
      { name: 'Leaderboards', description: 'Player rankings — top batsmen, bowlers, most wins, most matches played' },
      { name: 'Highlights',   description: 'Auto-generated match highlights — top performers, milestones, innings summaries' },
      { name: 'Analytics',   description: 'Platform analytics — user signups, match/room trends, sport popularity' },
      { name: 'AuditLog',    description: 'Admin activity audit logs — superadmin only' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Paste the JWT token returned by verify-otp or admin/login',
        },
      },
      schemas: {

        // ── Generic ────────────────────────────────────────────────────────
        MessageResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Operation successful' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Something went wrong' },
          },
        },

        // ── Auth ───────────────────────────────────────────────────────────
        OtpSendRequest: {
          type: 'object',
          required: ['identifier', 'type'],
          properties: {
            identifier: {
              type: 'string',
              description: 'Phone number or email address',
              example: 'user@example.com',
            },
            type: {
              type: 'string',
              enum: ['phone', 'email'],
              example: 'email',
            },
          },
        },
        OtpVerifyRequest: {
          type: 'object',
          required: ['identifier', 'type', 'otp'],
          properties: {
            identifier: { type: 'string', example: 'user@example.com' },
            type: { type: 'string', enum: ['phone', 'email'], example: 'email' },
            otp: { type: 'string', example: '482916' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT — valid for 7 days',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            user: { $ref: '#/components/schemas/User' },
          },
        },

        // ── Admin ──────────────────────────────────────────────────────────
        AdminLoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email:    { type: 'string', format: 'email', example: 'admin@unifiedsports.com' },
            password: { type: 'string', format: 'password', example: 'Admin@123' },
          },
        },

        // ── User ───────────────────────────────────────────────────────────
        User: {
          type: 'object',
          properties: {
            _id:      { type: 'string', example: '664a1f3e2b5c1a0012345678' },
            name:     { type: 'string', example: 'John Doe' },
            username: {
              type: 'string',
              example: 'john_doe',
              description: 'Unique handle (3–25 chars, lowercase letters/numbers/underscores). Used for friend discovery.',
            },
            email:     { type: 'string', example: 'user@example.com' },
            phone:     { type: 'string', example: '+919876543210' },
            avatar:    { type: 'string', example: 'https://cdn.example.com/avatar.jpg' },
            role: {
              type: 'string',
              enum: ['user', 'admin', 'superadmin'],
              example: 'user',
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'banned'],
              example: 'active',
              description: 'active — normal access · inactive — deactivated by admin/superadmin · banned — banned by admin/superadmin',
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            name:     { type: 'string', example: 'Jane Doe' },
            username: {
              type: 'string',
              example: 'jane_doe',
              description: '3–25 chars · lowercase letters, numbers, underscores only · globally unique',
            },
            avatar:   { type: 'string', example: 'https://cdn.example.com/new-avatar.jpg' },
          },
        },

        // ── Sports — shared sub-structures ─────────────────────────────────
        CricketBatting: {
          type: 'object',
          properties: {
            matches:    { type: 'number', example: 20 },
            innings:    { type: 'number', example: 18 },
            runs:       { type: 'number', example: 640 },
            notOuts:    { type: 'number', example: 3 },
            highScore:  { type: 'number', example: 98 },
            average:    { type: 'number', example: 42.67 },
            strikeRate: { type: 'number', example: 85.3 },
            hundreds:   { type: 'number', example: 0 },
            fifties:    { type: 'number', example: 5 },
            fours:      { type: 'number', example: 72 },
            sixes:      { type: 'number', example: 14 },
            ducks:      { type: 'number', example: 1 },
          },
        },
        CricketBowling: {
          type: 'object',
          properties: {
            wickets:     { type: 'number', example: 18 },
            overs:       { type: 'number', example: 76 },
            runs:        { type: 'number', example: 340 },
            economy:     { type: 'number', example: 4.47 },
            average:     { type: 'number', example: 18.89 },
            strikeRate:  { type: 'number', example: 25.3 },
            bestBowling: { type: 'string', example: '4/22' },
            fiveWickets: { type: 'number', example: 0 },
            maidens:     { type: 'number', example: 8 },
          },
        },
        CricketFielding: {
          type: 'object',
          properties: {
            catches:   { type: 'number', example: 14 },
            runOuts:   { type: 'number', example: 3 },
            stumpings: { type: 'number', example: 0 },
          },
        },
        CricketLocal: {
          type: 'object',
          properties: {
            team:    { type: 'string', example: 'Riverside CC' },
            league:  { type: 'string', example: 'City Premier League' },
            season:  { type: 'string', example: '2025' },
            role:    { type: 'string', example: 'All-rounder' },
            captain: { type: 'boolean', example: false },
            batting:  { $ref: '#/components/schemas/CricketBatting' },
            bowling:  { $ref: '#/components/schemas/CricketBowling' },
            fielding: { $ref: '#/components/schemas/CricketFielding' },
          },
        },
        CricketTournamentEvent: {
          type: 'object',
          properties: {
            name:               { type: 'string', example: 'State T20 Championship' },
            year:               { type: 'number', example: 2025 },
            format:             { type: 'string', enum: ['test', 'odi', 't20', 'other'], example: 't20' },
            result:             { type: 'string', example: 'Winner' },
            playerOfTournament: { type: 'boolean', example: true },
          },
        },
        CricketTournaments: {
          type: 'object',
          properties: {
            batting:  { $ref: '#/components/schemas/CricketBatting' },
            bowling:  { $ref: '#/components/schemas/CricketBowling' },
            fielding: { $ref: '#/components/schemas/CricketFielding' },
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/CricketTournamentEvent' },
            },
          },
        },

        PickleballLocal: {
          type: 'object',
          properties: {
            club:    { type: 'string', example: 'Westside Pickleball Club' },
            league:  { type: 'string', example: 'Austin Parks League' },
            city:    { type: 'string', example: 'Austin, TX' },
            rating:  { type: 'number', example: 4.5, description: 'DUPR rating' },
            matches: { type: 'number', example: 45 },
            wins:    { type: 'number', example: 32 },
            losses:  { type: 'number', example: 13 },
            winPercentage: { type: 'number', example: 71.1 },
            singles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 20 },
                wins:    { type: 'number', example: 13 },
                losses:  { type: 'number', example: 7 },
              },
            },
            doubles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 25 },
                wins:    { type: 'number', example: 19 },
                losses:  { type: 'number', example: 6 },
                partner: { type: 'string', example: 'Jane Smith' },
              },
            },
            mixedDoubles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 0 },
                wins:    { type: 'number', example: 0 },
                losses:  { type: 'number', example: 0 },
                partner: { type: 'string', example: '' },
              },
            },
          },
        },
        PickleballTournamentEvent: {
          type: 'object',
          properties: {
            name:         { type: 'string', example: 'Texas Open Pickleball Championship' },
            year:         { type: 'number', example: 2025 },
            format:       { type: 'string', enum: ['singles', 'doubles', 'mixed doubles'], example: 'doubles' },
            level:        { type: 'string', example: '4.5+' },
            result:       { type: 'string', example: 'Gold Medal' },
            sanctioned:   { type: 'boolean', example: true },
            organization: { type: 'string', example: 'USA Pickleball' },
          },
        },
        PickleballTournaments: {
          type: 'object',
          properties: {
            rating:        { type: 'number', example: 4.5 },
            matches:       { type: 'number', example: 41 },
            wins:          { type: 'number', example: 29 },
            losses:        { type: 'number', example: 12 },
            winPercentage: { type: 'number', example: 70.7 },
            titlesWon:     { type: 'number', example: 3 },
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/PickleballTournamentEvent' },
            },
          },
        },

        TennisServeStats: {
          type: 'object',
          properties: {
            aces:                 { type: 'number', example: 48 },
            doubleFaults:         { type: 'number', example: 12 },
            firstServePercentage: { type: 'number', example: 63.5 },
            firstServePointsWon:  { type: 'number', example: 74.2 },
            secondServePointsWon: { type: 'number', example: 55.1 },
          },
        },
        TennisLocal: {
          type: 'object',
          properties: {
            club:          { type: 'string', example: 'Greenwood Tennis Club' },
            league:        { type: 'string', example: 'USTA League 4.5' },
            city:          { type: 'string', example: 'Atlanta, GA' },
            utrRating:     { type: 'number', example: 9.4 },
            coach:         { type: 'string', example: 'Carlos Mendez' },
            matches:       { type: 'number', example: 60 },
            wins:          { type: 'number', example: 42 },
            losses:        { type: 'number', example: 18 },
            winPercentage: { type: 'number', example: 70.0 },
            singles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 40 },
                wins:    { type: 'number', example: 27 },
                losses:  { type: 'number', example: 13 },
              },
            },
            doubles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 20 },
                wins:    { type: 'number', example: 15 },
                losses:  { type: 'number', example: 5 },
                partner: { type: 'string', example: 'Alex Johnson' },
              },
            },
            serve: { $ref: '#/components/schemas/TennisServeStats' },
            surface: {
              type: 'object',
              properties: {
                hard:  { type: 'object', properties: { matches: { type: 'number', example: 30 }, wins: { type: 'number', example: 21 } } },
                clay:  { type: 'object', properties: { matches: { type: 'number', example: 20 }, wins: { type: 'number', example: 14 } } },
                grass: { type: 'object', properties: { matches: { type: 'number', example: 10 }, wins: { type: 'number', example: 7 } } },
              },
            },
          },
        },
        TennisTournamentEvent: {
          type: 'object',
          properties: {
            name:       { type: 'string', example: 'USTA Georgia State Championship' },
            year:       { type: 'number', example: 2025 },
            surface:    { type: 'string', enum: ['hard', 'clay', 'grass', 'indoor'], example: 'hard' },
            category:   { type: 'string', example: '4.5+' },
            result:     { type: 'string', example: 'Winner' },
            sanctioned: { type: 'boolean', example: true },
            prize:      { type: 'string', example: '$500' },
          },
        },
        TennisTournaments: {
          type: 'object',
          properties: {
            ranking:       { type: 'number', example: 145, description: 'UTR / ITF ranking' },
            utrRating:     { type: 'number', example: 9.4 },
            titlesWon:     { type: 'number', example: 6 },
            matches:       { type: 'number', example: 60 },
            wins:          { type: 'number', example: 45 },
            losses:        { type: 'number', example: 15 },
            winPercentage: { type: 'number', example: 75.0 },
            serve: { $ref: '#/components/schemas/TennisServeStats' },
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/TennisTournamentEvent' },
            },
          },
        },

        BadmintonPerformance: {
          type: 'object',
          properties: {
            topSmashedSpeed_kmh: { type: 'number', example: 312 },
            rallyWinPercentage:  { type: 'number', example: 58.3 },
            avgRallyLength:      { type: 'number', example: 8.4 },
            serviceAccuracy:     { type: 'number', example: 94.2 },
          },
        },
        BadmintonLocal: {
          type: 'object',
          properties: {
            club:    { type: 'string', example: 'Eastside Badminton Academy' },
            league:  { type: 'string', example: 'Ontario Badminton Association League' },
            city:    { type: 'string', example: 'Toronto, ON' },
            level:   { type: 'string', example: 'A Division' },
            coach:   { type: 'string', example: 'Li Wei' },
            matches: { type: 'number', example: 120 },
            wins:    { type: 'number', example: 88 },
            losses:  { type: 'number', example: 32 },
            winPercentage: { type: 'number', example: 73.3 },
            singles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 50 },
                wins:    { type: 'number', example: 35 },
                losses:  { type: 'number', example: 15 },
              },
            },
            doubles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 50 },
                wins:    { type: 'number', example: 38 },
                losses:  { type: 'number', example: 12 },
                partner: { type: 'string', example: 'Raj Patel' },
              },
            },
            mixedDoubles: {
              type: 'object',
              properties: {
                matches: { type: 'number', example: 20 },
                wins:    { type: 'number', example: 15 },
                losses:  { type: 'number', example: 5 },
                partner: { type: 'string', example: 'Priya Nair' },
              },
            },
            performance: { $ref: '#/components/schemas/BadmintonPerformance' },
          },
        },
        BadmintonTournamentEvent: {
          type: 'object',
          properties: {
            name:        { type: 'string', example: 'Ontario Open Badminton Championship' },
            year:        { type: 'number', example: 2025 },
            level:       { type: 'string', example: 'Provincial' },
            discipline:  { type: 'string', example: "Men's Singles" },
            result:      { type: 'string', example: 'Winner' },
            bwfCategory: { type: 'string', example: 'Super 300' },
            bwfPoints:   { type: 'number', example: 1200 },
            sanctioned:  { type: 'boolean', example: true },
            prize:       { type: 'string', example: 'CAD $800' },
          },
        },
        BadmintonTournaments: {
          type: 'object',
          properties: {
            bwfRanking:    { type: 'number', example: 850 },
            bwfPoints:     { type: 'number', example: 14200 },
            titlesWon:     { type: 'number', example: 11 },
            matches:       { type: 'number', example: 80 },
            wins:          { type: 'number', example: 64 },
            losses:        { type: 'number', example: 16 },
            winPercentage: { type: 'number', example: 80.0 },
            performance: { $ref: '#/components/schemas/BadmintonPerformance' },
            events: {
              type: 'array',
              items: { $ref: '#/components/schemas/BadmintonTournamentEvent' },
            },
          },
        },

        // ── Sport Profile (the full document) ──────────────────────────────
        SportProfile: {
          type: 'object',
          properties: {
            _id:    { type: 'string', example: '664a2b3c1d0e2f0034567890' },
            userId: { type: 'string', example: '664a1f3e2b5c1a0012345678' },
            sport:  { type: 'string', enum: ['cricket', 'pickleball', 'tennis', 'badminton'], example: 'cricket' },
            cricket: {
              type: 'object',
              properties: {
                local:       { $ref: '#/components/schemas/CricketLocal' },
                tournaments: { $ref: '#/components/schemas/CricketTournaments' },
              },
            },
            pickleball: {
              type: 'object',
              properties: {
                local:       { $ref: '#/components/schemas/PickleballLocal' },
                tournaments: { $ref: '#/components/schemas/PickleballTournaments' },
              },
            },
            tennis: {
              type: 'object',
              properties: {
                local:       { $ref: '#/components/schemas/TennisLocal' },
                tournaments: { $ref: '#/components/schemas/TennisTournaments' },
              },
            },
            badminton: {
              type: 'object',
              properties: {
                local:       { $ref: '#/components/schemas/BadmintonLocal' },
                tournaments: { $ref: '#/components/schemas/BadmintonTournaments' },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        SportCreateRequest: {
          type: 'object',
          required: ['sport'],
          properties: {
            sport: {
              type: 'string',
              enum: ['cricket', 'pickleball', 'tennis', 'badminton'],
              example: 'cricket',
            },
            local: {
              type: 'object',
              description: 'Local/club statistics — shape depends on sport',
              example: {
                team: 'Riverside CC',
                league: 'City Premier League',
                season: '2025',
                batting: { matches: 10, runs: 320, average: 40.0, strikeRate: 82.5 },
                bowling: { wickets: 8, economy: 5.1, bestBowling: '3/18' },
                fielding: { catches: 6 },
              },
            },
            tournaments: {
              type: 'object',
              description: 'Tournament statistics — shape depends on sport',
              example: {
                batting: { matches: 4, runs: 112, average: 37.3 },
                events: [{ name: 'State T20 Cup', year: 2025, format: 't20', result: 'Winner' }],
              },
            },
          },
        },

        SportUpdateRequest: {
          type: 'object',
          description: 'Supply at least one of local or tournaments. Only provided sections are updated.',
          properties: {
            local: {
              type: 'object',
              description: 'Replaces the local section for this sport',
              example: {
                batting: { matches: 15, runs: 480, average: 43.6 },
              },
            },
            tournaments: {
              type: 'object',
              description: 'Replaces the tournaments section for this sport',
              example: {
                events: [{ name: 'District Cup 2025', year: 2025, format: 'odi', result: 'Runner-up' }],
              },
            },
          },
        },

        // ── SportType ──────────────────────────────────────────────────────
        SportConfig: {
          type: 'object',
          description: 'Rule configuration — shape varies by sport',
          properties: {
            minPlayers:      { type: 'number', example: 2 },
            maxPlayers:      { type: 'number', example: 22 },
            teamSize:        { type: 'number', example: 11 },
            tossOptions:     { type: 'array', items: { type: 'string' }, example: ['bat', 'bowl'] },
            roles:           { type: 'array', items: { type: 'string' }, example: ['batsman', 'bowler', 'wicketkeeper', 'all-rounder'] },
            innings:         { type: 'number', example: 2, description: 'Cricket: number of innings per match' },
            oversPerInnings: { type: 'number', example: 20, description: 'Cricket: overs per innings' },
            sets:            { type: 'number', example: 3, description: 'Tennis: best-of N sets' },
            gamesPerSet:     { type: 'number', example: 6, description: 'Tennis: games per set' },
            deuceEnabled:    { type: 'boolean', example: true, description: 'Tennis: enable deuce/advantage rule' },
            pointsPerGame:   { type: 'number', example: 21, description: 'Badminton: points per game' },
            gamesPerMatch:   { type: 'number', example: 3, description: 'Badminton: games per match' },
            pointsToWin:     { type: 'number', example: 11, description: 'Pickleball: points to win a game' },
            winByTwo:        { type: 'boolean', example: true, description: 'Pickleball: must win by 2 points' },
          },
        },
        SportType: {
          type: 'object',
          properties: {
            _id:           { type: 'string', example: '664a2b3c1d0e2f0034567890' },
            name:          { type: 'string', example: 'T20 Cricket' },
            slug:          { type: 'string', example: 't20-cricket' },
            sport:         { type: 'string', enum: ['cricket', 'tennis', 'badminton', 'pickleball'], example: 'cricket' },
            description:   { type: 'string', example: '20-over format cricket match' },
            config:        { $ref: '#/components/schemas/SportConfig' },
            isActive:      { type: 'boolean', example: true },
            createdAt:     { type: 'string', format: 'date-time' },
            updatedAt:     { type: 'string', format: 'date-time' },
          },
        },

        // ── Room ───────────────────────────────────────────────────────────
        CreateRoomRequest: {
          type: 'object',
          required: ['sportTypeId', 'name'],
          properties: {
            sportTypeId: { type: 'string', example: '664a2b3c1d0e2f0034567890', description: 'ID of the sport type for this room' },
            name:        { type: 'string', example: 'Friday Night T20', description: 'Display name for the room' },
          },
        },
        RoomListResponse: {
          type: 'object',
          properties: {
            rooms: { type: 'array', items: { $ref: '#/components/schemas/Room' } },
            pagination: {
              type: 'object',
              properties: {
                page:       { type: 'integer', example: 1 },
                limit:      { type: 'integer', example: 20 },
                total:      { type: 'integer', example: 42 },
                totalPages: { type: 'integer', example: 3 },
              },
            },
          },
        },
        TossRequest: {
          type: 'object',
          required: ['callerSlotId', 'call', 'winnerSlotId', 'choice'],
          properties: {
            callerSlotId: { type: 'string', description: 'Player slot _id of the person calling heads/tails' },
            call:         { type: 'string', enum: ['heads', 'tails'], description: 'The call made by the caller' },
            winnerSlotId: { type: 'string', description: 'Player slot _id of the toss winner' },
            choice:       { type: 'string', description: 'Winner\'s choice from the sport\'s tossOptions (e.g. bat, bowl, serve)' },
          },
        },
        StartMatchRequest: {
          type: 'object',
          required: ['assignments'],
          properties: {
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                required: ['slotId', 'team'],
                properties: {
                  slotId: { type: 'string', description: 'Player slot _id' },
                  team:   { type: 'string', enum: ['A', 'B'], description: 'Team assignment' },
                  role:   { type: 'string', description: 'Optional role (e.g. batsman, bowler)' },
                },
              },
              description: 'Array of player-to-team assignments',
            },
          },
        },
        PlayerSlot: {
          type: 'object',
          properties: {
            _id:      { type: 'string', example: '664a3b4c2d1e3f0045678901' },
            userId:   { type: 'string', nullable: true, example: '664a1f3e2b5c1a0012345678', description: 'null for static players' },
            name:     { type: 'string', example: 'John Doe' },
            isStatic: { type: 'boolean', example: false },
            team:     { type: 'string', nullable: true, enum: ['A', 'B', null], example: 'A' },
            role:     { type: 'string', example: 'batsman' },
            isActive: { type: 'boolean', example: true },
          },
        },
        RoomToss: {
          type: 'object',
          properties: {
            coinResult:   { type: 'string', enum: ['heads', 'tails'], example: 'heads' },
            call:         { type: 'string', enum: ['heads', 'tails'], example: 'heads' },
            callerSlotId: { type: 'string', example: '664a3b4c2d1e3f0045678901' },
            winnerSlotId: { type: 'string', example: '664a3b4c2d1e3f0045678901' },
            choice:       { type: 'string', example: 'bat', description: 'Winner\'s choice from tossOptions' },
            completedAt:  { type: 'string', format: 'date-time' },
          },
        },
        Room: {
          type: 'object',
          properties: {
            _id:           { type: 'string', example: '664a4c5d3e2f4g0056789012' },
            sportTypeId:   { $ref: '#/components/schemas/SportType' },
            name:          { type: 'string', example: 'Friday T20 Match' },
            creator:       { $ref: '#/components/schemas/User' },
            status: {
              type: 'string',
              enum: ['waiting', 'toss_pending', 'active', 'completed', 'abandoned'],
              example: 'waiting',
            },
            players:    { type: 'array', items: { $ref: '#/components/schemas/PlayerSlot' } },
            toss:       { $ref: '#/components/schemas/RoomToss' },
            matchId:    { type: 'string', nullable: true, example: null },
            maxPlayers: { type: 'number', example: 22 },
            minPlayers: { type: 'number', example: 2 },
            createdAt:  { type: 'string', format: 'date-time' },
            updatedAt:  { type: 'string', format: 'date-time' },
          },
        },

        // ── Match ──────────────────────────────────────────────────────────
        CricketBall: {
          type: 'object',
          properties: {
            ballNumber: { type: 'number', example: 1 },
            batsmanId:  { type: 'string', example: '664a3b4c2d1e3f0045678901' },
            bowlerId:   { type: 'string', example: '664a3b4c2d1e3f0045678902' },
            runs:       { type: 'number', example: 4 },
            isLegal:    { type: 'boolean', example: true },
            extras: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['wide', 'noball', 'bye', 'legbye'], example: 'wide' },
                runs: { type: 'number', example: 1 },
              },
            },
            wicket: {
              type: 'object',
              properties: {
                type:      { type: 'string', enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'other'] },
                fielderId: { type: 'string', example: '664a3b4c2d1e3f0045678903', description: 'Fielder who took catch/run-out (optional)' },
              },
            },
          },
        },
        RecordBallRequest: {
          type: 'object',
          required: ['batsmanId', 'bowlerId'],
          properties: {
            batsmanId: { type: 'string', description: 'Player slot _id of the batsman on strike' },
            bowlerId:  { type: 'string', description: 'Player slot _id of the bowler' },
            runs:      { type: 'number', example: 0, description: 'Runs scored off the bat (excludes extras)' },
            isLegal:   { type: 'boolean', example: true, description: 'false for wide/no-ball' },
            extras: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['wide', 'noball', 'bye', 'legbye'] },
                runs: { type: 'number', example: 1 },
              },
            },
            wicket: {
              type: 'object',
              properties: {
                type:      { type: 'string', enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'other'] },
                fielderId: { type: 'string' },
              },
            },
          },
        },
        MatchResult: {
          type: 'object',
          properties: {
            winner:      { type: 'string', enum: ['A', 'B', 'draw', 'no_result'], example: 'A' },
            margin:      { type: 'string', example: '5 wickets' },
            description: { type: 'string', example: 'Team A wins by 5 wickets' },
            completedAt: { type: 'string', format: 'date-time' },
          },
        },
        Match: {
          type: 'object',
          properties: {
            _id:           { type: 'string', example: '664a5d6e4f3g5h0067890123' },
            roomId:        { type: 'string', example: '664a4c5d3e2f4g0056789012' },
            sportTypeId:   { type: 'string', example: '664a2b3c1d0e2f0034567890' },
            sport: {
              type: 'string',
              enum: ['cricket', 'tennis', 'badminton', 'pickleball'],
              example: 'cricket',
            },
            teamA: {
              type: 'object',
              properties: {
                name:    { type: 'string', example: 'Team A' },
                players: { type: 'array', items: { type: 'string' }, description: 'Array of player slot _ids' },
                captain: { type: 'string', nullable: true },
              },
            },
            teamB: {
              type: 'object',
              properties: {
                name:    { type: 'string', example: 'Team B' },
                players: { type: 'array', items: { type: 'string' } },
                captain: { type: 'string', nullable: true },
              },
            },
            toss: {
              type: 'object',
              properties: {
                winnerTeam: { type: 'string', enum: ['A', 'B', null], example: 'A' },
                choice:     { type: 'string', example: 'bat' },
              },
            },
            status: {
              type: 'string',
              enum: ['not_started', 'active', 'innings_break', 'set_break', 'completed', 'abandoned'],
              example: 'active',
            },
            currentInnings: { type: 'number', example: 1, description: 'Cricket: current innings index' },
            currentSet:     { type: 'number', example: 1, description: 'Racket: current set index' },
            currentGame:    { type: 'number', example: 1, description: 'Racket: current game index within set' },
            setsWonA:       { type: 'number', example: 1 },
            setsWonB:       { type: 'number', example: 0 },
            result:         { $ref: '#/components/schemas/MatchResult' },
            config:         { $ref: '#/components/schemas/SportConfig' },
            createdAt:      { type: 'string', format: 'date-time' },
            updatedAt:      { type: 'string', format: 'date-time' },
          },
        },
      },

      // ── Reusable responses ────────────────────────────────────────────────
      responses: {
        Unauthorized: {
          description: 'Missing or invalid JWT token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { message: 'Unauthorized — no token provided' },
            },
          },
        },
        Forbidden: {
          description: 'Admin access required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { message: 'Forbidden — admin access required' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { message: 'Sport profile not found' },
            },
          },
        },
        BadRequest: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: { message: 'sport is required' },
            },
          },
        },
      },
    },
  },
  // Scan all route files for @swagger JSDoc comments
  apis: ['./src/modules/**/*.routes.js'],
};

module.exports = swaggerJsdoc(options);
