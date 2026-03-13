const Match     = require('./match.model');
const Room      = require('../room/room.model');
const SportType = require('../sportType/sportType.model');
const { fail }  = require('../../utils/AppError');
const ws        = require('../../websocket');
const {
  generateBallCommentary,
  generateOverSummary,
  generateInningsEnd,
  generateMatchEnd,
  generateMilestone,
  generateBowlingMilestone,
  generatePointCommentary,
} = require('../../utils/commentary');

const MAX_COMMENTARY = 50; // keep last N entries on the match document

const pushCommentary = (match, entry, extra = {}) => {
  if (!match.commentary) match.commentary = [];
  match.commentary.push({ ...entry, timestamp: new Date(), ...extra });
  // Trim to last MAX_COMMENTARY entries
  if (match.commentary.length > MAX_COMMENTARY) {
    match.commentary = match.commentary.slice(-MAX_COMMENTARY);
  }
};

/** Build slotId → name map from room players */
const buildNameMap = (room) => {
  const map = {};
  for (const p of room.players) {
    map[p._id.toString()] = p.name;
  }
  return map;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const getMatchAndRoom = async (matchId) => {
  const match = await Match.findById(matchId);
  if (!match) fail('Match not found', 404);
  const room = await Room.findById(match.roomId);
  if (!room) fail('Associated room not found', 404);
  return { match, room };
};

const assertCreator = (room, userId) => {
  if (room.creator.toString() !== userId.toString()) {
    fail('Only the room creator can perform this action', 403);
  }
};

const assertMatchStatus = (match, ...statuses) => {
  if (!statuses.includes(match.status)) {
    fail(`Action not allowed when match status is: ${match.status}`, 400);
  }
};

// Derive which team won the toss
const getTossWinnerTeam = (room) => {
  if (!room.toss) return null;
  return room.toss.winnerTeam || null;
};

// ── Match initialization ──────────────────────────────────────────────────────

/**
 * Initialize the match document when a room becomes active.
 * Called by room.service after assignTeamsAndStart.
 */
const initMatch = async (roomId) => {
  const existing = await Match.findOne({ roomId });
  if (existing) return existing;

  const room = await Room.findById(roomId);
  if (!room) fail('Room not found', 404);

  const sportType = await SportType.findById(room.sportTypeId);

  const teamASlots = room.players.filter((p) => p.team === 'A' && p.isActive).map((p) => p._id);
  const teamBSlots = room.players.filter((p) => p.team === 'B' && p.isActive).map((p) => p._id);

  const tossWinnerTeam = getTossWinnerTeam(room);

  // Apply room-level overrides for team names, captains, overs
  const configSnapshot = { ...sportType.config.toObject ? sportType.config.toObject() : sportType.config };
  if (room.oversPerInnings != null) {
    configSnapshot.oversPerInnings = room.oversPerInnings;
  }

  const matchData = {
    roomId,
    sportTypeId: room.sportTypeId,
    sport: sportType.sport,
    status: 'active',
    teamA: {
      name: room.teamAName || 'Team A',
      players: teamASlots,
      captain: room.captainA || null,
    },
    teamB: {
      name: room.teamBName || 'Team B',
      players: teamBSlots,
      captain: room.captainB || null,
    },
    toss: { winnerTeam: tossWinnerTeam, choice: room.toss ? room.toss.choice : null },
    matchType: room.matchType || 'local',
    config: configSnapshot,
  };

  // Pre-build cricket innings structure
  if (sportType.sport === 'cricket') {
    const innings = [];
    const numInnings = configSnapshot.innings || 2;

    // Determine batting order: toss winner's choice drives who bats first
    let firstBat = 'A';
    if (tossWinnerTeam && room.toss) {
      if (room.toss.choice === 'bat') firstBat = tossWinnerTeam;
      else if (room.toss.choice === 'bowl') firstBat = tossWinnerTeam === 'A' ? 'B' : 'A';
    }

    for (let i = 1; i <= numInnings; i++) {
      innings.push({
        number: i,
        battingTeam: i % 2 === 1 ? firstBat : (firstBat === 'A' ? 'B' : 'A'),
        bowlingTeam: i % 2 === 1 ? (firstBat === 'A' ? 'B' : 'A') : firstBat,
        overs: [],
      });
    }
    matchData.innings = innings;
  }

  // Pre-build racket sport set structure
  if (['tennis', 'badminton', 'pickleball'].includes(sportType.sport)) {
    const numSets = sportType.config.sets || sportType.config.gamesPerMatch || 1;
    const sets = [];
    for (let s = 1; s <= numSets; s++) {
      const numGames = sportType.config.gamesPerSet || 1;
      const games = [];
      for (let g = 1; g <= numGames; g++) {
        games.push({ gameNumber: g });
      }
      sets.push({ setNumber: s, games });
    }
    matchData.sets = sets;
  }

  return Match.create(matchData);
};

const getMatch = async (matchId) => {
  const match = await Match.findById(matchId);
  if (!match) fail('Match not found', 404);
  return match;
};

const getMatchByRoom = async (roomId) => {
  const match = await Match.findOne({ roomId });
  if (!match) fail('Match not found for this room', 404);
  return match;
};

// ── Match state transitions ───────────────────────────────────────────────────

const startMatch = async (matchId, userId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'not_started');

  match.status = 'active';
  await match.save();
  ws.emitMatchStarted(match.roomId, match);
  return match;
};

