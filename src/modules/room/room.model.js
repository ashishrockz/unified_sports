const mongoose = require('mongoose');

// ─── Player slot ──────────────────────────────────────────────────────────────
// Each entry in the room is a "slot" — may have a real userId or be a static placeholder
const playerSlotSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name:     { type: String, required: true, trim: true },
  isStatic: { type: Boolean, default: false }, // true = no account (e.g. a walk-in)
  team:     { type: String, enum: ['A', 'B', null], default: null },
  role:     { type: String, default: null }, // sport-specific role e.g. 'batsman', 'bowler'
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// ─── Toss ─────────────────────────────────────────────────────────────────────
const tossSchema = new mongoose.Schema({
  initiatedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // The coin flip
  coinResult:      { type: String, enum: ['heads', 'tails'] },
  call:            { type: String, enum: ['heads', 'tails'] }, // what the caller chose
  callerSlotId:    mongoose.Schema.Types.ObjectId,             // player slot that made the call
  // The winner and their choice
  winnerSlotId:    mongoose.Schema.Types.ObjectId,
  winnerUserId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  choice:          { type: String }, // 'bat'|'bowl'|'serve'|'receive'|'court_A'|'court_B'|'side_A'|'side_B'
  completedAt:     { type: Date },
}, { _id: false });

// ─── Room ─────────────────────────────────────────────────────────────────────
/**
 * Room state machine:
 *   waiting         → players are being added (registration open)
 *   toss_pending    → room is locked, waiting for toss
 *   active          → toss done, teams assigned, match in progress
 *   completed       → match finished normally
 *   abandoned       → match cancelled
 */
const roomSchema = new mongoose.Schema({
  sportTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SportType',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'toss_pending', 'active', 'completed', 'abandoned'],
    default: 'waiting',
    index: true,
  },
  players: [playerSlotSchema],
  toss: { type: tossSchema, default: null },
  matchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', default: null },

  // Copied from sportType.config at room creation time for fast access
  maxPlayers: { type: Number, default: 22 },
  minPlayers: { type: Number, default: 2 },

  // Team customisation
  teamAName:       { type: String, default: 'Team A', trim: true, maxlength: 30 },
  teamBName:       { type: String, default: 'Team B', trim: true, maxlength: 30 },
  oversPerInnings: { type: Number, default: null, min: 1, max: 20 },

  // Captain per team (player slot _id)
  captainA: { type: mongoose.Schema.Types.ObjectId, default: null },
  captainB: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });

// Fast lookup: find rooms a user is actively part of
roomSchema.index({ 'players.userId': 1, status: 1 });

module.exports = mongoose.model('Room', roomSchema);
