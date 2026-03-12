const {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
  getPlayerStats,
  checkAvailability,
} = require('./user.service');

const getProfileHandler = async (req, res, next) => {
  try {
    const user = await getProfile(req.user._id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const updateProfileHandler = async (req, res, next) => {
  try {
    const user = await updateProfile(req.user._id, req.body);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const getAllUsersHandler = async (req, res, next) => {
  try {
    const { search, page, limit } = req.query;
    const result = await getAllUsers(req.user._id, { search, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getUserByIdHandler = async (req, res, next) => {
  try {
    const profile = await getUserById(req.user._id, req.params.userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
};

const getPlayerStatsHandler = async (req, res, next) => {
  try {
    const stats = await getPlayerStats(req.params.userId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

const checkAvailabilityHandler = async (req, res, next) => {
  try {
    const { field, value } = req.query;
    const result = await checkAvailability(field, value, req.user?._id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProfileHandler,
  updateProfileHandler,
  getAllUsersHandler,
  getUserByIdHandler,
  getPlayerStatsHandler,
  checkAvailabilityHandler,
};
