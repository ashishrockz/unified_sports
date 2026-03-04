const svc = require('./match.service');

const getByRoomHandler = async (req, res, next) => {
  try {
    res.json(await svc.getMatchByRoom(req.params.roomId));
  } catch (err) { next(err); }
};

const getByIdHandler = async (req, res, next) => {
  try {
    res.json(await svc.getMatch(req.params.matchId));
  } catch (err) { next(err); }
};

const startHandler = async (req, res, next) => {
  try {
    res.json(await svc.startMatch(req.params.matchId, req.user._id));
  } catch (err) { next(err); }
};

const completeHandler = async (req, res, next) => {
  try {
    res.json(await svc.completeMatch(req.params.matchId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const abandonHandler = async (req, res, next) => {
  try {
    res.json(await svc.abandonMatch(req.params.matchId, req.user._id));
  } catch (err) { next(err); }
};

const lineupHandler = async (req, res, next) => {
  try {
    res.json(await svc.setBattingLineup(req.params.matchId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const ballHandler = async (req, res, next) => {
  try {
    res.json(await svc.recordBall(req.params.matchId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const resumeInningsHandler = async (req, res, next) => {
  try {
    res.json(await svc.resumeInnings(req.params.matchId, req.user._id));
  } catch (err) { next(err); }
};

const pointHandler = async (req, res, next) => {
  try {
    res.json(await svc.recordPoint(req.params.matchId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const resumeSetHandler = async (req, res, next) => {
  try {
    res.json(await svc.resumeSet(req.params.matchId, req.user._id));
  } catch (err) { next(err); }
};

const getCommentaryHandler = async (req, res, next) => {
  try {
    const match = await svc.getMatch(req.params.matchId);
    res.json({
      matchId: match._id,
      status: match.status,
      commentary: match.commentary || [],
    });
  } catch (err) { next(err); }
};

module.exports = {
  getByRoomHandler, getByIdHandler,
  startHandler, completeHandler, abandonHandler,
  lineupHandler, ballHandler, resumeInningsHandler,
  pointHandler, resumeSetHandler,
  getCommentaryHandler,
};
