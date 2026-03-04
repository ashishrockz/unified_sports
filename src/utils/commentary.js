/**
 * Auto-generated live commentary for matches.
 *
 * Each generator returns { text, type } where type categorizes the event
 * for frontend styling (different colors/icons per type).
 */

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Cricket Commentary ─────────────────────────────────────────────────────

const dotBall = [
  '{bowler} to {batsman}, no run. Good length delivery.',
  'Defended solidly by {batsman}. Dot ball.',
  '{batsman} leaves it alone outside off. No run.',
  'Tight line from {bowler}, no run conceded.',
  '{bowler} keeps it tight. Dot ball.',
  'Watchful from {batsman}, pushed back to {bowler}.',
];

const singles = [
  '{batsman} works it away for a quick single.',
  'One run. Smart rotation of strike by {batsman}.',
  '{bowler} to {batsman}, nudged away for 1.',
  'Pushed into the gap, single taken.',
];

const doubles = [
  '{batsman} finds the gap, they come back for two.',
  'Well placed! Two runs to {batsman}.',
  'Good running between the wickets, two taken.',
];

const triples = [
  'Three runs! Great placement by {batsman}.',
  'They push hard for three. Excellent running!',
  'Driven into the deep, three taken.',
];

const fours = [
  'FOUR! {batsman} cracks it through the covers!',
  'FOUR! That races away to the boundary!',
  'Glorious drive by {batsman}! Four runs!',
  'BOUNDARY! {batsman} punches it past the fielder!',
  'FOUR! Short and punished by {batsman}!',
  'What a shot! {batsman} sends it racing to the fence!',
  'Perfectly timed by {batsman}. FOUR!',
];

const sixes = [
  'SIX! {batsman} launches it into the stands!',
  'MASSIVE SIX! What a hit by {batsman}!',
  'That\'s gone all the way! SIX by {batsman}!',
  'HUGE! {batsman} sends it over the ropes! Six runs!',
  'Into the crowd! {batsman} goes big for SIX!',
  'SIX! {batsman} clears the boundary with ease!',
  'Maximum! {batsman} smashes {bowler} for a big six!',
];

const wicketBowled = [
  'BOWLED! {bowler} knocks over {batsman}\'s stumps!',
  'TIMBER! {batsman} is bowled by {bowler}!',
  'Clean bowled! {bowler} shatters the stumps!',
  'The stumps are rattled! {batsman} has to go!',
];

const wicketCaught = [
  'CAUGHT! {batsman} is taken by {fielder}!',
  'OUT! Caught brilliantly! {batsman} has to walk.',
  'Edged and caught! {bowler} gets the breakthrough!',
  'In the air... TAKEN! {batsman} is caught by {fielder}!',
];

const wicketLBW = [
  'LBW! The finger goes up! {batsman} is out!',
  'Trapped in front! {bowler} gets {batsman} LBW!',
  'Plumb in front of the stumps! That\'s out LBW!',
];

const wicketRunOut = [
  'RUN OUT! {batsman} is short of the crease!',
  'Direct hit! {batsman} is run out!',
  'Brilliant throw! {batsman} is caught short. RUN OUT!',
];

const wicketStumped = [
  'STUMPED! {batsman} is out of the crease!',
  'Lightning quick! {batsman} is stumped by the keeper!',
  'Down the track and missed. STUMPED!',
];

const wicketHitWicket = [
  'HIT WICKET! {batsman} knocks the bails off!',
  'Unfortunate! {batsman} dislodges the stumps. Hit wicket!',
];

const wides = [
  'Wide ball! Extra run conceded.',
  'That\'s called wide. Straying down leg.',
  'Wide! {bowler} can\'t find the right line.',
];

const noBalls = [
  'No ball! Free hit coming up!',
  'Overstepping! {bowler} bowls a no ball.',
  'No ball called. Extra run and a free hit!',
];

const byes = [
  'Byes! The keeper can\'t collect cleanly.',
  'Goes past the keeper, byes taken.',
];

const legByes = [
  'Off the pads, leg byes taken.',
  'Leg byes signalled. Deflected off the body.',
];

