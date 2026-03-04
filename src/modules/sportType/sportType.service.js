const SportType = require('./sportType.model');
const { fail }  = require('../../utils/AppError');

// Default configs per sport — used as sensible starting point
const SPORT_DEFAULTS = {
  cricket: {
    minPlayers: 4, maxPlayers: 22, teamSize: 11,
    innings: 2, oversPerInnings: 20,
    tossOptions: ['bat', 'bowl'],
    roles: [
      { name: 'batsman', perTeam: 6, required: true },
      { name: 'bowler',  perTeam: 4, required: true },
      { name: 'wicketkeeper', perTeam: 1, required: true },
      { name: 'all-rounder',  perTeam: 0, required: false },
    ],
  },
  tennis: {
    minPlayers: 2, maxPlayers: 4, teamSize: 1,
    sets: 3, gamesPerSet: 6, deuceEnabled: true,
    tossOptions: ['serve', 'receive', 'court_A', 'court_B'],
    roles: [{ name: 'player', perTeam: 1, required: true }],
  },
  badminton: {
    minPlayers: 2, maxPlayers: 4, teamSize: 1,
    pointsPerGame: 21, gamesPerMatch: 3,
    tossOptions: ['serve', 'receive', 'court_A', 'court_B'],
    roles: [{ name: 'player', perTeam: 1, required: true }],
  },
  pickleball: {
    minPlayers: 2, maxPlayers: 4, teamSize: 1,
    pointsToWin: 11, winByTwo: true,
    tossOptions: ['serve', 'receive', 'side_A', 'side_B'],
    roles: [{ name: 'player', perTeam: 1, required: true }],
  },
};

const createSportType = async (data) => {
  const { name, sport, description, config } = data;
  if (!name || !sport) fail('name and sport are required', 400);

  // Merge defaults with provided config
  const defaults = SPORT_DEFAULTS[sport] || {};
  const mergedConfig = { ...defaults, ...config };

  const st = await SportType.create({
    name,
    sport,
    description,
    config: mergedConfig,
  });
  return st;
};

const getSportTypes = async ({ search = '', isActive, page = 1, limit = 50 } = {}) => {
  const filter = {};
  if (search.trim()) {
    const r = new RegExp(search.trim(), 'i');
    filter.$or = [{ name: r }, { slug: r }, { sport: r }];
  }
  if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;

  const [types, total] = await Promise.all([
    SportType.find(filter).sort({ sport: 1, name: 1 }).skip((Number(page) - 1) * Number(limit)).limit(Number(limit)),
    SportType.countDocuments(filter),
  ]);

  return { sportTypes: types, pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) } };
};

const getSportTypeById = async (sportTypeId) => {
  const st = await SportType.findById(sportTypeId);
  if (!st) fail('Sport type not found', 404);
  return st;
};

const getSportTypeBySlug = async (slug) => {
  const st = await SportType.findOne({ slug, isActive: true });
  if (!st) fail('Sport type not found', 404);
  return st;
};

const updateSportType = async (sportTypeId, updates) => {
  const allowed = ['name', 'description', 'config', 'isActive'];
  const filtered = {};
  allowed.forEach((k) => { if (updates[k] !== undefined) filtered[k] = updates[k]; });

  const st = await SportType.findByIdAndUpdate(
    sportTypeId,
    filtered,
    { new: true, runValidators: true }
  );
  if (!st) fail('Sport type not found', 404);
  return st;
};

const deleteSportType = async (sportTypeId) => {
  const st = await SportType.findByIdAndDelete(sportTypeId);
  if (!st) fail('Sport type not found', 404);
  return { message: `Sport type "${st.name}" deleted` };
};

const getDefaultConfig = (sport) => {
  const d = SPORT_DEFAULTS[sport];
  if (!d) fail(`Unknown sport: ${sport}`, 400);
  return d;
};

module.exports = {
  createSportType,
  getSportTypes,
  getSportTypeById,
  getSportTypeBySlug,
  updateSportType,
  deleteSportType,
  getDefaultConfig,
};
