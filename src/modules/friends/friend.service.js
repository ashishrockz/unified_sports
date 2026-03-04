const Friend = require('./friend.model');
const User   = require('../user/user.model');
const { fail } = require('../../utils/AppError');

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shared user fields to populate (never expose password / __v). */
const USER_FIELDS = 'name username email phone avatar role';

/** Finds any relationship document between two users regardless of who sent it. */
const findRelationship = (userA, userB) =>
  Friend.findOne({
    $or: [
      { requester: userA, recipient: userB },
      { requester: userB, recipient: userA },
    ],
  });

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Send a friend request.
 *
 * Scenarios handled:
 *  - Self-request            → 400
 *  - Recipient not found     → 404
 *  - Blocked (either side)   → 403
 *  - Already friends         → 409
 *  - Request already pending → 409
 *  - Mutual request (B→A exists pending) → auto-accept
 *  - Previously rejected     → reuse document, reset to pending
 *  - No relationship         → create new
 */
const sendRequest = async (requesterId, recipientId) => {
  if (requesterId.toString() === recipientId.toString()) {
    fail('Cannot send a friend request to yourself', 400);
  }

  const recipient = await User.findById(recipientId);
  if (!recipient) fail('User not found', 404);

  const existing = await findRelationship(requesterId, recipientId);

  if (existing) {
    if (existing.status === 'blocked') {
      fail('Cannot send a friend request to this user', 403);
    }

    if (existing.status === 'accepted') {
      fail('You are already friends with this user', 409);
    }

    if (existing.status === 'pending') {
      // Mutual scenario: the other person already sent a request → auto-accept
      if (existing.recipient.toString() === requesterId.toString()) {
        existing.status = 'accepted';
        await existing.save();
        return {
          autoAccepted: true,
          message: 'Friend request accepted — you both requested each other',
          friendship: existing,
        };
      }
      fail('Friend request already sent and is pending', 409);
    }

    if (existing.status === 'rejected') {
      // Requester re-tries after rejection — reuse the document
      existing.requester  = requesterId;
      existing.recipient  = recipientId;
      existing.status     = 'pending';
      existing.blockedBy  = null;
      await existing.save();
      return existing;
    }
  }

  return Friend.create({ requester: requesterId, recipient: recipientId });
};

/**
 * Accept an incoming friend request.
 * Only the recipient of the pending request may accept it.
 */
const acceptRequest = async (userId, requestId) => {
  const request = await Friend.findOne({
    _id: requestId,
    recipient: userId,
    status: 'pending',
  });

  if (!request) fail('Friend request not found or you are not the recipient', 404);

  request.status = 'accepted';
  await request.save();
  return request;
};

/**
 * Reject an incoming friend request.
 * Only the recipient of the pending request may reject it.
 * The document is kept (status → rejected) so the requester may re-request later.
 */
const rejectRequest = async (userId, requestId) => {
  const request = await Friend.findOne({
    _id: requestId,
    recipient: userId,
    status: 'pending',
  });

  if (!request) fail('Friend request not found or you are not the recipient', 404);

  request.status = 'rejected';
  await request.save();
  return request;
};

/**
 * Cancel a pending outgoing request.
 * Only the original requester may cancel it; the document is deleted.
 */
const cancelRequest = async (userId, requestId) => {
  const request = await Friend.findOneAndDelete({
    _id: requestId,
    requester: userId,
    status: 'pending',
  });

  if (!request) fail('Pending request not found or you are not the sender', 404);

  return { message: 'Friend request cancelled successfully' };
};

/**
 * Unfriend — removes an accepted friendship from both sides.
 */
