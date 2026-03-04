const mongoose = require('mongoose');

// ─── Per-sport local stat sub-schemas ───────────────────────────────────────

const cricketLocalSchema = new mongoose.Schema({
  team:    { type: String, trim: true },
  league:  { type: String, trim: true },
  season:  { type: String, trim: true },
  role:    { type: String, trim: true }, // Batsman / Bowler / All-rounder / WK
  captain: { type: Boolean, default: false },
  batting: {
    matches:     { type: Number, default: 0 },
    innings:     { type: Number, default: 0 },
    runs:        { type: Number, default: 0 },
    notOuts:     { type: Number, default: 0 },
    highScore:   { type: Number, default: 0 },
    average:     { type: Number, default: 0 },
    strikeRate:  { type: Number, default: 0 },
    hundreds:    { type: Number, default: 0 },
    fifties:     { type: Number, default: 0 },
    fours:       { type: Number, default: 0 },
    sixes:       { type: Number, default: 0 },
    ducks:       { type: Number, default: 0 },
  },
  bowling: {
    wickets:      { type: Number, default: 0 },
    overs:        { type: Number, default: 0 },
    runs:         { type: Number, default: 0 },
    economy:      { type: Number, default: 0 },
    average:      { type: Number, default: 0 },
    strikeRate:   { type: Number, default: 0 },
    bestBowling:  { type: String, trim: true },   // e.g. "4/22"
    fiveWickets:  { type: Number, default: 0 },
    maidens:      { type: Number, default: 0 },
  },
  fielding: {
    catches:   { type: Number, default: 0 },
    runOuts:   { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
  },
}, { _id: false });

const cricketTournamentSchema = new mongoose.Schema({
  batting: {
    matches:     { type: Number, default: 0 },
    innings:     { type: Number, default: 0 },
    runs:        { type: Number, default: 0 },
    notOuts:     { type: Number, default: 0 },
    highScore:   { type: Number, default: 0 },
    average:     { type: Number, default: 0 },
    strikeRate:  { type: Number, default: 0 },
    hundreds:    { type: Number, default: 0 },
    fifties:     { type: Number, default: 0 },
    fours:       { type: Number, default: 0 },
    sixes:       { type: Number, default: 0 },
    ducks:       { type: Number, default: 0 },
  },
  bowling: {
    wickets:      { type: Number, default: 0 },
    overs:        { type: Number, default: 0 },
    runs:         { type: Number, default: 0 },
    economy:      { type: Number, default: 0 },
    average:      { type: Number, default: 0 },
    strikeRate:   { type: Number, default: 0 },
    bestBowling:  { type: String, trim: true },
    fiveWickets:  { type: Number, default: 0 },
    maidens:      { type: Number, default: 0 },
  },
  fielding: {
    catches:   { type: Number, default: 0 },
    runOuts:   { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
  },
  events: [
    {
      name:              { type: String, trim: true },
      year:              { type: Number },
      format:            { type: String, enum: ['test', 'odi', 't20', 'other'] },
      result:            { type: String, trim: true },  // e.g. "Winner", "Runner-up"
      playerOfTournament: { type: Boolean, default: false },
    },
  ],
}, { _id: false });

// ─────────────────────────────────────────────────────────────────────────────

const pickleballLocalSchema = new mongoose.Schema({
  club:    { type: String, trim: true },
  league:  { type: String, trim: true },
  city:    { type: String, trim: true },
  rating:  { type: Number },            // DUPR rating
  matches: { type: Number, default: 0 },
  wins:    { type: Number, default: 0 },
  losses:  { type: Number, default: 0 },
  winPercentage: { type: Number, default: 0 },
  singles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
  },
  doubles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
    partner: { type: String, trim: true },
  },
  mixedDoubles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
    partner: { type: String, trim: true },
  },
}, { _id: false });

const pickleballTournamentSchema = new mongoose.Schema({
  rating:  { type: Number },            // DUPR / UTPR at time of tournaments
  matches: { type: Number, default: 0 },
  wins:    { type: Number, default: 0 },
  losses:  { type: Number, default: 0 },
  winPercentage: { type: Number, default: 0 },
  titlesWon: { type: Number, default: 0 },
  events: [
    {
      name:       { type: String, trim: true },
      year:       { type: Number },
      format:     { type: String, enum: ['singles', 'doubles', 'mixed doubles'] },
      level:      { type: String, trim: true },   // e.g. "4.5+", "Open"
      result:     { type: String, trim: true },   // e.g. "Gold Medal"
      sanctioned: { type: Boolean, default: false },
      organization: { type: String, trim: true }, // e.g. "USA Pickleball"
    },
  ],
}, { _id: false });

// ─────────────────────────────────────────────────────────────────────────────

const tennisLocalSchema = new mongoose.Schema({
  club:    { type: String, trim: true },
  league:  { type: String, trim: true },
  city:    { type: String, trim: true },
  utrRating: { type: Number },
  coach:   { type: String, trim: true },
  matches: { type: Number, default: 0 },
  wins:    { type: Number, default: 0 },
  losses:  { type: Number, default: 0 },
  winPercentage: { type: Number, default: 0 },
  singles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
  },
  doubles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
    partner: { type: String, trim: true },
  },
  serve: {
    aces:                    { type: Number, default: 0 },
    doubleFaults:            { type: Number, default: 0 },
    firstServePercentage:    { type: Number, default: 0 },
    firstServePointsWon:     { type: Number, default: 0 },
    secondServePointsWon:    { type: Number, default: 0 },
  },
  surface: {
    hard:  { matches: { type: Number, default: 0 }, wins: { type: Number, default: 0 } },
    clay:  { matches: { type: Number, default: 0 }, wins: { type: Number, default: 0 } },
    grass: { matches: { type: Number, default: 0 }, wins: { type: Number, default: 0 } },
  },
}, { _id: false });

