const { getUserTrends, getMatchTrends, getRoomTrends, getSportPopularity } = require('./analytics.service');

const getTrendsHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const [users, matches, rooms, sportPopularity] = await Promise.all([
      getUserTrends(days),
      getMatchTrends(days),
      getRoomTrends(days),
      getSportPopularity(),
    ]);
    res.json({ users, matches, rooms, sportPopularity });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTrendsHandler };
