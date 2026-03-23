const Match     = require('./match.model');
const Room      = require('../room/room.model');
const SportType = require('../sportType/sportType.model');
const { fail }  = require('../../utils/AppError');
const ws        = require('../../websocket');
const { invalidate } = require('../../config/cache');
const { notifyMatchCompleted } = require('../notification/notification.service');
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
const MAX_UNDO_STACK = 5;  // keep last N ball snapshots for undo

/** Extract real user IDs from room players and fire match-completed notifications. */
const fireMatchCompletedNotifications = async (match, room) => {
  try {
    const playerUserIds = (room.players || [])
      .filter((p) => p.userId && !p.isStatic)
      .map((p) => p.userId.toString());
    if (playerUserIds.length > 0) {
      await notifyMatchCompleted(match, playerUserIds);
    }
  } catch {
    // Notifications are best-effort — don't block the match flow
  }
};

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
  invalidate('short', 'analytics:');
  invalidate('medium', 'analytics:');
  invalidate('medium', 'lb:');
  fireMatchCompletedNotifications(match, room);
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
  invalidate('short', 'analytics:');
  invalidate('medium', 'analytics:');
  invalidate('medium', 'lb:');
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

  // ── Snapshot for undo ─────────────────────────────────────────────────────
  const currentOverIdx = innings.overs.findIndex((o) => !o.isComplete);
  if (!match.undoStack) match.undoStack = [];
  match.undoStack.push({
    inningsIdx,
    overIndex: currentOverIdx >= 0 ? currentOverIdx : innings.overs.length, // next over index if none open
    overSnapshot: currentOverIdx >= 0 ? JSON.parse(JSON.stringify(innings.overs[currentOverIdx])) : null,
    inningsTotals: {
      totalRuns: innings.totalRuns,
      totalWickets: innings.totalWickets,
      completedOvers: innings.completedOvers,
      extras: { ...innings.extras.toObject ? innings.extras.toObject() : innings.extras },
      status: innings.status,
    },
    commentaryLength: (match.commentary || []).length,
    matchStatus: match.status,
    currentInnings: match.currentInnings,
    roomStatus: room.status,
  });
  if (match.undoStack.length > MAX_UNDO_STACK) {
    match.undoStack = match.undoStack.slice(-MAX_UNDO_STACK);
  }

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
      // All innings done — auto-complete match or trigger super over
      const scoreA = match.innings.filter((i) => i.battingTeam === 'A').reduce((s, i) => s + i.totalRuns, 0);
      const scoreB = match.innings.filter((i) => i.battingTeam === 'B').reduce((s, i) => s + i.totalRuns, 0);

      if (scoreA === scoreB) {
        // TIE — trigger super over
        match.status = 'super_over';
        match.superOver = initSuperOverData(match);
        pushCommentary(match, { text: 'Scores level! Match heads to a Super Over!', type: 'milestone' });
      } else {
        match.status = 'completed';

        const winner = scoreA > scoreB ? 'A' : 'B';
        let margin;
        if (innings.battingTeam === winner) {
          const wicketsLeft = battingTeamSlots.length - 1 - innings.totalWickets;
          margin = `${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}`;
        } else {
          margin = `${Math.abs(scoreA - scoreB)} run${Math.abs(scoreA - scoreB) !== 1 ? 's' : ''}`;
        }

        match.result = { winner, margin, completedAt: new Date() };
        pushCommentary(match, generateMatchEnd(match.result));

        room.status = 'completed';
        await room.save();
        fireMatchCompletedNotifications(match, room);
      }
    }
  }

  match.markModified('innings');
  match.markModified('commentary');
  match.markModified('undoStack');
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

// ── Undo last ball (cricket) ────────────────────────────────────────────────

