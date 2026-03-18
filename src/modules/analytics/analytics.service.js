const User = require('../user/user.model');
const Room = require('../room/room.model');
const Match = require('../match/match.model');
const SportType = require('../sportType/sportType.model');

/**
 * Get daily registration trends for the last N days.
 */
const getUserTrends = async (days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: { role: 'user', createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', count: 1, _id: 0 } },
  ];

  return User.aggregate(pipeline);
};

/**
 * Get match trends (matches created per day) for the last N days.
 */
const getMatchTrends = async (days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', count: 1, _id: 0 } },
  ];

  return Match.aggregate(pipeline);
};

/**
 * Get room trends (rooms created per day) for the last N days.
 */
const getRoomTrends = async (days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const pipeline = [
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', count: 1, _id: 0 } },
  ];

  return Room.aggregate(pipeline);
};

/**
 * Get sport popularity — matches per sport type.
 */
const getSportPopularity = async () => {
  const pipeline = [
    { $group: { _id: '$sport', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $project: { sport: '$_id', count: 1, _id: 0 } },
  ];

  return Match.aggregate(pipeline);
};

// ── Platform summary — totals for top-level KPI cards ────────────────────────

const getPlatformSummary = async () => {
  const [totalUsers, totalMatches, totalRooms, totalSportTypes] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Match.countDocuments(),
    Room.countDocuments(),
    SportType.countDocuments({ isActive: true }),
  ]);

  return { totalUsers, totalMatches, totalRooms, totalSportTypes };
};

// ── Engagement — active users, matches per user, avg duration ────────────────

const getEngagement = async (days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  // Active users = users who were involved in a room created in the period
  const activeRooms = await Room.find({ createdAt: { $gte: startDate } }).select('players');
  const activeUserIds = new Set();
  for (const room of activeRooms) {
    for (const p of room.players) {
      if (p.userId) activeUserIds.add(p.userId.toString());
    }
  }
  const activeUsers = activeUserIds.size;

  // Matches per user
  const totalUsers = await User.countDocuments({ role: 'user' });
  const matchesInPeriod = await Match.countDocuments({ createdAt: { $gte: startDate } });
  const matchesPerUser = totalUsers > 0 ? matchesInPeriod / totalUsers : 0;

  // Avg session duration (estimated from completed match durations)
  const durationPipeline = [
    { $match: { status: 'completed', 'result.completedAt': { $exists: true }, createdAt: { $gte: startDate } } },
    { $project: { duration: { $subtract: ['$result.completedAt', '$createdAt'] } } },
    { $group: { _id: null, avg: { $avg: '$duration' } } },
  ];
  const durationResult = await Match.aggregate(durationPipeline);
  const avgSessionDuration = durationResult.length > 0 ? Math.round((durationResult[0].avg || 0) / 1000) : 0; // seconds

  return { activeUsers, matchesPerUser, avgSessionDuration };
};

// ── Growth — compare current period vs previous period ───────────────────────

const getGrowth = async (days = 30) => {
  const now = new Date();

  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - days);
  currentStart.setHours(0, 0, 0, 0);

  const previousStart = new Date(currentStart);
  previousStart.setDate(previousStart.getDate() - days);

  const [currentUsers, previousUsers, currentMatches, previousMatches] = await Promise.all([
    User.countDocuments({ role: 'user', createdAt: { $gte: currentStart } }),
    User.countDocuments({ role: 'user', createdAt: { $gte: previousStart, $lt: currentStart } }),
    Match.countDocuments({ createdAt: { $gte: currentStart } }),
    Match.countDocuments({ createdAt: { $gte: previousStart, $lt: currentStart } }),
  ]);

  const calcRate = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  return {
    userGrowth: { current: currentUsers, previous: previousUsers, rate: calcRate(currentUsers, previousUsers) },
    matchGrowth: { current: currentMatches, previous: previousMatches, rate: calcRate(currentMatches, previousMatches) },
  };
};

// ── Revenue — stub (no payment system yet) ───────────────────────────────────

const getRevenue = async () => {
  return { totalRevenue: 0, subscriptions: 0, message: 'Revenue tracking coming soon' };
};

// ── Match analytics — completion rate, avg duration, peak hours ───────────────

const getMatchAnalytics = async (days = 30) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const filter = { createdAt: { $gte: startDate } };

  // Status breakdown
  const statusBreakdown = await Match.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ]);

  const total = statusBreakdown.reduce((sum, s) => sum + s.count, 0);
  const completed = statusBreakdown.find((s) => s.status === 'completed')?.count || 0;
  const abandoned = statusBreakdown.find((s) => s.status === 'abandoned')?.count || 0;
  const completionRate = total > 0 ? ((completed / total) * 100) : 0;
  const abandonRate = total > 0 ? ((abandoned / total) * 100) : 0;

  // Average duration by sport (completed matches only)
  const avgDurationBySport = await Match.aggregate([
    { $match: { ...filter, status: 'completed', 'result.completedAt': { $exists: true } } },
    { $project: { sport: 1, duration: { $subtract: ['$result.completedAt', '$createdAt'] } } },
    { $group: { _id: '$sport', avgDuration: { $avg: '$duration' }, count: { $sum: 1 } } },
    { $project: { sport: '$_id', avgDurationMinutes: { $round: [{ $divide: ['$avgDuration', 60000] }, 1] }, count: 1, _id: 0 } },
    { $sort: { count: -1 } },
  ]);

  // Peak usage hours (hour of day when most matches are created)
  const peakHours = await Match.aggregate([
    { $match: filter },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
    { $project: { hour: '$_id', count: 1, _id: 0 } },
  ]);

  return {
    statusBreakdown,
    total,
    completionRate: Math.round(completionRate * 10) / 10,
    abandonRate: Math.round(abandonRate * 10) / 10,
    avgDurationBySport,
    peakHours,
  };
};

module.exports = {
  getUserTrends, getMatchTrends, getRoomTrends, getSportPopularity,
  getPlatformSummary, getEngagement, getGrowth, getRevenue,
  getMatchAnalytics,
};
