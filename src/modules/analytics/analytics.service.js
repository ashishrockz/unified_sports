const User = require('../user/user.model');
const Room = require('../room/room.model');
const Match = require('../match/match.model');

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

module.exports = { getUserTrends, getMatchTrends, getRoomTrends, getSportPopularity };