const undoLastBall = async (matchId, userId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);

  if (match.sport !== 'cricket') fail('Undo is only available for cricket matches', 400);
  if (!match.undoStack || match.undoStack.length === 0) fail('Nothing to undo', 400);

  const snapshot = match.undoStack.pop();

  // Restore match-level state
  match.status = snapshot.matchStatus;
  match.currentInnings = snapshot.currentInnings;

  // Restore room status (e.g., if match was auto-completed)
  if (room.status !== snapshot.roomStatus) {
    room.status = snapshot.roomStatus;
    await room.save();
  }

  // Restore innings
  const innings = match.innings[snapshot.inningsIdx];
  innings.totalRuns = snapshot.inningsTotals.totalRuns;
  innings.totalWickets = snapshot.inningsTotals.totalWickets;
  innings.completedOvers = snapshot.inningsTotals.completedOvers;
  innings.extras = snapshot.inningsTotals.extras;
  innings.status = snapshot.inningsTotals.status;

  // Restore or remove the over
  if (snapshot.overSnapshot) {
    // Over existed before — restore it
    innings.overs[snapshot.overIndex] = snapshot.overSnapshot;
  } else {
    // Over was created during the ball — remove it
    innings.overs.splice(snapshot.overIndex, 1);
  }

  // Trim commentary back
  if (match.commentary && typeof snapshot.commentaryLength === 'number') {
    match.commentary = match.commentary.slice(0, snapshot.commentaryLength);
  }

  // Clear result if match was completed
  if (snapshot.matchStatus !== 'completed' && match.result && match.result.completedAt) {
    match.result = { winner: null, margin: undefined, description: undefined, completedAt: undefined };
  }

  match.markModified('innings');
  match.markModified('commentary');
  match.markModified('undoStack');
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

// ── Super Over (cricket tie-breaker) ─────────────────────────────────────────

/** Build super over innings data — 2 innings of 1 over each */
const initSuperOverData = (match) => {
  // Same batting order as regular match: team that batted 2nd in main match bats first in super over
  const lastInnings = match.innings[match.innings.length - 1];
  const firstBat = lastInnings.battingTeam; // chasing team bats first in super over

  return {
    innings: [
      { number: 1, battingTeam: firstBat, bowlingTeam: firstBat === 'A' ? 'B' : 'A', overs: [] },
      { number: 2, battingTeam: firstBat === 'A' ? 'B' : 'A', bowlingTeam: firstBat, overs: [] },
    ],
    currentInnings: 1,
    result: {},
  };
};

/**
 * Record a ball in the super over.
 * Super over rules: 1 over per innings, 1 wicket = all out (only 2 batsmen).
 */
