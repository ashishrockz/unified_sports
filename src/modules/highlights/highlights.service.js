const Match = require('../match/match.model');
const Room = require('../room/room.model');
const { fail } = require('../../utils/AppError');

// ─── Helpers ────────────────────────────────────────────────────────────────

const buildSlotMap = (players) => {
  const map = {};
  for (const slot of players) {
    map[slot._id.toString()] = {
      userId: slot.userId?.toString() || null,
      name: slot.name,
      team: slot.team,
      isStatic: slot.isStatic,
    };
  }
  return map;
};

const formatOvers = (balls) => {
  const full = Math.floor(balls / 6);
  const rem = balls % 6;
  return rem > 0 ? `${full}.${rem}` : `${full}`;
};

// ─── Cricket Highlights ─────────────────────────────────────────────────────

const generateCricketHighlights = (match, slotMap) => {
  const highlights = [];
  const inningsSummaries = [];

  // Per-player stats aggregated from ball data
  const batsmen = {}; // slotId → stats
  const bowlers = {}; // slotId → stats

  for (const inn of match.innings) {
    // Per-innings per-player stats
    const innBatsmen = {};
    const innBowlers = {};

    for (const over of inn.overs) {
      for (const ball of over.balls) {
        const batId = ball.batsmanId?.toString();
        const bowlId = ball.bowlerId?.toString();

        // Batting
        if (batId) {
          if (!innBatsmen[batId]) innBatsmen[batId] = { runs: 0, balls: 0, fours: 0, sixes: 0, dismissed: false };
          if (!batsmen[batId]) batsmen[batId] = { runs: 0, balls: 0, fours: 0, sixes: 0, innings: 0, dismissed: 0 };

          innBatsmen[batId].runs += ball.runs || 0;
          batsmen[batId].runs += ball.runs || 0;
          if (ball.isLegal) {
            innBatsmen[batId].balls += 1;
            batsmen[batId].balls += 1;
          }
          if (ball.runs === 4) { innBatsmen[batId].fours += 1; batsmen[batId].fours += 1; }
          if (ball.runs === 6) { innBatsmen[batId].sixes += 1; batsmen[batId].sixes += 1; }
          if (ball.wicket?.type) { innBatsmen[batId].dismissed = true; batsmen[batId].dismissed += 1; }
        }

        // Bowling
        if (bowlId) {
          if (!innBowlers[bowlId]) innBowlers[bowlId] = { wickets: 0, runs: 0, balls: 0 };
          if (!bowlers[bowlId]) bowlers[bowlId] = { wickets: 0, runs: 0, balls: 0, innings: 0 };

          const conceded = (ball.runs || 0) + (ball.extras?.runs || 0);
          innBowlers[bowlId].runs += conceded;
          bowlers[bowlId].runs += conceded;
          if (ball.isLegal) { innBowlers[bowlId].balls += 1; bowlers[bowlId].balls += 1; }
          if (ball.wicket?.type) { innBowlers[bowlId].wickets += 1; bowlers[bowlId].wickets += 1; }
        }
      }
    }

    // Count innings played
    for (const id of Object.keys(innBatsmen)) {
      if (batsmen[id]) batsmen[id].innings += 1;
    }
    for (const id of Object.keys(innBowlers)) {
      if (bowlers[id]) bowlers[id].innings += 1;
    }

    // Innings summary
    const topBat = Object.entries(innBatsmen).sort((a, b) => b[1].runs - a[1].runs)[0];
    const topBowl = Object.entries(innBowlers).sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs)[0];

    inningsSummaries.push({
      number: inn.number,
      battingTeam: inn.battingTeam,
      score: `${inn.totalRuns}/${inn.totalWickets}`,
      overs: formatOvers(inn.completedOvers * 6 + (inn.overs.length > 0 && !inn.overs[inn.overs.length - 1]?.isComplete ? inn.overs[inn.overs.length - 1].balls.filter(b => b.isLegal).length : 0)),
      extras: inn.extras,
      topScorer: topBat ? {
        slotId: topBat[0],
        name: slotMap[topBat[0]]?.name || 'Unknown',
        runs: topBat[1].runs,
        balls: topBat[1].balls,
        fours: topBat[1].fours,
        sixes: topBat[1].sixes,
      } : null,
      topBowler: topBowl ? {
        slotId: topBowl[0],
        name: slotMap[topBowl[0]]?.name || 'Unknown',
        wickets: topBowl[1].wickets,
        runs: topBowl[1].runs,
        overs: formatOvers(topBowl[1].balls),
      } : null,
    });
  }

  // ── Match Result ──
  if (match.result?.winner) {
    highlights.push({
      type: 'result',
      icon: 'trophy',
      title: 'Match Result',
      description: match.result.winner === 'draw'
        ? 'Match ended in a tie'
        : `Team ${match.result.winner} won${match.result.margin ? ` by ${match.result.margin}` : ''}`,
    });
  }

  // ── Top Scorer (overall) ──
  const topScorerEntry = Object.entries(batsmen).sort((a, b) => b[1].runs - a[1].runs)[0];
  if (topScorerEntry) {
    const [slotId, s] = topScorerEntry;
    const info = slotMap[slotId];
    const sr = s.balls > 0 ? ((s.runs / s.balls) * 100).toFixed(1) : '0.0';
    highlights.push({
      type: 'top_scorer',
      icon: 'bat',
      title: 'Top Scorer',
      playerName: info?.name || 'Unknown',
      playerId: info?.userId || null,
      team: info?.team || null,
      description: `${s.runs} runs (${s.balls} balls)`,
      stats: { runs: s.runs, balls: s.balls, fours: s.fours, sixes: s.sixes, strikeRate: Number(sr) },
    });
  }

  // ── Best Bowler (overall) ──
  const topBowlerEntry = Object.entries(bowlers)
    .sort((a, b) => b[1].wickets - a[1].wickets || a[1].runs - b[1].runs)[0];
  if (topBowlerEntry) {
    const [slotId, s] = topBowlerEntry;
    const info = slotMap[slotId];
    highlights.push({
      type: 'best_bowler',
      icon: 'ball',
      title: 'Best Bowler',
      playerName: info?.name || 'Unknown',
      playerId: info?.userId || null,
      team: info?.team || null,
      description: `${s.wickets}/${s.runs} (${formatOvers(s.balls)} ov)`,
      stats: {
        wickets: s.wickets,
        runsConceded: s.runs,
        overs: formatOvers(s.balls),
        economy: s.balls > 0 ? Number(((s.runs / (s.balls / 6))).toFixed(2)) : 0,
      },
    });
  }

  // ── Milestones ──
  for (const [slotId, s] of Object.entries(batsmen)) {
    const name = slotMap[slotId]?.name || 'Unknown';
    if (s.runs >= 100) {
      highlights.push({ type: 'milestone', icon: 'star', title: 'Century', playerName: name, description: `${name} scored a century — ${s.runs} runs`, team: slotMap[slotId]?.team });
    } else if (s.runs >= 50) {
      highlights.push({ type: 'milestone', icon: 'star', title: 'Half Century', playerName: name, description: `${name} scored a half-century — ${s.runs} runs`, team: slotMap[slotId]?.team });
    }
  }

  for (const [slotId, s] of Object.entries(bowlers)) {
    const name = slotMap[slotId]?.name || 'Unknown';
    if (s.wickets >= 5) {
      highlights.push({ type: 'milestone', icon: 'fire', title: '5-Wicket Haul', playerName: name, description: `${name} took ${s.wickets} wickets`, team: slotMap[slotId]?.team });
    } else if (s.wickets >= 3) {
      highlights.push({ type: 'milestone', icon: 'fire', title: '3-Wicket Haul', playerName: name, description: `${name} took ${s.wickets} wickets`, team: slotMap[slotId]?.team });
    }
  }

  // ── Most Sixes ──
  const sixHitters = Object.entries(batsmen)
    .filter(([, s]) => s.sixes >= 2)
    .sort((a, b) => b[1].sixes - a[1].sixes);
  if (sixHitters.length > 0) {
    const [slotId, s] = sixHitters[0];
    const name = slotMap[slotId]?.name || 'Unknown';
    highlights.push({
      type: 'most_sixes',
      icon: 'zap',
      title: 'Maximum Sixes',
      playerName: name,
      team: slotMap[slotId]?.team,
      description: `${name} hit ${s.sixes} sixes`,
    });
  }

  // ── Most Fours ──
  const fourHitters = Object.entries(batsmen)
    .filter(([, s]) => s.fours >= 3)
    .sort((a, b) => b[1].fours - a[1].fours);
  if (fourHitters.length > 0) {
    const [slotId, s] = fourHitters[0];
    const name = slotMap[slotId]?.name || 'Unknown';
    highlights.push({
      type: 'most_fours',
      icon: 'target',
      title: 'Most Boundaries',
      playerName: name,
      team: slotMap[slotId]?.team,
      description: `${name} hit ${s.fours} fours`,
    });
  }

  // ── Best Strike Rate (min 10 balls) ──
  const bestSR = Object.entries(batsmen)
    .filter(([, s]) => s.balls >= 10)
    .map(([slotId, s]) => ({ slotId, sr: (s.runs / s.balls) * 100, ...s }))
    .sort((a, b) => b.sr - a.sr)[0];
  if (bestSR && topScorerEntry && bestSR.slotId !== topScorerEntry[0]) {
    const name = slotMap[bestSR.slotId]?.name || 'Unknown';
    highlights.push({
      type: 'best_strike_rate',
      icon: 'gauge',
      title: 'Best Strike Rate',
      playerName: name,
      team: slotMap[bestSR.slotId]?.team,
      description: `${name} — SR ${bestSR.sr.toFixed(1)} (${bestSR.runs} off ${bestSR.balls})`,
    });
  }

  // ── Best Economy (min 2 overs / 12 balls) ──
  const bestEcon = Object.entries(bowlers)
    .filter(([, s]) => s.balls >= 12)
    .map(([slotId, s]) => ({ slotId, econ: s.runs / (s.balls / 6), ...s }))
    .sort((a, b) => a.econ - b.econ)[0];
  if (bestEcon && topBowlerEntry && bestEcon.slotId !== topBowlerEntry[0]) {
    const name = slotMap[bestEcon.slotId]?.name || 'Unknown';
    highlights.push({
      type: 'best_economy',
      icon: 'shield',
      title: 'Best Economy',
      playerName: name,
      team: slotMap[bestEcon.slotId]?.team,
      description: `${name} — Econ ${bestEcon.econ.toFixed(2)} (${bestEcon.wickets}/${bestEcon.runs})`,
    });
  }

  return { highlights, innings: inningsSummaries };
};

