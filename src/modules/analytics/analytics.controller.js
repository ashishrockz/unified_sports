const {
  getUserTrends, getMatchTrends, getRoomTrends, getSportPopularity,
  getPlatformSummary, getEngagement, getGrowth, getRevenue,
  getMatchAnalytics,
} = require('./analytics.service');

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

const getPlatformSummaryHandler = async (req, res, next) => {
  try {
    const summary = await getPlatformSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

const getEngagementHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const engagement = await getEngagement(days);
    res.json(engagement);
  } catch (err) {
    next(err);
  }
};

const getGrowthHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const growth = await getGrowth(days);
    res.json(growth);
  } catch (err) {
    next(err);
  }
};

const getRevenueHandler = async (req, res, next) => {
  try {
    const revenue = await getRevenue();
    res.json(revenue);
  } catch (err) {
    next(err);
  }
};

const getMatchAnalyticsHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const analytics = await getMatchAnalytics(days);
    res.json(analytics);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getTrendsHandler,
  getPlatformSummaryHandler,
  getEngagementHandler,
  getGrowthHandler,
  getRevenueHandler,
  getMatchAnalyticsHandler,
};
