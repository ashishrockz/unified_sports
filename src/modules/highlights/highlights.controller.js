const { getMatchHighlights } = require('./highlights.service');

const getHighlightsHandler = async (req, res, next) => {
  try {
    const data = await getMatchHighlights(req.params.matchId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

module.exports = { getHighlightsHandler };
