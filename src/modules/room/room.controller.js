const svc = require('./room.service');

const createHandler = async (req, res, next) => {
  try {
    const room = await svc.createRoom(req.user._id, req.body);
    res.status(201).json(room);
  } catch (err) { next(err); }
};

const getAllHandler = async (req, res, next) => {
  try {
    const { status, sportTypeId, page, limit } = req.query;
    res.json(await svc.getRooms({ status, sportTypeId, page, limit }));
  } catch (err) { next(err); }
};

const getByIdHandler = async (req, res, next) => {
  try {
    res.json(await svc.getRoomById(req.params.roomId));
  } catch (err) { next(err); }
};

const addFriendPlayerHandler = async (req, res, next) => {
  try {
    res.json(await svc.addFriendPlayer(req.params.roomId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const addStaticPlayerHandler = async (req, res, next) => {
  try {
    res.json(await svc.addStaticPlayer(req.params.roomId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const removePlayerHandler = async (req, res, next) => {
  try {
    res.json(await svc.removePlayer(req.params.roomId, req.user._id, req.params.slotId));
  } catch (err) { next(err); }
};

const lockRoomHandler = async (req, res, next) => {
  try {
    res.json(await svc.lockRoom(req.params.roomId, req.user._id));
  } catch (err) { next(err); }
};

const tossHandler = async (req, res, next) => {
  try {
    res.json(await svc.performToss(req.params.roomId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const tossChoiceHandler = async (req, res, next) => {
  try {
    res.json(await svc.tossChoice(req.params.roomId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const startHandler = async (req, res, next) => {
  try {
    res.json(await svc.assignTeamsAndStart(req.params.roomId, req.user._id, req.body));
  } catch (err) { next(err); }
};

const switchTeamHandler = async (req, res, next) => {
  try {
    res.json(await svc.switchPlayerTeam(req.params.roomId, req.user._id, req.params.slotId, req.body));
  } catch (err) { next(err); }
};

const setCaptainHandler = async (req, res, next) => {
  try {
    res.json(await svc.setCaptain(req.params.roomId, req.user._id, req.params.slotId));
  } catch (err) { next(err); }
};

const setRoleHandler = async (req, res, next) => {
  try {
    res.json(await svc.setPlayerRole(req.params.roomId, req.user._id, req.params.slotId, req.body));
  } catch (err) { next(err); }
};

const abandonHandler = async (req, res, next) => {
  try {
    res.json(await svc.abandonRoom(req.params.roomId, req.user._id));
  } catch (err) { next(err); }
};

module.exports = {
  createHandler,
  getAllHandler,
  getByIdHandler,
  addFriendPlayerHandler,
  addStaticPlayerHandler,
  removePlayerHandler,
  lockRoomHandler,
  tossHandler,
  tossChoiceHandler,
  startHandler,
  switchTeamHandler,
  setCaptainHandler,
  setRoleHandler,
  abandonHandler,
};