const completeMatch = async (matchId, userId, { winner, margin, description }) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'active', 'innings_break', 'set_break');

  if (!winner || !['A', 'B', 'draw', 'no_result'].includes(winner)) {
    fail('winner must be A, B, draw, or no_result', 400);
  }

  match.status = 'completed';
  match.result = { winner, margin, description, completedAt: new Date() };

  // Sync room status
  room.status = 'completed';
  await Promise.all([match.save(), room.save()]);
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

const abandonMatch = async (matchId, userId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);

  match.status = 'abandoned';
  match.result = { winner: 'no_result', completedAt: new Date() };
  room.status   = 'abandoned';
  await Promise.all([match.save(), room.save()]);
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

/** Admin/SuperAdmin abandon — no creator check */
const adminAbandonMatch = async (matchId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  if (['completed', 'abandoned'].includes(match.status)) {
    fail(`Match is already ${match.status}`, 400);
  }
  match.status = 'abandoned';
  match.result = { winner: 'no_result', completedAt: new Date() };
  room.status   = 'abandoned';
  await Promise.all([match.save(), room.save()]);
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

/** Auto-abandon matches created more than 18 hours ago that are still active */
const autoAbandonStaleMatches = async () => {
  const cutoff = new Date(Date.now() - 18 * 60 * 60 * 1000); // 18 hours ago
  const staleMatches = await Match.find({
    status: { $nin: ['completed', 'abandoned'] },
    createdAt: { $lt: cutoff },
  });

  let count = 0;
  for (const match of staleMatches) {
    match.status = 'abandoned';
    match.result = { winner: 'no_result', completedAt: new Date() };
    await match.save();

    // Also abandon the room
    const room = await Room.findById(match.roomId);
    if (room && !['completed', 'abandoned'].includes(room.status)) {
      room.status = 'abandoned';
      await room.save();
    }

    ws.emitScoreUpdate(match.roomId, match);
    count++;
  }

  if (count > 0) {
    console.log(`[AUTO-ABANDON] Abandoned ${count} stale match(es) older than 18 hours`);
  }
  return count;
};

// ── Cricket scoring ───────────────────────────────────────────────────────────

/**
 * Set batting lineup for the current innings.
 * { lineup: [slotId, slotId, ...] } (order = batting order)
 */
const setBattingLineup = async (matchId, userId, { inningsNum, lineup, strikerId, nonStrikerId, bowlerId }) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'active', 'innings_break');

  const idx = (inningsNum || match.currentInnings) - 1;
  const innings = match.innings[idx];
  if (!innings) fail('Innings not found', 404);

  if (strikerId)    innings.currentBatsmen.striker    = strikerId;
  if (nonStrikerId) innings.currentBatsmen.nonStriker = nonStrikerId;
  if (bowlerId)     innings.currentBowler             = bowlerId;

  match.markModified('innings');
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