const unfriend = async (userId, targetUserId) => {
  const friendship = await Friend.findOneAndDelete({
    status: 'accepted',
    $or: [
      { requester: userId,       recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ],
  });

  if (!friendship) fail('Friendship not found', 404);

  return { message: 'Unfriended successfully' };
};

/**
 * Block a user.
 *
 * Scenarios:
 *  - Self-block                     → 400
 *  - Target not found               → 404
 *  - Already blocked by this user   → 409
 *  - Existing relationship present  → update status to blocked
 *  - No relationship                → create blocked document
 */
const blockUser = async (userId, targetUserId) => {
  if (userId.toString() === targetUserId.toString()) {
    fail('Cannot block yourself', 400);
  }

  const target = await User.findById(targetUserId);
  if (!target) fail('User not found', 404);

  const existing = await findRelationship(userId, targetUserId);

  if (existing) {
    if (
      existing.status === 'blocked' &&
      existing.blockedBy &&
      existing.blockedBy.toString() === userId.toString()
    ) {
      fail('You have already blocked this user', 409);
    }

    existing.status    = 'blocked';
    existing.blockedBy = userId;
    await existing.save();
    return existing;
  }

  return Friend.create({
    requester: userId,
    recipient: targetUserId,
    status: 'blocked',
    blockedBy: userId,
  });
};

/**
 * Unblock a user.
 * Only the person who issued the block can unblock.
 * The document is deleted on unblock (clean slate — either party can re-request).
 */
const unblockUser = async (userId, targetUserId) => {
  const record = await Friend.findOneAndDelete({
    status: 'blocked',
    blockedBy: userId,
    $or: [
      { requester: userId,       recipient: targetUserId },
      { requester: targetUserId, recipient: userId },
    ],
  });

  if (!record) fail('No active block found for this user, or you are not the blocker', 404);

  return { message: 'User unblocked successfully' };
};

/**
 * Get all accepted friends of a user with populated profiles.
 * Returns an array of { friendshipId, friend, since }.
 */
const getFriends = async (userId) => {
  const friendships = await Friend.find({
    status: 'accepted',
    $or: [{ requester: userId }, { recipient: userId }],
  })
    .populate('requester', USER_FIELDS)
    .populate('recipient', USER_FIELDS)
    .select('-__v')
    .sort({ updatedAt: -1 });

  return friendships.map((f) => ({
    friendshipId: f._id,
    friend:
      f.requester._id.toString() === userId.toString() ? f.recipient : f.requester,
    since: f.updatedAt,
  }));
};

/**
 * List pending friend requests received by the user (awaiting their response).
 */
const getIncomingRequests = async (userId) => {
  return Friend.find({ recipient: userId, status: 'pending' })
    .populate('requester', USER_FIELDS)
    .select('-__v')
    .sort({ createdAt: -1 });
};

/**
 * List pending friend requests the user has sent (awaiting others' response).
 */
const getOutgoingRequests = async (userId) => {
  return Friend.find({ requester: userId, status: 'pending' })
    .populate('recipient', USER_FIELDS)
    .select('-__v')
    .sort({ createdAt: -1 });
};

/**
 * Check the friendship status between the current user and any other user.
 * Returns one of: 'self' | 'none' | 'pending' | 'accepted' | 'rejected' | 'blocked'
 */
const getFriendshipStatus = async (userId, targetUserId) => {
  const target = await User.findById(targetUserId).select(USER_FIELDS);
  if (!target) fail('User not found', 404);

  if (userId.toString() === targetUserId.toString()) {
    return { status: 'self', user: target };
  }

  const relationship = await findRelationship(userId, targetUserId);

  if (!relationship) {
    return { status: 'none', user: target };
  }

  const iAmRequester = relationship.requester.toString() === userId.toString();

  return {
    status:      relationship.status,
    requestId:   relationship._id,
    direction:   iAmRequester ? 'outgoing' : 'incoming',
    initiatedBy: relationship.requester,
    blockedBy:   relationship.blockedBy ?? null,
    since:       relationship.createdAt,
    user:        target,
  };
};

/**
 * Get counts summary for a user's friend activity.
 */
const getFriendStats = async (userId) => {
  const [friends, incoming, outgoing, blocked] = await Promise.all([
    Friend.countDocuments({
      status: 'accepted',
      $or: [{ requester: userId }, { recipient: userId }],
    }),
    Friend.countDocuments({ recipient: userId, status: 'pending' }),
    Friend.countDocuments({ requester: userId, status: 'pending' }),
    Friend.countDocuments({ status: 'blocked', blockedBy: userId }),
  ]);

  return { friends, incoming, outgoing, blocked };
};

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  unfriend,
  blockUser,
  unblockUser,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getFriendshipStatus,
  getFriendStats,
};