const recordSuperOverBall = async (matchId, userId, ballData) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  if (match.sport !== 'cricket') fail('Super over is only available for cricket', 400);
  assertMatchStatus(match, 'super_over');

  if (!match.superOver || !match.superOver.innings) fail('Super over not initialized', 400);

  const inningsIdx = match.superOver.currentInnings - 1;
  const innings = match.superOver.innings[inningsIdx];
  if (!innings || innings.status === 'completed') fail('Super over innings not active', 400);

  const nameMap = buildNameMap(room);

  // Find or create the single over
  let currentOver = innings.overs[0];
  if (!currentOver) {
    innings.overs.push({ overNumber: 1, bowlerId: ballData.bowlerId, balls: [] });
    currentOver = innings.overs[0];
  }

  const ball = {
    ballNumber: currentOver.balls.length + 1,
    batsmanId: ballData.batsmanId,
    bowlerId: ballData.bowlerId || currentOver.bowlerId,
    runs: ballData.runs || 0,
    isLegal: ballData.isLegal !== false,
    extras: ballData.extras || {},
    wicket: ballData.wicket || {},
  };
  currentOver.balls.push(ball);

  // Update totals
  const totalBallRuns = ball.runs + (ball.extras.runs || 0);
  currentOver.runs += totalBallRuns;
  if (ball.wicket && ball.wicket.type) currentOver.wickets += 1;

  innings.totalRuns += totalBallRuns;
  if (ball.wicket && ball.wicket.type) innings.totalWickets += 1;

  if (ball.extras && ball.extras.type) {
    const eType = ball.extras.type;
    if (['wide', 'noball', 'bye', 'legbye'].includes(eType)) {
      innings.extras[eType] = (innings.extras[eType] || 0) + (ball.extras.runs || 0);
    }
  }

  // Commentary
  const batsmanName = nameMap[ball.batsmanId?.toString()] || 'Batsman';
  const bowlerName = nameMap[ball.bowlerId?.toString()] || 'Bowler';
  const fielderName = ball.wicket?.fielderId ? (nameMap[ball.wicket.fielderId.toString()] || 'Fielder') : 'Fielder';
  const legalBalls = currentOver.balls.filter((b) => b.isLegal).length;

  const ballComm = generateBallCommentary(ball, {
    batsmanName, bowlerName, fielderName,
    score: innings.totalRuns - totalBallRuns,
    wickets: innings.totalWickets - (ball.wicket?.type ? 1 : 0),
    overNumber: 1,
    ballInOver: legalBalls,
    inningsNum: `SO-${innings.number}`,
  });
  pushCommentary(match, { ...ballComm, text: `[Super Over] ${ballComm.text}` });

  // Super over innings end: 6 legal balls OR wicket (only 2 batsmen, 1 wicket = all out)
  const isAllOut = innings.totalWickets >= 1;
  const isOverComplete = legalBalls >= 6;

  if (isAllOut || isOverComplete) {
    currentOver.isComplete = true;
    innings.completedOvers = 1;
    innings.status = 'completed';

    if (match.superOver.currentInnings < 2) {
      // Move to 2nd super over innings
      match.superOver.currentInnings = 2;
      pushCommentary(match, {
        text: `[Super Over] Innings 1 complete: ${innings.totalRuns} runs. Team ${match.superOver.innings[1].battingTeam} needs ${innings.totalRuns + 1} to win.`,
        type: 'innings_end',
      });
    } else {
      // Super over complete — determine winner
      const soScoreA = match.superOver.innings.filter((i) => i.battingTeam === 'A').reduce((s, i) => s + i.totalRuns, 0);
      const soScoreB = match.superOver.innings.filter((i) => i.battingTeam === 'B').reduce((s, i) => s + i.totalRuns, 0);

      if (soScoreA !== soScoreB) {
        const winner = soScoreA > soScoreB ? 'A' : 'B';
        match.superOver.result = { winner, margin: `Super Over (${soScoreA}-${soScoreB})`, completedAt: new Date() };
        match.status = 'completed';
        match.result = { winner, margin: `Super Over (${soScoreA}-${soScoreB})`, completedAt: new Date() };

        pushCommentary(match, generateMatchEnd(match.result));
        room.status = 'completed';
        await room.save();
        fireMatchCompletedNotifications(match, room);
      } else {
        // Another tie in super over — extremely rare, declare draw
        match.status = 'completed';
        match.result = { winner: 'draw', margin: 'Super Over tied', completedAt: new Date() };
        match.superOver.result = { winner: 'draw', margin: 'Super Over tied', completedAt: new Date() };

        pushCommentary(match, generateMatchEnd(match.result));
        room.status = 'completed';
        await room.save();
        fireMatchCompletedNotifications(match, room);
      }
    }
  }

  // Check if chasing team passes target mid-over (2nd innings)
  if (inningsIdx === 1 && innings.status !== 'completed') {
    const firstInningsRuns = match.superOver.innings[0].totalRuns;
    if (innings.totalRuns > firstInningsRuns) {
      currentOver.isComplete = true;
      innings.completedOvers = 1;
      innings.status = 'completed';

      const winner = innings.battingTeam;
      match.superOver.result = { winner, margin: `Super Over`, completedAt: new Date() };
      match.status = 'completed';
      match.result = { winner, margin: `Super Over`, completedAt: new Date() };

      pushCommentary(match, generateMatchEnd(match.result));
      room.status = 'completed';
      await room.save();
      fireMatchCompletedNotifications(match, room);
    }
  }

  match.markModified('superOver');
  match.markModified('commentary');
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

/** Set lineup for super over innings */
const setSuperOverLineup = async (matchId, userId, { strikerId, nonStrikerId, bowlerId }) => {
  const { match, room } = await getMatchAndRoom(matchId);
  assertCreator(room, userId);
  assertMatchStatus(match, 'super_over');

  if (!match.superOver) fail('Super over not initialized', 400);
  const idx = match.superOver.currentInnings - 1;
  const innings = match.superOver.innings[idx];
  if (!innings) fail('Super over innings not found', 404);

  if (strikerId)    innings.currentBatsmen.striker    = strikerId;
  if (nonStrikerId) innings.currentBatsmen.nonStriker = nonStrikerId;
  if (bowlerId)     innings.currentBowler             = bowlerId;

  match.markModified('superOver');
  await match.save();
  ws.emitScoreUpdate(match.roomId, match);
  return match;
};

