const Notification = require('./notification.model');
const User = require('../user/user.model');
const { emitNotification } = require('../../websocket/index');

const USER_FIELDS = 'name username avatar';

// ── Core CRUD ────────────────────────────────────────────────────────────────

/**
 * Create a notification, persist it, and push via WebSocket.
 */
const createNotification = async ({ recipient, actor, type, title, body, data = {} }) => {
  const notification = await Notification.create({ recipient, actor, type, title, body, data });

  // Populate actor for the real-time push
  const populated = await Notification.findById(notification._id)
    .populate('actor', USER_FIELDS);

  emitNotification(recipient.toString(), populated);

  return populated;
};

/**
 * Get paginated notifications for a user.
 */
const getNotifications = async (userId, { page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ recipient: userId })
      .populate('actor', USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Notification.countDocuments({ recipient: userId }),
    Notification.countDocuments({ recipient: userId, read: false }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get unread count.
 */
const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipient: userId, read: false });
};

/**
 * Mark a single notification as read.
 */
const markAsRead = async (userId, notificationId) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId, read: false },
    { read: true, readAt: new Date() },
    { new: true },
  );
  return notification;
};

/**
 * Mark all notifications as read for a user.
 */
const markAllAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { recipient: userId, read: false },
    { read: true, readAt: new Date() },
  );
  return { marked: result.modifiedCount };
};

// ── Event triggers (called from other services) ─────────────────────────────

/**
 * Notify all players in a match that the match has completed.
 * @param {Object} match — populated match document
 * @param {Array<string>} playerUserIds — userIds of all players in the match
 */
const notifyMatchCompleted = async (match, playerUserIds) => {
  const resultDesc = match.result?.description || 'Match completed';

  const promises = playerUserIds.map((userId) =>
    createNotification({
      recipient: userId,
      actor: null,
      type: 'match_completed',
      title: 'Match Completed',
      body: resultDesc,
      data: { matchId: match._id, roomId: match.roomId },
    }),
  );

  await Promise.allSettled(promises);
};

/**
 * Notify a user that they have been added to a match room.
 * @param {string} recipientId — the user being added
 * @param {string} actorId — the user who added them
 * @param {Object} room — the room document
 */
const notifyAddedToMatch = async (recipientId, actorId, room) => {
  const actor = await User.findById(actorId).select('name');
  const actorName = actor?.name || 'Someone';

  return createNotification({
    recipient: recipientId,
    actor: actorId,
    type: 'added_to_match',
    title: 'Added to Match',
    body: `${actorName} added you to a match room`,
    data: { roomId: room._id },
  });
};

/**
 * Notify a user that they received a friend request.
 */
const notifyFriendRequestReceived = async (recipientId, actorId, friendshipId) => {
  const actor = await User.findById(actorId).select('name');
  const actorName = actor?.name || 'Someone';

  return createNotification({
    recipient: recipientId,
    actor: actorId,
    type: 'friend_request_received',
    title: 'Friend Request',
    body: `${actorName} sent you a friend request`,
    data: { friendshipId },
  });
};

/**
 * Notify the requester that their friend request was accepted.
 */
const notifyFriendRequestAccepted = async (requesterId, accepterId, friendshipId) => {
  const accepter = await User.findById(accepterId).select('name');
  const accepterName = accepter?.name || 'Someone';

  return createNotification({
    recipient: requesterId,
    actor: accepterId,
    type: 'friend_request_accepted',
    title: 'Friend Request Accepted',
    body: `${accepterName} accepted your friend request`,
    data: { friendshipId },
  });
};

/**
 * Notify the requester that their friend request was rejected.
 */
const notifyFriendRequestRejected = async (requesterId, rejecterId, friendshipId) => {
  const rejecter = await User.findById(rejecterId).select('name');
  const rejecterName = rejecter?.name || 'Someone';

  return createNotification({
    recipient: requesterId,
    actor: rejecterId,
    type: 'friend_request_rejected',
    title: 'Friend Request Declined',
    body: `${rejecterName} declined your friend request`,
    data: { friendshipId },
  });
};

// ── Admin queries ────────────────────────────────────────────────────────────

/**
 * Get all notifications (admin view) with filters.
 */
const getAllNotifications = async ({ page = 1, limit = 20, type, read, recipient } = {}) => {
  const filter = {};
  if (type) filter.type = type;
  if (read !== undefined && read !== '') filter.read = read === 'true' || read === true;
  if (recipient) filter.recipient = recipient;

  const skip = (Number(page) - 1) * Number(limit);

  const [notifications, total] = await Promise.all([
    Notification.find(filter)
      .populate('recipient', 'name username avatar')
      .populate('actor', USER_FIELDS)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit)),
    Notification.countDocuments(filter),
  ]);

  return {
    notifications,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get notification stats for admin dashboard.
 */
const getNotificationStats = async () => {
  const [total, unread, byType] = await Promise.all([
    Notification.countDocuments(),
    Notification.countDocuments({ read: false }),
    Notification.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
  ]);

  const typeMap = {};
  byType.forEach((t) => { typeMap[t._id] = t.count; });

  return { total, unread, byType: typeMap };
};

/**
 * Delete a notification (admin).
 */
const deleteNotification = async (notificationId) => {
  return Notification.findByIdAndDelete(notificationId);
};

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getAllNotifications,
  getNotificationStats,
  deleteNotification,
  notifyMatchCompleted,
  notifyAddedToMatch,
  notifyFriendRequestReceived,
  notifyFriendRequestAccepted,
  notifyFriendRequestRejected,
};
