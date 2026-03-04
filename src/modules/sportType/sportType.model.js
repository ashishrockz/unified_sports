const mongoose = require('mongoose');

// Configurable role definition per sport type
const roleDefSchema = new mongoose.Schema({
  name:     { type: String, required: true }, // e.g. 'batsman', 'bowler', 'server'
  perTeam:  { type: Number, default: 1 },     // how many of this role per team
  required: { type: Boolean, default: false },
}, { _id: false });

// Fully configurable sport rules
const configSchema = new mongoose.Schema({
  // ── Common ────────────────────────────────────────────────────────────
  minPlayers:  { type: Number, required: true }, // minimum to start a match
  maxPlayers:  { type: Number, required: true }, // hard cap for the room
  teamSize:    { type: Number, required: true }, // players per team

  // Toss choices offered to the winner (sport-specific)
  // Cricket : ['bat', 'bowl']
  // Tennis  : ['serve', 'receive', 'court_A', 'court_B']
  // Badminton: ['serve', 'receive', 'court_A', 'court_B']
  // Pickleball: ['serve', 'receive', 'side_A', 'side_B']
  tossOptions: [{ type: String }],

  // Named roles in the sport
  roles: [roleDefSchema],

  // ── Cricket ───────────────────────────────────────────────────────────
  innings:         { type: Number, default: 2 },   // 1 or 2
  oversPerInnings: { type: Number, default: 20 },  // 5, 10, 20, 50, 90 etc.

  // ── Tennis ────────────────────────────────────────────────────────────
  sets:          { type: Number, default: 3 },  // best-of (3 or 5)
  gamesPerSet:   { type: Number, default: 6 },
  deuceEnabled:  { type: Boolean, default: true },

  // ── Badminton ─────────────────────────────────────────────────────────
  pointsPerGame:  { type: Number, default: 21 },
  gamesPerMatch:  { type: Number, default: 3 },  // best-of

  // ── Pickleball ────────────────────────────────────────────────────────
  pointsToWin: { type: Number, default: 11 },
  winByTwo:    { type: Boolean, default: true },

}, { _id: false });

const sportTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
  },
  sport: {
    type: String,
    required: true,
    enum: ['cricket', 'tennis', 'badminton', 'pickleball'],
  },
  description: { type: String, trim: true },
  config:      { type: configSchema, required: true },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

// slug must be globally unique
sportTypeSchema.index({ slug: 1 }, { unique: true });

sportTypeSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
  next();
});

module.exports = mongoose.model('SportType', sportTypeSchema);