/**
 * Record a delivery in cricket.
 * ballData = { batsmanId, bowlerId, runs, extras: { type, runs }, wicket: { type, fielderId }, isLegal }
 */
const recordBall = async (matchId, userId, ballData) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'active');

  const inningsIdx = match.currentInnings - 1;
  const innings = match.innings[inningsIdx];
  if (!innings || innings.status === 'completed') fail('Innings not active', 400);

  // Validate batsman belongs to batting team and bowler to bowling team
  const battingPlayers  = innings.battingTeam === 'A' ? match.teamA.players : match.teamB.players;
  const bowlingPlayers  = innings.battingTeam === 'A' ? match.teamB.players : match.teamA.players;

  if (ballData.batsmanId && !battingPlayers.some((p) => p.toString() === ballData.batsmanId.toString())) {
    fail('Batsman does not belong to the batting team', 400);
  }
  if (ballData.bowlerId && !bowlingPlayers.some((p) => p.toString() === ballData.bowlerId.toString())) {
    fail('Bowler does not belong to the bowling team', 400);
  }

  const maxOvers  = match.config.oversPerInnings;
  const maxWickets = match.teamA.players.length - 1; // all out = n-1

  // Find or create current over
  let currentOver = innings.overs.find((o) => !o.isComplete);
  if (!currentOver) {
    const overNum = innings.overs.length + 1;
    if (overNum > maxOvers) fail('All overs bowled', 400);
    innings.overs.push({ overNumber: overNum, bowlerId: ballData.bowlerId, balls: [] });
    currentOver = innings.overs[innings.overs.length - 1];
  }

  const ball = {
    ballNumber: currentOver.balls.length + 1,
    batsmanId:  ballData.batsmanId,
    bowlerId:   ballData.bowlerId || currentOver.bowlerId,
    runs:       ballData.runs || 0,
    isLegal:    ballData.isLegal !== false,
    extras:     ballData.extras || {},
    wicket:     ballData.wicket || {},
  };
  currentOver.balls.push(ball);

  // Update over totals
  currentOver.runs += ball.runs + (ball.extras.runs || 0);
  if (ball.wicket && ball.wicket.type) currentOver.wickets += 1;

  // Update innings totals
  innings.totalRuns    += ball.runs + (ball.extras.runs || 0);
  if (ball.wicket && ball.wicket.type) innings.totalWickets += 1;

  // Track extras
  if (ball.extras && ball.extras.type) {
    const eType = ball.extras.type;
    if (['wide', 'noball', 'bye', 'legbye'].includes(eType)) {
      innings.extras[eType] = (innings.extras[eType] || 0) + (ball.extras.runs || 0);
    }
  }

  // Over complete after 6 legal balls
  const legalBalls = currentOver.balls.filter((b) => b.isLegal).length;
  if (legalBalls >= 6) {
    currentOver.isComplete = true;
    innings.completedOvers += 1;
  }

  // ── Generate ball commentary ────────────────────────────────────────────
  const nameMap = buildNameMap(room);
  const batsmanName = nameMap[ball.batsmanId?.toString()] || 'Batsman';
  const bowlerName  = nameMap[ball.bowlerId?.toString()] || 'Bowler';
  const fielderName = ball.wicket?.fielderId ? (nameMap[ball.wicket.fielderId.toString()] || 'Fielder') : 'Fielder';

  const ballComm = generateBallCommentary(ball, {
    batsmanName,
    bowlerName,
    fielderName,
    score: innings.totalRuns - (ball.runs || 0) - (ball.extras?.runs || 0), // score before this ball
    wickets: innings.totalWickets - (ball.wicket?.type ? 1 : 0),
    overNumber: currentOver.overNumber,
    ballInOver: legalBalls,
    inningsNum: innings.number,
  });
  pushCommentary(match, ballComm, {
    inningsNumber: innings.number,
    overNumber: currentOver.overNumber,
    ballNumber: legalBalls,
  });

  // Check batting milestones (accumulate batsman runs this innings)
  let batsmanInningsRuns = 0;
  for (const ov of innings.overs) {
    for (const b of ov.balls) {
      if (b.batsmanId?.toString() === ball.batsmanId?.toString()) {
        batsmanInningsRuns += b.runs || 0;
      }
    }
  }
  const prevRuns = batsmanInningsRuns - (ball.runs || 0);
  if (prevRuns < 50 && batsmanInningsRuns >= 50) {
    const m = generateMilestone(batsmanName, 50);
    if (m) pushCommentary(match, m, { inningsNumber: innings.number });
  }
  if (prevRuns < 100 && batsmanInningsRuns >= 100) {
    const m = generateMilestone(batsmanName, 100);
    if (m) pushCommentary(match, m, { inningsNumber: innings.number });
  }

  // Check bowling milestones (accumulate bowler wickets this innings)
  if (ball.wicket?.type) {
    let bowlerInningsWickets = 0;
    for (const ov of innings.overs) {
      for (const b of ov.balls) {
        if (b.bowlerId?.toString() === ball.bowlerId?.toString() && b.wicket?.type) {
          bowlerInningsWickets += 1;
        }
      }
    }
    const bm = generateBowlingMilestone(bowlerName, bowlerInningsWickets);
    if (bm) pushCommentary(match, bm, { inningsNumber: innings.number });
  }

  // Over-end commentary
  if (currentOver.isComplete) {
    const overComm = generateOverSummary({
      overNumber: currentOver.overNumber,
      score: innings.totalRuns,
      wickets: innings.totalWickets,
      overRuns: currentOver.runs,
      battingTeamName: 'Team ' + innings.battingTeam,
    });
    pushCommentary(match, overComm, { inningsNumber: innings.number, overNumber: currentOver.overNumber });
  }

  // Check innings end conditions
  const battingTeamSlots = innings.battingTeam === 'A' ? match.teamA.players : match.teamB.players;
  const allOut = innings.totalWickets >= battingTeamSlots.length - 1;
  const oversUp = innings.completedOvers >= maxOvers;

  if (allOut || oversUp) {
    innings.status = 'completed';

    // Innings-end commentary
    pushCommentary(match, generateInningsEnd({
      battingTeam: innings.battingTeam,
      score: innings.totalRuns,
      wickets: innings.totalWickets,
      overs: innings.completedOvers,
    }), { inningsNumber: innings.number });

    // Move to next innings or complete match
    if (match.currentInnings < match.innings.length) {
      match.currentInnings += 1;
      match.status = 'innings_break';
    } else {
      // All innings done — auto-complete match
      const scoreA = match.innings.filter((i) => i.battingTeam === 'A').reduce((s, i) => s + i.totalRuns, 0);
      const scoreB = match.innings.filter((i) => i.battingTeam === 'B').reduce((s, i) => s + i.totalRuns, 0);
      match.status = 'completed';

      let margin = 'Tie';
      if (scoreA !== scoreB) {
        const winner = scoreA > scoreB ? 'A' : 'B';
        // Chasing team (last innings) wins by wickets remaining; first team wins by runs
        if (innings.battingTeam === winner) {
          const wicketsLeft = battingTeamSlots.length - 1 - innings.totalWickets;
          margin = `${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
        } else {
          margin = `${Math.abs(scoreA - scoreB)} run${Math.abs(scoreA - scoreB) !== 1 ? 's' : ''}`;
        }
      }

      match.result = {
        winner: scoreA > scoreB ? 'A' : scoreB > scoreA ? 'B' : 'draw',
        margin,
        completedAt: new Date(),
      };

      // Match-end commentary
      pushCommentary(match, generateMatchEnd(match.result));

      room.status = 'completed';
      await room.save();
    }
  }

  match.markModified('innings');
  match.markModified('commentary');
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

const resumeInnings = async (matchId, userId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'innings_break');

  match.status = 'active';
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

// ── Racket sport scoring (Tennis / Badminton / Pickleball) ────────────────────

/**
 * Record a point.
 * { team: 'A'|'B', setNumber?, gameNumber? }
 */
const recordPoint = async (matchId, userId, { team }) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'active');

  if (!['A', 'B'].includes(team)) fail('team must be A or B', 400);

  const sportType = await SportType.findById(match.sportTypeId);
  const cfg = sportType.config;

  const setIdx  = match.currentSet - 1;
  const gameIdx = match.currentGame - 1;
  const set  = match.sets[setIdx];
  if (!set || set.isComplete) fail('Set already completed', 400);

  const game = set.games[gameIdx];
  if (!game || game.isComplete) fail('Game already completed', 400);

  // Increment point
  if (team === 'A') game.pointsA += 1;
  else game.pointsB += 1;

  const pA = game.pointsA;
  const pB = game.pointsB;

  // ── Determine game winner ─────────────────────────────────────────────────
  const pointsToWin = cfg.pointsToWin || cfg.pointsPerGame || 11;
  const winByTwo    = cfg.winByTwo !== false;

  const gameWon =
    (pA >= pointsToWin && (!winByTwo || pA - pB >= 2)) ||
    (pB >= pointsToWin && (!winByTwo || pB - pA >= 2));

  if (gameWon) {
    game.winner     = pA > pB ? 'A' : 'B';
    game.isComplete = true;

    if (game.winner === 'A') set.gamesA += 1;
    else set.gamesB += 1;

    // ── Determine set winner ────────────────────────────────────────────────
    const gA = set.gamesA;
    const gB = set.gamesB;
    const gamesPerSet = cfg.gamesPerSet || 1;

    const setWon =
      (gA >= gamesPerSet && (!cfg.deuceEnabled || gA - gB >= 2)) ||
      (gB >= gamesPerSet && (!cfg.deuceEnabled || gB - gA >= 2));

    if (setWon) {
      set.winner     = gA > gB ? 'A' : 'B';
      set.isComplete = true;

      if (set.winner === 'A') match.setsWonA += 1;
      else match.setsWonB += 1;

      const totalSets  = match.sets.length;
      const setsToWin  = Math.ceil(totalSets / 2);

      if (match.setsWonA >= setsToWin || match.setsWonB >= setsToWin) {
        // Match over
        match.status = 'completed';
        const w = match.setsWonA >= setsToWin ? 'A' : 'B';
        match.result = {
          winner: w,
          margin: `${match.setsWonA}-${match.setsWonB} sets`,
          completedAt: new Date(),
        };
        room.status = 'completed';
        await room.save();
      } else {
        // Move to next set
        match.currentSet  += 1;
        match.currentGame  = 1;
        match.status = 'set_break';
      }
    } else {
      // Next game in same set
      match.currentGame += 1;
    }
  }

  // ── Generate racket commentary ──────────────────────────────────────────
  const commEntries = generatePointCommentary({
    team,
    pointsA: game.pointsA,
    pointsB: game.pointsB,
    gameWinner: game.isComplete ? game.winner : null,
    gameScoreA: game.pointsA,
    gameScoreB: game.pointsB,
    setWinner: set.isComplete ? set.winner : null,
    setGamesA: set.gamesA,
    setGamesB: set.gamesB,
    matchWinner: match.status === 'completed' ? match.result.winner : null,
    setsWonA: match.setsWonA,
    setsWonB: match.setsWonB,
  });

  for (const entry of commEntries) {
    pushCommentary(match, entry);
  }

  match.markModified('sets');
  match.markModified('commentary');
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

const resumeSet = async (matchId, userId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'set_break');

  match.status = 'active';
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

module.exports = {
  initMatch,
  getMatch,
  getMatchByRoom,
  startMatch,
  completeMatch,
  abandonMatch,
  adminAbandonMatch,
  autoAbandonStaleMatches,
  setBattingLineup,
  recordBall,
  resumeInnings,
  recordPoint,
  resumeSet,
};
