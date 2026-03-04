const Room        = require('./room.model');
const SportType   = require('../sportType/sportType.model');
const Friend      = require('../friends/friend.model');
const User        = require('../user/user.model');
const { fail }    = require('../../utils/AppError');
const matchService = require('../match/match.service');
const ws          = require('../../websocket');

// ── Helpers ───────────────────────────────────────────────────────────────────

const assertCreator = (room, userId) => {
  const creatorId = room.creator._id || room.creator;
  if (creatorId.toString() !== userId.toString()) {
    fail('Only the room creator can perform this action', 403);
  }
};

const assertStatus = (room, ...statuses) => {
  if (!statuses.includes(room.status)) {
    fail(`Action not allowed in room status: ${room.status}`, 400);
  }
};

const getRoom = async (roomId) => {
  const room = await Room.findById(roomId)
    .populate('creator', 'name username avatar')
    .populate('sportTypeId', 'name slug sport config')
    .populate('players.userId', 'name username avatar');
  if (!room) fail('Room not found', 404);
  return room;
};

// ── Room CRUD ─────────────────────────────────────────────────────────────────

const createRoom = async (userId, { sportTypeId, name }) => {
  if (!sportTypeId || !name) fail('sportTypeId and name are required', 400);

  const sportType = await SportType.findOne({ _id: sportTypeId, isActive: true });
  if (!sportType) fail('Sport type not found', 404);

  // A user may only be in ONE active room at a time
  const activeRoom = await Room.findOne({
    'players.userId': userId,
    status: { $in: ['waiting', 'toss_pending', 'active'] },
  });
  if (activeRoom) fail('You are already in an active room. Leave or complete it first.', 409);

  const room = await Room.create({
    sportTypeId,
    name,
    creator: userId,
    maxPlayers: sportType.config.maxPlayers,
    minPlayers: sportType.config.minPlayers,
    players: [{
      userId,
      name: 'Creator',
      isStatic: false,
    }],
  });

  const user = await User.findById(userId).select('name username');
  room.players[0].name = user.name || user.username || 'Player 1';
  await room.save();

  return getRoom(room._id);
};

const getRooms = async ({ status, sportTypeId, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;
  if (sportTypeId) filter.sportTypeId = sportTypeId;

  const [rooms, total] = await Promise.all([
    Room.find(filter)
      .populate('creator', 'name username avatar')
      .populate('sportTypeId', 'name slug sport')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    Room.countDocuments(filter),
  ]);

  return {
    rooms,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
  };
};

const getRoomById = async (roomId) => getRoom(roomId);

// ── Player management ─────────────────────────────────────────────────────────

const addFriendPlayer = async (roomId, creatorId, { friendUserId, playerName }) => {
  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'waiting');

  if (room.players.length >= room.maxPlayers) fail('Room is full', 400);

  const friendship = await Friend.findOne({
    status: 'accepted',
    $or: [
      { requester: creatorId, recipient: friendUserId },
      { requester: friendUserId, recipient: creatorId },
    ],
  });
  if (!friendship) fail('You can only add accepted friends', 403);

  const friend = await User.findById(friendUserId).select('name username');
  if (!friend) fail('User not found', 404);

  if (room.players.some((p) => p.userId && p.userId.toString() === friendUserId.toString())) {
    fail('This player is already in the room', 409);
  }

  // Already in another active room?
  const activeElsewhere = await Room.findOne({
    _id: { $ne: roomId },
    'players.userId': friendUserId,
    status: { $in: ['waiting', 'toss_pending', 'active'] },
  });
  if (activeElsewhere) fail('This player is already in another active room', 409);

  room.players.push({
    userId: friendUserId,
    name: playerName || friend.name || friend.username,
    isStatic: false,
  });
  await room.save();

  const updated = await getRoom(roomId);
  ws.emitRoomUpdated(roomId, updated);
  return updated;
};

const addStaticPlayer = async (roomId, creatorId, { name }) => {
  if (!name) fail('name is required for static player', 400);

  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'waiting');

  if (room.players.length >= room.maxPlayers) fail('Room is full', 400);

  room.players.push({ name, isStatic: true });
  await room.save();

  const updated = await getRoom(roomId);
  ws.emitRoomUpdated(roomId, updated);
  return updated;
};

