const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../modules/user/user.model');
const Room = require('../modules/room/room.model');

/**
 * WebSocket Events Reference
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * CLIENT → SERVER (emit)
 *   join_room      { roomId }              — subscribe to a room's real-time feed
 *   leave_room     { roomId }              — unsubscribe
 *
 * SERVER → CLIENT (on)
 *   room:updated          Room document    — player added/removed, status changed
 *   toss:completed        Room document    — toss result recorded
 *   match:started         Match document   — match status → active
 *   match:score_update    Match document   — ball recorded / point added
 *   match:innings_break   Match document   — cricket innings complete, break
 *   match:innings_resume  Match document   — cricket innings resumed
 *   match:super_over      Match document   — cricket tie → super over started
 *   match:set_break       Match document   — racket set complete, break
 *   match:set_resume      Match document   — racket set resumed
 *   match:completed       Match document   — final result available
 *   match:abandoned       Match document   — match abandoned
 *   error                 { message }      — server-side error
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * All events are scoped to a socket.io room named `room:{roomId}`.
 * Authentication: JWT token passed via socket handshake auth.token
 */

let io;

const init = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  // ── Auth middleware ──────────────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('name username status role');
      if (!user) return next(new Error('User not found'));
      if (user.status !== 'active') return next(new Error('Account not active'));

      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection handler ───────────────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.user;

    // Join a match room's real-time channel
    socket.on('join_room', async ({ roomId }) => {
      try {
        const room = await Room.findById(roomId);
        if (!room) return socket.emit('error', { message: 'Room not found' });

        await socket.join(`room:${roomId}`);
        socket.emit('joined', { roomId, message: 'Subscribed to room updates' });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
    });
  });

  return io;
};

// ── Broadcast helpers (called from services after DB updates) ─────────────────

const broadcast = (roomId, event, data) => {
  if (!io) return;
  io.to(`room:${roomId}`).emit(event, data);
};

const emitRoomUpdated     = (roomId, room)  => broadcast(roomId, 'room:updated',         room);
const emitTossCompleted   = (roomId, room)  => broadcast(roomId, 'toss:completed',        room);
const emitMatchStarted    = (roomId, match) => broadcast(roomId, 'match:started',         match);
const emitScoreUpdate     = (roomId, match) => {
  const evt =
    match.status === 'innings_break' ? 'match:innings_break' :
    match.status === 'super_over'    ? 'match:super_over'    :
    match.status === 'set_break'     ? 'match:set_break'     :
    match.status === 'completed'     ? 'match:completed'     :
    match.status === 'abandoned'     ? 'match:abandoned'     :
                                       'match:score_update';
  broadcast(roomId, evt, match);
};

const getIo = () => io;

module.exports = { init, getIo, emitRoomUpdated, emitTossCompleted, emitMatchStarted, emitScoreUpdate };