const wicketTemplates = {
  bowled:      wicketBowled,
  caught:      wicketCaught,
  lbw:         wicketLBW,
  run_out:     wicketRunOut,
  stumped:     wicketStumped,
  hit_wicket:  wicketHitWicket,
};

const extrasTemplates = {
  wide:   wides,
  noball: noBalls,
  bye:    byes,
  legbye: legByes,
};

/**
 * Generate commentary for a single cricket ball.
 *
 * @param {Object} ball      — { runs, isLegal, extras: { type, runs }, wicket: { type, fielderId } }
 * @param {Object} context   — { batsmanName, bowlerName, fielderName, overNumber, ballInOver,
 *                               score, wickets, overs, target, inningsNum }
 * @returns {{ text: string, type: string }}
 */
const generateBallCommentary = (ball, ctx) => {
  const vars = {
    batsman: ctx.batsmanName || 'Batsman',
    bowler: ctx.bowlerName || 'Bowler',
    fielder: ctx.fielderName || 'Fielder',
  };

  const fill = (tpl) =>
    tpl.replace(/\{(\w+)\}/g, (_, key) => vars[key] || key);

  const parts = [];
  let type = 'ball';

  // 1) Wicket
  if (ball.wicket?.type) {
    const templates = wicketTemplates[ball.wicket.type] || wicketBowled;
    parts.push(fill(pick(templates)));
    type = 'wicket';
  }
  // 2) Boundary
  else if (ball.runs === 6) {
    parts.push(fill(pick(sixes)));
    type = 'six';
  } else if (ball.runs === 4) {
    parts.push(fill(pick(fours)));
    type = 'four';
  }
  // 3) Extras
  else if (ball.extras?.type) {
    const templates = extrasTemplates[ball.extras.type] || wides;
    parts.push(fill(pick(templates)));
    type = 'extra';
    if (ball.runs > 0) {
      parts.push(`Plus ${ball.runs} run${ball.runs > 1 ? 's' : ''} off the bat.`);
    }
  }
  // 4) Runs
  else if (ball.runs === 0) {
    parts.push(fill(pick(dotBall)));
    type = 'dot';
  } else if (ball.runs === 1) {
    parts.push(fill(pick(singles)));
    type = 'single';
  } else if (ball.runs === 2) {
    parts.push(fill(pick(doubles)));
    type = 'runs';
  } else if (ball.runs === 3) {
    parts.push(fill(pick(triples)));
    type = 'runs';
  } else {
    parts.push(`${ball.runs} runs scored by ${vars.batsman}.`);
    type = 'runs';
  }

  // Score context
  const totalRuns = (ctx.score || 0) + (ball.runs || 0) + (ball.extras?.runs || 0);
  const totalWickets = (ctx.wickets || 0) + (ball.wicket?.type ? 1 : 0);
  parts.push(`[${totalRuns}/${totalWickets}]`);

  return { text: parts.join(' '), type };
};

/**
 * Generate over-end summary.
 */
const generateOverSummary = (ctx) => {
  return {
    text: `End of over ${ctx.overNumber}. ${ctx.battingTeamName || 'Batting team'}: ${ctx.score}/${ctx.wickets} after ${ctx.overNumber} over${ctx.overNumber !== 1 ? 's' : ''}. (${ctx.overRuns} runs this over)`,
    type: 'over_end',
  };
};

/**
 * Generate innings-end commentary.
 */
const generateInningsEnd = (ctx) => {
  const msgs = [
    `End of innings! ${ctx.battingTeamName || 'Team ' + ctx.battingTeam} finish on ${ctx.score}/${ctx.wickets} in ${ctx.overs} overs.`,
    `That brings the innings to a close. ${ctx.score}/${ctx.wickets} is the total.`,
    `Innings over! ${ctx.battingTeamName || 'Team ' + ctx.battingTeam} set a target of ${ctx.score + 1}.`,
  ];
  return { text: pick(msgs), type: 'innings_end' };
};

/**
 * Generate match-end commentary.
 */