const removePlayer = async (roomId, creatorId, slotId) => {
  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'waiting');

  const idx = room.players.findIndex((p) => p._id.toString() === slotId);
  if (idx === -1) fail('Player slot not found', 404);

  if (room.players[idx].userId && room.players[idx].userId.toString() === creatorId.toString()) {
    fail('Creator cannot be removed from the room', 400);
  }

  room.players.splice(idx, 1);
  await room.save();
  const updated = await getRoom(roomId);
  ws.emitRoomUpdated(roomId, updated);
  return updated;
};

// ── Toss flow ─────────────────────────────────────────────────────────────────

const lockRoom = async (roomId, creatorId) => {
  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'waiting');

  const activePlayers = room.players.filter((p) => p.isActive);
  if (activePlayers.length < room.minPlayers) {
    fail(`Need at least ${room.minPlayers} players to start (currently ${activePlayers.length})`, 400);
  }

  room.status = 'toss_pending';
  await room.save();
  const updated = await getRoom(roomId);
  ws.emitRoomUpdated(roomId, updated);
  return updated;
};

const performToss = async (roomId, creatorId, { callerSlotId, call, opponentSlotId }) => {
  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'toss_pending');

  if (!callerSlotId || !call || !opponentSlotId) {
    fail('callerSlotId, call (heads|tails), and opponentSlotId are required', 400);
  }

  if (!['heads', 'tails'].includes(call)) fail('call must be heads or tails', 400);

  const callerSlot = room.players.id(callerSlotId);
  const opponentSlot = room.players.id(opponentSlotId);
  if (!callerSlot) fail('Caller player slot not found', 404);
  if (!opponentSlot) fail('Opponent player slot not found', 404);

  const coinResult = Math.random() < 0.5 ? 'heads' : 'tails';
  const callerWon = coinResult === call;
  const winnerSlot = callerWon ? callerSlot : opponentSlot;

  room.toss = {
    initiatedBy:  creatorId,
    coinResult,
    call,
    callerSlotId,
    winnerSlotId:  winnerSlot._id,
    winnerUserId:  winnerSlot.userId || null,
    choice:        null,
    completedAt:   null,
  };
  await room.save();
  const updated = await getRoom(roomId);
  ws.emitTossCompleted(roomId, updated);
  return updated;
};

const tossChoice = async (roomId, creatorId, { choice }) => {
  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'toss_pending');

  if (!room.toss || room.toss.choice) {
    fail('Toss not flipped yet or choice already made', 400);
  }

  if (!choice) fail('choice is required', 400);

  const sportType = await SportType.findById(room.sportTypeId);
  if (!sportType.config.tossOptions.includes(choice)) {
    fail(`Invalid toss choice. Valid options: ${sportType.config.tossOptions.join(', ')}`, 400);
  }

  room.toss.choice = choice;
  room.toss.completedAt = new Date();
  await room.save();
  const updated = await getRoom(roomId);
  ws.emitRoomUpdated(roomId, updated);
  return updated;
};

const assignTeamsAndStart = async (roomId, creatorId, { assignments }) => {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    fail('assignments array is required', 400);
  }

  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'toss_pending');

  if (!room.toss || !room.toss.completedAt) {
    fail('Toss must be completed before starting the match', 400);
  }

  for (const a of assignments) {
    const slot = room.players.id(a.slotId);
    if (!slot) continue;
    if (!['A', 'B'].includes(a.team)) fail(`Invalid team "${a.team}" for slot ${a.slotId}`, 400);
    slot.team = a.team;
    if (a.role) slot.role = a.role;
  }

  room.status = 'active';
  await room.save();

  const match = await matchService.initMatch(roomId);
  room.matchId = match._id;
  await room.save();

  const updated = await getRoom(roomId);
  ws.emitMatchStarted(roomId, match);
  return updated;
};

const abandonRoom = async (roomId, creatorId) => {
  const room = await getRoom(roomId);
  assertCreator(room, creatorId);
  assertStatus(room, 'waiting', 'toss_pending', 'active');

  room.status = 'abandoned';
  await room.save();

  const updated = await getRoom(roomId);
  ws.emitRoomUpdated(roomId, updated);
  return updated;
};

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  addFriendPlayer,
  addStaticPlayer,
  removePlayer,
  lockRoom,
  performToss,
  tossChoice,
  assignTeamsAndStart,
  abandonRoom,
};