// ─── Racket Sport Highlights ────────────────────────────────────────────────

const generateRacketHighlights = (match, slotMap) => {
  const highlights = [];

  // Match result
  if (match.result?.winner) {
    highlights.push({
      type: 'result',
      icon: 'trophy',
      title: 'Match Result',
      description: match.result.winner === 'draw'
        ? 'Match ended in a draw'
        : `Team ${match.result.winner} won${match.result.margin ? ` ${match.result.margin}` : ''}`,
    });
  }

  // Set scores
  const setScores = (match.sets || []).filter((s) => s.isComplete).map((s) => ({
    setNumber: s.setNumber,
    scoreA: s.gamesA,
    scoreB: s.gamesB,
    winner: s.winner,
    display: `${s.gamesA}-${s.gamesB}`,
  }));

  if (setScores.length > 0) {
    highlights.push({
      type: 'set_scores',
      icon: 'list',
      title: 'Set Scores',
      description: setScores.map((s) => s.display).join(', '),
      sets: setScores,
    });

    // Sets won
    highlights.push({
      type: 'sets_won',
      icon: 'bar_chart',
      title: 'Sets Won',
      description: `Team A: ${match.setsWonA} — Team B: ${match.setsWonB}`,
    });

    // Closest set
    const closestSet = [...setScores].sort((a, b) => {
      const diffA = Math.abs(a.scoreA - a.scoreB);
      const diffB = Math.abs(b.scoreA - b.scoreB);
      return diffA - diffB;
    })[0];

    if (closestSet && Math.abs(closestSet.scoreA - closestSet.scoreB) <= 2) {
      highlights.push({
        type: 'closest_set',
        icon: 'flame',
        title: 'Closest Set',
        description: `Set ${closestSet.setNumber} was the tightest at ${closestSet.display}`,
      });
    }
  }

  // Total games/points
  let totalPointsA = 0;
  let totalPointsB = 0;
  for (const set of match.sets || []) {
    for (const game of set.games || []) {
      totalPointsA += game.pointsA || 0;
      totalPointsB += game.pointsB || 0;
    }
  }

  if (totalPointsA > 0 || totalPointsB > 0) {
    highlights.push({
      type: 'total_points',
      icon: 'hash',
      title: 'Total Points',
      description: `Team A: ${totalPointsA} — Team B: ${totalPointsB}`,
    });
  }

  return { highlights, sets: setScores };
};

// ─── Main Entry Point ───────────────────────────────────────────────────────

const getMatchHighlights = async (matchId) => {
  const match = await Match.findById(matchId).lean();
  if (!match) fail('Match not found', 404);
  if (match.status === 'not_started') fail('Match has not started yet', 400);

  const room = await Room.findById(match.roomId).lean();
  if (!room) fail('Room not found for this match', 404);

  const slotMap = buildSlotMap(room.players);

  let result;
  if (match.sport === 'cricket') {
    result = generateCricketHighlights(match, slotMap);
  } else {
    result = generateRacketHighlights(match, slotMap);
  }

  return {
    matchId: match._id,
    sport: match.sport,
    status: match.status,
    result: match.result || null,
    teamA: { name: match.teamA.name, players: (match.teamA.players || []).map((id) => slotMap[id?.toString()] || null).filter(Boolean) },
    teamB: { name: match.teamB.name, players: (match.teamB.players || []).map((id) => slotMap[id?.toString()] || null).filter(Boolean) },
    ...result,
  };
};

module.exports = { getMatchHighlights };