const generateMatchEnd = (result) => {
  if (result.winner === 'draw') {
    return { text: 'MATCH TIED! What an incredible contest! Both teams level on runs.', type: 'match_end' };
  }
  const msgs = [
    `MATCH OVER! Team ${result.winner} win by ${result.margin}!`,
    `That's it! Team ${result.winner} clinch the victory by ${result.margin}!`,
    `What a match! Team ${result.winner} emerge victorious, winning by ${result.margin}!`,
  ];
  return { text: pick(msgs), type: 'match_end' };
};

/**
 * Generate milestone commentary (50, 100, etc.)
 */
const generateMilestone = (playerName, runs) => {
  if (runs >= 100) {
    const msgs = [
      `CENTURY! ${playerName} reaches 100! What a magnificent innings!`,
      `A hundred for ${playerName}! The crowd goes wild!`,
      `${playerName} raises the bat — it's a CENTURY! Sensational!`,
    ];
    return { text: pick(msgs), type: 'milestone' };
  }
  if (runs >= 50) {
    const msgs = [
      `FIFTY! ${playerName} reaches the half-century mark!`,
      `Well played! ${playerName} brings up 50!`,
      `Half-century for ${playerName}! Great knock so far!`,
    ];
    return { text: pick(msgs), type: 'milestone' };
  }
  return null;
};

/**
 * Generate bowling milestone commentary (3W, 5W)
 */
const generateBowlingMilestone = (bowlerName, wickets) => {
  if (wickets === 5) {
    return { text: `FIVE-FOR! ${bowlerName} picks up 5 wickets! Outstanding bowling!`, type: 'milestone' };
  }
  if (wickets === 3) {
    return { text: `Three wickets now for ${bowlerName}! Great spell of bowling!`, type: 'milestone' };
  }
  return null;
};

// ─── Racket Sport Commentary ────────────────────────────────────────────────

const pointWon = [
  'Point to Team {team}!',
  'Team {team} takes the point!',
  'Winner! Team {team} scores!',
  'Great rally! Point goes to Team {team}.',
];

const gameWon = [
  'Game Team {team}! They take the game {scoreA}-{scoreB}.',
  'Team {team} wins the game! Score: {scoreA}-{scoreB}.',
];

const setWon = [
  'SET to Team {team}! They win it {gamesA}-{gamesB}. Sets: {setsA}-{setsB}.',
  'Team {team} takes the set {gamesA}-{gamesB}! Sets now {setsA}-{setsB}.',
];

const racketMatchEnd = [
  'MATCH POINT converted! Team {team} wins {setsA}-{setsB}!',
  'Game, set and match! Team {team} wins {setsA}-{setsB}!',
];

/**
 * Generate commentary for a racket sport point.
 *
 * @param {Object} ctx — { team, pointsA, pointsB, gameWinner, gameScoreA, gameScoreB,
 *                          setWinner, setGamesA, setGamesB, matchWinner, setsWonA, setsWonB }
 * @returns {Array<{ text: string, type: string }>}
 */
const generatePointCommentary = (ctx) => {
  const fill = (tpl) =>
    tpl
      .replace(/\{team\}/g, ctx.team)
      .replace(/\{scoreA\}/g, ctx.pointsA)
      .replace(/\{scoreB\}/g, ctx.pointsB)
      .replace(/\{gamesA\}/g, ctx.setGamesA || 0)
      .replace(/\{gamesB\}/g, ctx.setGamesB || 0)
      .replace(/\{setsA\}/g, ctx.setsWonA || 0)
      .replace(/\{setsB\}/g, ctx.setsWonB || 0);

  const entries = [];

  // Point
  entries.push({ text: fill(pick(pointWon)) + ` (${ctx.pointsA}-${ctx.pointsB})`, type: 'point' });

  // Game won
  if (ctx.gameWinner) {
    entries.push({ text: fill(pick(gameWon)), type: 'game_end' });
  }

  // Set won
  if (ctx.setWinner) {
    entries.push({ text: fill(pick(setWon)), type: 'set_end' });
  }

  // Match won
  if (ctx.matchWinner) {
    entries.push({ text: fill(pick(racketMatchEnd)), type: 'match_end' });
  }

  return entries;
};

module.exports = {
  generateBallCommentary,
  generateOverSummary,
  generateInningsEnd,
  generateMatchEnd,
  generateMilestone,
  generateBowlingMilestone,
  generatePointCommentary,
};