const tennisTournamentSchema = new mongoose.Schema({
  ranking:      { type: Number },   // UTR / ITF ranking
  utrRating:    { type: Number },
  titlesWon:    { type: Number, default: 0 },
  matches:      { type: Number, default: 0 },
  wins:         { type: Number, default: 0 },
  losses:       { type: Number, default: 0 },
  winPercentage: { type: Number, default: 0 },
  serve: {
    aces:                    { type: Number, default: 0 },
    doubleFaults:            { type: Number, default: 0 },
    firstServePercentage:    { type: Number, default: 0 },
    firstServePointsWon:     { type: Number, default: 0 },
    secondServePointsWon:    { type: Number, default: 0 },
  },
  events: [
    {
      name:       { type: String, trim: true },
      year:       { type: Number },
      surface:    { type: String, enum: ['hard', 'clay', 'grass', 'indoor'] },
      category:   { type: String, trim: true },  // e.g. "4.5+", "Open", "Pro"
      result:     { type: String, trim: true },  // e.g. "Winner", "Semifinalist"
      sanctioned: { type: Boolean, default: false },
      prize:      { type: String, trim: true },
    },
  ],
}, { _id: false });

// ─────────────────────────────────────────────────────────────────────────────

const badmintonLocalSchema = new mongoose.Schema({
  club:    { type: String, trim: true },
  league:  { type: String, trim: true },
  city:    { type: String, trim: true },
  level:   { type: String, trim: true },   // e.g. "Advanced", "A Division"
  coach:   { type: String, trim: true },
  matches: { type: Number, default: 0 },
  wins:    { type: Number, default: 0 },
  losses:  { type: Number, default: 0 },
  winPercentage: { type: Number, default: 0 },
  singles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
  },
  doubles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
    partner: { type: String, trim: true },
  },
  mixedDoubles: {
    matches: { type: Number, default: 0 },
    wins:    { type: Number, default: 0 },
    losses:  { type: Number, default: 0 },
    partner: { type: String, trim: true },
  },
  performance: {
    topSmashedSpeed_kmh: { type: Number },
    rallyWinPercentage:  { type: Number, default: 0 },
    avgRallyLength:      { type: Number, default: 0 },
    serviceAccuracy:     { type: Number, default: 0 },
  },
}, { _id: false });

const badmintonTournamentSchema = new mongoose.Schema({
  bwfRanking:   { type: Number },
  bwfPoints:    { type: Number, default: 0 },
  titlesWon:    { type: Number, default: 0 },
  matches:      { type: Number, default: 0 },
  wins:         { type: Number, default: 0 },
  losses:       { type: Number, default: 0 },
  winPercentage: { type: Number, default: 0 },
  performance: {
    topSmashedSpeed_kmh: { type: Number },
    rallyWinPercentage:  { type: Number, default: 0 },
    avgRallyLength:      { type: Number, default: 0 },
  },
  events: [
    {
      name:        { type: String, trim: true },
      year:        { type: Number },
      level:       { type: String, trim: true },  // e.g. "Provincial", "National", "International"
      discipline:  { type: String, trim: true },  // e.g. "Men's Singles"
      result:      { type: String, trim: true },  // e.g. "Winner", "Semifinalist"
      bwfCategory: { type: String, trim: true },  // e.g. "Super 300"
      bwfPoints:   { type: Number, default: 0 },
      sanctioned:  { type: Boolean, default: false },
      prize:       { type: String, trim: true },
    },
  ],
}, { _id: false });

// ─── Sport-specific wrapper schemas ──────────────────────────────────────────

const cricketSchema = new mongoose.Schema({
  local:       { type: cricketLocalSchema,       default: () => ({}) },
  tournaments: { type: cricketTournamentSchema,  default: () => ({}) },
}, { _id: false });

const pickleballSchema = new mongoose.Schema({
  local:       { type: pickleballLocalSchema,       default: () => ({}) },
  tournaments: { type: pickleballTournamentSchema,  default: () => ({}) },
}, { _id: false });

const tennisSchema = new mongoose.Schema({
  local:       { type: tennisLocalSchema,       default: () => ({}) },
  tournaments: { type: tennisTournamentSchema,  default: () => ({}) },
}, { _id: false });

const badmintonSchema = new mongoose.Schema({
  local:       { type: badmintonLocalSchema,       default: () => ({}) },
  tournaments: { type: badmintonTournamentSchema,  default: () => ({}) },
}, { _id: false });

// ─── Root schema ─────────────────────────────────────────────────────────────

const sportsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sport: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    enum: ['cricket', 'pickleball', 'tennis', 'badminton'],
  },

  // Each sport section holds local & tournaments sub-documents.
  // Only the section matching `sport` will be populated.
  cricket:    { type: cricketSchema,    default: undefined },
  pickleball: { type: pickleballSchema, default: undefined },
  tennis:     { type: tennisSchema,     default: undefined },
  badminton:  { type: badmintonSchema,  default: undefined },

}, { timestamps: true });

// One profile per sport per user
sportsSchema.index({ userId: 1, sport: 1 }, { unique: true });

module.exports = mongoose.model('Sports', sportsSchema);
