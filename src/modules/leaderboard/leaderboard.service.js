const Match = require('../match/match.model');
const User = require('../user/user.model');
const { fail } = require('../../utils/AppError');

// ─── Helpers ────────────────────────────────────────────────────────────────

const getPeriodFilter = (period) => {
  const now = new Date();
  switch (period) {
    case 'weekly': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { createdAt: { $gte: d } };
    }
    case 'monthly': {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 1);
      return { createdAt: { $gte: d } };
    }
    default:
      return {};
  }
};

/** Build slotId → { userId, name, team } from a room's players array */
const buildSlotMap = (players) => {
  const map = {};
  for (const slot of players) {
    map[slot._id.toString()] = {
      userId: slot.userId?.toString() || null,
      name: slot.name,
      team: slot.team,
    };
  }
  return map;
};

/** Enrich leaderboard entries with current user name, avatar, username */
const enrichWithUserData = async (entries) => {
  const userIds = entries.map((e) => e.userId).filter(Boolean);
  if (!userIds.length) return entries;

  const users = await User.find({ _id: { $in: userIds } }).select('name avatar username').lean();
  const userMap = {};
  for (const u of users) {
    userMap[u._id.toString()] = u;
  }

  for (const entry of entries) {
    const u = userMap[entry.userId];
    if (u) {
      entry.name = u.name || entry.name;
      entry.avatar = u.avatar || null;
      entry.username = u.username || null;
    }
  }
  return entries;
};

/** Load completed matches for a sport/period, with room populated */
const loadMatches = async (sport, period, extraFilter = {}) => {
  const periodFilter = getPeriodFilter(period);
  const filter = { status: 'completed', ...periodFilter, ...extraFilter };
  if (sport) filter.sport = sport;

  return Match.find(filter).populate('roomId').lean();
};

// ─── Cricket Batting Leaderboard ────────────────────────────────────────────

const getCricketBattingLeaderboard = async ({ period = 'alltime', limit = 20 } = {}) => {
  const matches = await loadMatches('cricket', period);
  const stats = {};

  for (const match of matches) {
    const room = match.roomId;
    if (!room) continue;

    const slotMap = buildSlotMap(room.players);
    const matchId = match._id.toString();

    // Track per-innings scores to compute highest score
    const inningsScores = {}; // { `${matchId}-${innNum}-${userId}`: runs }

    for (const inn of match.innings) {
      for (const over of inn.overs) {
        for (const ball of over.balls) {
          const info = slotMap[ball.batsmanId?.toString()];
          if (!info || !info.userId) continue;

          const uid = info.userId;
          if (!stats[uid]) {
            stats[uid] = {
              userId: uid,
              name: info.name,
              runs: 0,
              ballsFaced: 0,
              fours: 0,
              sixes: 0,
              highestScore: 0,
              _innings: new Set(),
              _matches: new Set(),
            };
          }

          const s = stats[uid];
          s.runs += ball.runs || 0;
          if (ball.isLegal) s.ballsFaced += 1;
          if (ball.runs === 4) s.fours += 1;
          if (ball.runs === 6) s.sixes += 1;
          s._innings.add(`${matchId}-${inn.number}`);
          s._matches.add(matchId);

          // Track per-innings score
          const innKey = `${matchId}-${inn.number}-${uid}`;
          inningsScores[innKey] = (inningsScores[innKey] || 0) + (ball.runs || 0);
        }
      }
    }

    // Update highest scores
    for (const [key, runs] of Object.entries(inningsScores)) {
      const uid = key.split('-').pop();
      if (stats[uid] && runs > stats[uid].highestScore) {
        stats[uid].highestScore = runs;
      }
    }
  }

  const leaderboard = Object.values(stats).map((s) => ({
    userId: s.userId,
    name: s.name,
    matches: s._matches.size,
    innings: s._innings.size,
    runs: s.runs,
    ballsFaced: s.ballsFaced,
    fours: s.fours,
    sixes: s.sixes,
    highestScore: s.highestScore,
    strikeRate: s.ballsFaced > 0 ? Number(((s.runs / s.ballsFaced) * 100).toFixed(2)) : 0,
    average: s._innings.size > 0 ? Number((s.runs / s._innings.size).toFixed(2)) : 0,
  }));

  leaderboard.sort((a, b) => b.runs - a.runs);
  return enrichWithUserData(leaderboard.slice(0, Number(limit)));
};

// ─── Cricket Bowling Leaderboard ────────────────────────────────────────────

