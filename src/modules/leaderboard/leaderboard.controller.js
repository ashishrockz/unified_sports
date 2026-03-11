const {
  getCricketBattingLeaderboard,
  getCricketBowlingLeaderboard,
  getWinsLeaderboard,
  getMostMatchesLeaderboard,
} = require('./leaderboard.service');

const cricketBattingHandler = async (req, res, next) => {
  try {
    const { period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const data = await getCricketBattingLeaderboard({ period, limit, scope, matchType, userId });
    res.json({ leaderboard: data, type: 'cricket_batting', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

const cricketBowlingHandler = async (req, res, next) => {
  try {
    const { period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const data = await getCricketBowlingLeaderboard({ period, limit, scope, matchType, userId });
    res.json({ leaderboard: data, type: 'cricket_bowling', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

const winsHandler = async (req, res, next) => {
  try {
    const { sport, period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const data = await getWinsLeaderboard({ sport, period, limit, scope, matchType, userId });
    res.json({ leaderboard: data, type: 'wins', sport: sport || 'all', period: period || 'alltime' });
  } catch (err) {
    next(err);
  }
};

const mostMatchesHandler = async (req, res, next) => {
  try {
    const { sport, period, limit, scope, matchType } = req.query;
    const userId = req.user?._id;
    const data = await getMostMatchesLeaderboard({ sport, period, limit, scope, matchType, userId });
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
