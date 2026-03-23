const {
  getUserTrends, getMatchTrends, getRoomTrends, getSportPopularity,
  getPlatformSummary, getEngagement, getGrowth, getRevenue,
  getMatchAnalytics,
} = require('./analytics.service');
const { cacheThrough } = require('../../config/cache');

const getTrendsHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const result = await cacheThrough('medium', `analytics:trends:${days}`, async () => {
      const [users, matches, rooms, sportPopularity] = await Promise.all([
        getUserTrends(days),
        getMatchTrends(days),
        getRoomTrends(days),
        getSportPopularity(),
      ]);
      return { users, matches, rooms, sportPopularity };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getPlatformSummaryHandler = async (req, res, next) => {
  try {
    const summary = await cacheThrough('short', 'analytics:platform-summary', () => getPlatformSummary());
    res.json(summary);
  } catch (err) {
    next(err);
  }
};

const getEngagementHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const engagement = await cacheThrough('medium', `analytics:engagement:${days}`, () => getEngagement(days));
    res.json(engagement);
  } catch (err) {
    next(err);
  }
};

const getGrowthHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const growth = await cacheThrough('medium', `analytics:growth:${days}`, () => getGrowth(days));
    res.json(growth);
  } catch (err) {
    next(err);
  }
};

const getRevenueHandler = async (req, res, next) => {
  try {
    const revenue = await cacheThrough('long', 'analytics:revenue', () => getRevenue());
    res.json(revenue);
  } catch (err) {
    next(err);
  }
};

const getMatchAnalyticsHandler = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const analytics = await cacheThrough('medium', `analytics:match:${days}`, () => getMatchAnalytics(days));
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
