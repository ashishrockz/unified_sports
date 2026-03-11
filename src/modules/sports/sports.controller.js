const {
  createSportProfile,
  getAllSportProfiles,
  getSportProfile,
  updateSportProfile,
  deleteSportProfile,
} = require('./sports.service');

const VALID_SPORTS = ['cricket', 'pickleball', 'tennis', 'badminton'];

const createHandler = async (req, res, next) => {
  try {
    const { sport, local, tournaments } = req.body;

    if (!sport) {
      return res.status(400).json({ message: 'sport is required' });
    }
    if (!VALID_SPORTS.includes(sport.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid sport. Must be one of: ${VALID_SPORTS.join(', ')}`,
      });
    }

    const profile = await createSportProfile(req.user._id, sport.toLowerCase(), local, tournaments);
    res.status(201).json(profile);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You already have a profile for this sport' });
    }
    next(err);
  }
};

const getAllHandler = async (req, res, next) => {
  try {
    const profiles = await getAllSportProfiles(req.user._id);
    res.json(profiles);
  } catch (err) {
    next(err);
  }
};

const getOneHandler = async (req, res, next) => {
  try {
    const profile = await getSportProfile(req.user._id, req.params.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
};

const updateHandler = async (req, res, next) => {
  try {
    const { local, tournaments } = req.body;

    if (local === undefined && tournaments === undefined) {
      return res.status(400).json({ message: 'Provide at least one of: local, tournaments' });
    }

    const profile = await updateSportProfile(req.user._id, req.params.id, local, tournaments);
    res.json(profile);
  } catch (err) {
    next(err);
  }
};

const deleteHandler = async (req, res, next) => {
  try {
    const result = await deleteSportProfile(req.user._id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getByUserHandler = async (req, res, next) => {
  try {
    const profiles = await getAllSportProfiles(req.params.userId);
    res.json(profiles);
  } catch (err) {
    next(err);
  }
};

module.exports = { createHandler, getAllHandler, getOneHandler, updateHandler, deleteHandler, getByUserHandler };