// ── Cricket analytics (derived from ball data) ──────────────────────────────

const getPartnerships = async (matchId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  if (match.sport !== 'cricket') fail('Partnerships are only available for cricket', 400);

  const nameMap = buildNameMap(room);
  const result = [];

  for (const innings of match.innings) {
    const partnerships = [];
    let currentPair = { batsmen: new Set(), runs: 0, balls: 0, batsmanRuns: {} };
    let runningScore = 0;

    for (const over of innings.overs) {
      for (const ball of over.balls) {
        const batId = ball.batsmanId?.toString();
        if (!batId) continue;

        // Track batsmen in this partnership
        currentPair.batsmen.add(batId);
        const totalBallRuns = (ball.runs || 0) + (ball.extras?.runs || 0);
        currentPair.runs += totalBallRuns;
        if (ball.isLegal) currentPair.balls += 1;
        currentPair.batsmanRuns[batId] = (currentPair.batsmanRuns[batId] || 0) + (ball.runs || 0);
        runningScore += totalBallRuns;

        // Wicket breaks the partnership
        if (ball.wicket && ball.wicket.type) {
          const batsmenArr = Array.from(currentPair.batsmen).map((id) => ({
            slotId: id,
            name: nameMap[id] || 'Unknown',
            runs: currentPair.batsmanRuns[id] || 0,
          }));
          partnerships.push({
            batsmen: batsmenArr,
            totalRuns: currentPair.runs,
            totalBalls: currentPair.balls,
            runRate: currentPair.balls > 0 ? parseFloat(((currentPair.runs / currentPair.balls) * 6).toFixed(2)) : 0,
            endScore: runningScore,
          });
          currentPair = { batsmen: new Set(), runs: 0, balls: 0, batsmanRuns: {} };
        }
      }
    }

    // Last unbroken partnership
    if (currentPair.balls > 0) {
      const batsmenArr = Array.from(currentPair.batsmen).map((id) => ({
        slotId: id,
        name: nameMap[id] || 'Unknown',
        runs: currentPair.batsmanRuns[id] || 0,
      }));
      partnerships.push({
        batsmen: batsmenArr,
        totalRuns: currentPair.runs,
        totalBalls: currentPair.balls,
        runRate: currentPair.balls > 0 ? parseFloat(((currentPair.runs / currentPair.balls) * 6).toFixed(2)) : 0,
        endScore: runningScore,
        notOut: true,
      });
    }

    result.push({ inningsNumber: innings.number, battingTeam: innings.battingTeam, partnerships });
  }

  return { matchId: match._id, innings: result };
};

const getFallOfWickets = async (matchId) => {
  const { match, room } = await getMatchAndRoom(matchId);
  if (match.sport !== 'cricket') fail('Fall of wickets is only available for cricket', 400);

  const nameMap = buildNameMap(room);
  const result = [];

  for (const innings of match.innings) {
    const fallOfWickets = [];
    let runningScore = 0;
    let wicketNum = 0;

    for (const over of innings.overs) {
      let legalBallsInOver = 0;
      for (const ball of over.balls) {
        runningScore += (ball.runs || 0) + (ball.extras?.runs || 0);
        if (ball.isLegal) legalBallsInOver += 1;

        if (ball.wicket && ball.wicket.type) {
          wicketNum += 1;
          fallOfWickets.push({
            wicketNumber: wicketNum,
            score: runningScore,
            over: `${over.overNumber - 1}.${legalBallsInOver}`,
            batsmanSlotId: ball.batsmanId?.toString() || null,
            batsmanName: nameMap[ball.batsmanId?.toString()] || 'Unknown',
            dismissalType: ball.wicket.type,
            bowlerName: nameMap[ball.bowlerId?.toString()] || null,
          });
        }
      }
    }

    result.push({ inningsNumber: innings.number, battingTeam: innings.battingTeam, fallOfWickets });
  }

  return { matchId: match._id, innings: result };
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
        fireMatchCompletedNotifications(match, room);
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
  undoLastBall,
  recordSuperOverBall,
  setSuperOverLineup,
  getPartnerships,
  getFallOfWickets,
  resumeInnings,
  recordPoint,
  resumeSet,
};
