const mongoose = require('mongoose');

// ─── Cricket — ball-by-ball ───────────────────────────────────────────────────
const extrasSchema = new mongoose.Schema({
  type: { type: String, enum: ['wide', 'noball', 'bye', 'legbye', 'penalty', null], default: null },
  runs: { type: Number, default: 0 },
}, { _id: false });

const wicketSchema = new mongoose.Schema({
  type:      { type: String, enum: ['bowled', 'caught', 'lbw', 'run_out', 'stumped', 'hit_wicket', 'obstructed', null], default: null },
  fielderId: { type: mongoose.Schema.Types.ObjectId, default: null }, // fielder who caught/ran-out
}, { _id: false });

const ballSchema = new mongoose.Schema({
  ballNumber: { type: Number, required: true }, // 1-6 (or more for extras)
  batsmanId:  { type: mongoose.Schema.Types.ObjectId }, // player slot _id
  bowlerId:   { type: mongoose.Schema.Types.ObjectId },
  runs:       { type: Number, default: 0 },
  extras:     { type: extrasSchema, default: () => ({}) },
  wicket:     { type: wicketSchema, default: () => ({}) },
  isLegal:    { type: Boolean, default: true }, // false for wides/no-balls
}, { _id: false });

const overSchema = new mongoose.Schema({
  overNumber: { type: Number, required: true },
  bowlerId:   { type: mongoose.Schema.Types.ObjectId },
  balls:      [ballSchema],
  runs:       { type: Number, default: 0 },
  wickets:    { type: Number, default: 0 },
  isComplete: { type: Boolean, default: false },
}, { _id: false });

const inningsSchema = new mongoose.Schema({
  number:          { type: Number, required: true },
  battingTeam:     { type: String, enum: ['A', 'B'], required: true },
  bowlingTeam:     { type: String, enum: ['A', 'B'], required: true },
  overs:           [overSchema],
  totalRuns:       { type: Number, default: 0 },
  totalWickets:    { type: Number, default: 0 },
  completedOvers:  { type: Number, default: 0 },
  extras:          {
    wide: { type: Number, default: 0 },
    noball: { type: Number, default: 0 },
    bye: { type: Number, default: 0 },
    legbye: { type: Number, default: 0 },
  },
  currentBatsmen: {
    striker:    { type: mongoose.Schema.Types.ObjectId, default: null }, // player slot _id
    nonStriker: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  currentBowler: { type: mongoose.Schema.Types.ObjectId, default: null },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
}, { _id: false });

// ─── Racket sports — point-by-point ──────────────────────────────────────────
const gameSchema = new mongoose.Schema({
  gameNumber: { type: Number, required: true },
  pointsA:    { type: Number, default: 0 },
  pointsB:    { type: Number, default: 0 },
  winner:     { type: String, enum: ['A', 'B', null], default: null },
  isComplete: { type: Boolean, default: false },
}, { _id: false });

// For Tennis: a "set" containing multiple "games"
// For Badminton/Pickleball: treated as one "game" group (no sets)
const setSchema = new mongoose.Schema({
  setNumber: { type: Number, required: true },
  gamesA:    { type: Number, default: 0 }, // games won by team A in this set
  gamesB:    { type: Number, default: 0 },
  games:     [gameSchema],
  winner:    { type: String, enum: ['A', 'B', null], default: null },
  isComplete: { type: Boolean, default: false },
}, { _id: false });

// ─── Match ────────────────────────────────────────────────────────────────────
/**
 * Match status machine:
 *   not_started → active → innings_break (cricket) → active → completed
 *                       → set_break (tennis) → active → completed
 *                       → abandoned
 */
const matchSchema = new mongoose.Schema({
  roomId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true, unique: true },
  sportTypeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'SportType', required: true },
  sport:         { type: String, enum: ['cricket', 'tennis', 'badminton', 'pickleball'], required: true },
  matchType:     { type: String, enum: ['local', 'tournament'], default: 'local' },

  // Teams (player slot IDs from room)
  teamA: {
    name:    { type: String, default: 'Team A' },
    players: [{ type: mongoose.Schema.Types.ObjectId }], // player slot _ids
    captain: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  teamB: {
    name:    { type: String, default: 'Team B' },
    players: [{ type: mongoose.Schema.Types.ObjectId }],
    captain: { type: mongoose.Schema.Types.ObjectId, default: null },
  },

  // Toss snapshot
  toss: {
    winnerTeam: { type: String, enum: ['A', 'B', null], default: null },
    choice:     { type: String },
  },

  // ── Cricket scoring ────────────────────────────────────────────────────────
  innings:         [inningsSchema],
  currentInnings:  { type: Number, default: 1 },

  // ── Racket sport scoring ───────────────────────────────────────────────────
  sets:        [setSchema],
  setsWonA:    { type: Number, default: 0 },
  setsWonB:    { type: Number, default: 0 },
  currentSet:  { type: Number, default: 1 },
  currentGame: { type: Number, default: 1 },

  // ── Live Commentary Feed ───────────────────────────────────────────────────
  commentary: [{
    text:           { type: String, required: true },
    type:           { type: String, enum: ['dot', 'single', 'runs', 'four', 'six', 'wicket', 'extra', 'over_end', 'innings_end', 'match_end', 'milestone', 'point', 'game_end', 'set_end'], required: true },
    inningsNumber:  { type: Number },
    overNumber:     { type: Number },
    ballNumber:     { type: Number },
    timestamp:      { type: Date, default: Date.now },
    _id: false,
  }],

  // ── Match state ────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['not_started', 'active', 'innings_break', 'set_break', 'super_over', 'completed', 'abandoned'],
    default: 'not_started',
  },

  // Super Over data (cricket tie-breaker)
  superOver: {
    innings: [inningsSchema],
    currentInnings: { type: Number, default: 1 },
    result: {
      winner:      { type: String, enum: ['A', 'B', 'draw', null], default: null },
      margin:      { type: String },
      completedAt: { type: Date },
    },
  },

  // Config snapshot at match creation
  config: { type: mongoose.Schema.Types.Mixed },

  // Undo stack — snapshots for the last N balls (cricket only)
  undoStack: [{
    inningsIdx:      { type: Number },
    overIndex:       { type: Number },
    overSnapshot:    { type: mongoose.Schema.Types.Mixed },   // serialised over before mutation
    inningsTotals:   {
      totalRuns:      { type: Number },
      totalWickets:   { type: Number },
      completedOvers: { type: Number },
      extras:         { type: mongoose.Schema.Types.Mixed },
      status:         { type: String },
    },
    commentaryLength: { type: Number },
    matchStatus:      { type: String },
    currentInnings:   { type: Number },
    roomStatus:       { type: String },
    _id: false,
  }],

  // Result
  result: {
    winner:      { type: String, enum: ['A', 'B', 'draw', 'no_result', null], default: null },
    margin:      { type: String },
    description: { type: String },
    completedAt: { type: Date },
  },
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
