const Sports = require('./sports.model');

/**
 * Build the sport-specific update payload.
 * Writes local & tournaments into the correct top-level sport key.
 * e.g. sport = 'cricket'  →  { cricket: { local, tournaments } }
 */
const buildSportData = (sport, local = {}, tournaments = {}) => ({
  [sport]: { local, tournaments },
});

const createSportProfile = async (userId, sport, local = {}, tournaments = {}) => {
  const profile = await Sports.create({
    userId,
    sport,
    ...buildSportData(sport, local, tournaments),
  });
  return profile;
};

const getAllSportProfiles = async (userId) => {
  return Sports.find({ userId }).select('-__v');
};

const getSportProfile = async (userId, id) => {
  const profile = await Sports.findOne({ _id: id, userId }).select('-__v');
  if (!profile) {
    throw Object.assign(new Error('Sport profile not found'), { status: 404 });
  }
  return profile;
};

const updateSportProfile = async (userId, id, local, tournaments) => {
  // Only include fields that were actually sent
  const update = {};
  const sport = await Sports.findOne({ _id: id, userId }).select('sport');
  if (!sport) {
    throw Object.assign(new Error('Sport profile not found'), { status: 404 });
  }

  if (local !== undefined)       update[`${sport.sport}.local`]       = local;
  if (tournaments !== undefined) update[`${sport.sport}.tournaments`] = tournaments;

  const profile = await Sports.findOneAndUpdate(
    { _id: id, userId },
    { $set: update },
    { new: true, runValidators: true }
  ).select('-__v');

  return profile;
};

const deleteSportProfile = async (userId, id) => {
  const profile = await Sports.findOneAndDelete({ _id: id, userId });
  if (!profile) {
    throw Object.assign(new Error('Sport profile not found'), { status: 404 });
  }
  return { message: 'Sport profile deleted' };
};

module.exports = {
  createSportProfile,
  getAllSportProfiles,
  getSportProfile,
  updateSportProfile,
  deleteSportProfile,
};
