const {
  getCricketBattingLeaderboard,
  getCricketBowlingLeaderboard,
  getWinsLeaderboard,
  getMostMatchesLeaderboard,
} = require('./leaderboard.service');
const { cacheThrough } = require('../../config/cache');

const cricketBattingHandler = async (req, res, next) => {
  try {
    const { period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const key = `lb:batting:${period || 'alltime'}:${limit || 20}:${scope || 'all'}:${matchType || 'all'}:${['friends', 'local', 'country'].includes(scope) ? userId : ''}`;
    const data = await cacheThrough('medium', key, () =>
      getCricketBattingLeaderboard({ period, limit, scope, matchType, userId })
    );
    res.json({ leaderboard: data, type: 'cricket_batting', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

const cricketBowlingHandler = async (req, res, next) => {
  try {
    const { period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const key = `lb:bowling:${period || 'alltime'}:${limit || 20}:${scope || 'all'}:${matchType || 'all'}:${['friends', 'local', 'country'].includes(scope) ? userId : ''}`;
    const data = await cacheThrough('medium', key, () =>
      getCricketBowlingLeaderboard({ period, limit, scope, matchType, userId })
    );
    res.json({ leaderboard: data, type: 'cricket_bowling', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

const winsHandler = async (req, res, next) => {
  try {
    const { sport, period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const key = `lb:wins:${sport || 'all'}:${period || 'alltime'}:${limit || 20}:${scope || 'all'}:${matchType || 'all'}:${['friends', 'local', 'country'].includes(scope) ? userId : ''}`;
    const data = await cacheThrough('medium', key, () =>
      getWinsLeaderboard({ sport, period, limit, scope, matchType, userId })
    );
    res.json({ leaderboard: data, type: 'wins', sport: sport || 'all', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

const mostMatchesHandler = async (req, res, next) => {
  try {
    const { sport, period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const key = `lb:matches:${sport || 'all'}:${period || 'alltime'}:${limit || 20}:${scope || 'all'}:${matchType || 'all'}:${['friends', 'local', 'country'].includes(scope) ? userId : ''}`;
    const data = await cacheThrough('medium', key, () =>
      getMostMatchesLeaderboard({ sport, period, limit, scope, matchType, userId })
    );
    res.json({ leaderboard: data, type: 'most_matches', sport: sport || 'all', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  cricketBattingHandler,
  cricketBowlingHandler,
  winsHandler,
  mostMatchesHandler,
};