const getCricketBowlingLeaderboard = async ({ period = 'alltime', limit = 20 } = {}) => {
  const matches = await loadMatches('cricket', period);
  const stats = {};

  for (const match of matches) {
    const room = match.roomId;
    if (!room) continue;

    const slotMap = buildSlotMap(room.players);
    const matchId = match._id.toString();

    // Track per-innings figures for best bowling
    const inningsFigures = {}; // { `${matchId}-${innNum}-${uid}`: { wickets, runs } }

    for (const inn of match.innings) {
      for (const over of inn.overs) {
        for (const ball of over.balls) {
          const info = slotMap[ball.bowlerId?.toString()];
          if (!info || !info.userId) continue;

          const uid = info.userId;
          if (!stats[uid]) {
            stats[uid] = {
              userId: uid,
              name: info.name,
              wickets: 0,
              runsConceded: 0,
              ballsBowled: 0,
              bestWickets: 0,
              bestRuns: 0,
              _matches: new Set(),
              _innings: new Set(),
            };
          }

          const s = stats[uid];
          const conceded = (ball.runs || 0) + (ball.extras?.runs || 0);
          s.runsConceded += conceded;
          if (ball.wicket?.type) s.wickets += 1;
          if (ball.isLegal) s.ballsBowled += 1;
          s._matches.add(matchId);
          s._innings.add(`${matchId}-${inn.number}`);

          // Track per-innings figures
          const innKey = `${matchId}-${inn.number}-${uid}`;
          if (!inningsFigures[innKey]) inningsFigures[innKey] = { wickets: 0, runs: 0 };
          inningsFigures[innKey].runs += conceded;
          if (ball.wicket?.type) inningsFigures[innKey].wickets += 1;
        }
      }
    }

    // Update best bowling figures
    for (const [key, fig] of Object.entries(inningsFigures)) {
      const uid = key.split('-').pop();
      if (stats[uid]) {
        if (
          fig.wickets > stats[uid].bestWickets ||
          (fig.wickets === stats[uid].bestWickets && fig.runs < stats[uid].bestRuns)
        ) {
          stats[uid].bestWickets = fig.wickets;
          stats[uid].bestRuns = fig.runs;
        }
      }
    }
  }

  const leaderboard = Object.values(stats).map((s) => {
    const fullOvers = Math.floor(s.ballsBowled / 6);
    const partialBalls = s.ballsBowled % 6;
    const oversDecimal = fullOvers + partialBalls / 6;

    return {
      userId: s.userId,
      name: s.name,
      matches: s._matches.size,
      innings: s._innings.size,
      wickets: s.wickets,
      runsConceded: s.runsConceded,
      overs: `${fullOvers}.${partialBalls}`,
      economy: oversDecimal > 0 ? Number((s.runsConceded / oversDecimal).toFixed(2)) : 0,
      bestBowling: `${s.bestWickets}/${s.bestRuns}`,
      average: s.wickets > 0 ? Number((s.runsConceded / s.wickets).toFixed(2)) : 0,
    };
  });

  leaderboard.sort((a, b) => b.wickets - a.wickets || a.economy - b.economy);
  return enrichWithUserData(leaderboard.slice(0, Number(limit)));
};

// ─── Wins Leaderboard (all sports) ──────────────────────────────────────────

const getWinsLeaderboard = async ({ sport, period = 'alltime', limit = 20 } = {}) => {
  const matches = await loadMatches(sport, period, { 'result.winner': { $in: ['A', 'B', 'draw'] } });
  const stats = {};

  for (const match of matches) {
    const room = match.roomId;
    if (!room) continue;

    const slotMap = buildSlotMap(room.players);
    const winnerTeam = match.result.winner; // 'A', 'B', or 'draw'
    const allSlots = [...(match.teamA?.players || []), ...(match.teamB?.players || [])];

    for (const slotId of allSlots) {
      const info = slotMap[slotId?.toString()];
      if (!info || !info.userId) continue;

      const uid = info.userId;
      if (!stats[uid]) {
        stats[uid] = { userId: uid, name: info.name, wins: 0, losses: 0, draws: 0, matches: 0 };
      }

      stats[uid].matches += 1;

      if (winnerTeam === 'draw') {
        stats[uid].draws += 1;
      } else {
        const winnerSlots = winnerTeam === 'A' ? match.teamA.players : match.teamB.players;
        const isWinner = winnerSlots.some((ws) => ws?.toString() === slotId?.toString());
        if (isWinner) {
          stats[uid].wins += 1;
        } else {
          stats[uid].losses += 1;
        }
      }
    }
  }

  const leaderboard = Object.values(stats).map((s) => ({
    ...s,
    winPercentage: s.matches > 0 ? Number(((s.wins / s.matches) * 100).toFixed(1)) : 0,
  }));

  leaderboard.sort((a, b) => b.wins - a.wins || b.winPercentage - a.winPercentage);
  return enrichWithUserData(leaderboard.slice(0, Number(limit)));
};

// ─── Most Matches Leaderboard ───────────────────────────────────────────────

const getMostMatchesLeaderboard = async ({ sport, period = 'alltime', limit = 20 } = {}) => {
  const matches = await loadMatches(sport, period);
  const stats = {};

  for (const match of matches) {
    const room = match.roomId;
    if (!room) continue;

    const slotMap = buildSlotMap(room.players);
    const allSlots = [...(match.teamA?.players || []), ...(match.teamB?.players || [])];

    for (const slotId of allSlots) {
      const info = slotMap[slotId?.toString()];
      if (!info || !info.userId) continue;

      const uid = info.userId;
      if (!stats[uid]) {
        stats[uid] = { userId: uid, name: info.name, matches: 0 };
      }
      stats[uid].matches += 1;
    }
  }

  const leaderboard = Object.values(stats);
  leaderboard.sort((a, b) => b.matches - a.matches);
  return enrichWithUserData(leaderboard.slice(0, Number(limit)));
};

module.exports = {
  getCricketBattingLeaderboard,
  getCricketBowlingLeaderboard,
  getWinsLeaderboard,
  getMostMatchesLeaderboard,
};
