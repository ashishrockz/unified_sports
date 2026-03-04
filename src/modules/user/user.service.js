const User   = require('./user.model');
const Friend = require('../friends/friend.model');
const { fail } = require('../../utils/AppError');

// ── Helpers ──────────────────────────────────────────────────────────────────

const PUBLIC_FIELDS = 'name username email phone avatar role createdAt';

/** Find any friendship document between two users (either direction). */
const findRelationship = (userA, userB) =>
  Friend.findOne({
    $or: [
      { requester: userA, recipient: userB },
      { requester: userB, recipient: userA },
    ],
  });

// ── Services ─────────────────────────────────────────────────────────────────

const getProfile = async (userId) => {
  return User.findById(userId).select('-__v -password');
};

const updateProfile = async (userId, updates) => {
  const allowed = ['name', 'username', 'avatar'];
  const filtered = {};
  allowed.forEach((key) => {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  });

  return User.findByIdAndUpdate(userId, filtered, {
    new: true,
    runValidators: true,
  }).select('-__v -password');
};

/**
 * List all users with optional search by name or username.
 *
 * Each user in the list is enriched with:
 *  - friendsCount  — total accepted friends they have
 *  - friendship    — { status, friendshipId?, direction?, blockedBy? }
 *                    showing how the current user relates to them
 *
 * Uses bulk queries (no N+1 problem):
 *  1. One User query with regex filter + pagination
 *  2. One Friend query for all relationships with these users
 *  3. One Friend aggregation for friend counts of all returned users
 */
const getAllUsers = async (currentUserId, { search = '', page = 1, limit = 20 } = {}) => {
  const skip = (Number(page) - 1) * Number(limit);

  // Build filter — exclude self and admins from the list
  const filter = {
    _id:  { $ne: currentUserId },
    role: 'user',
  };

  if (search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ name: regex }, { username: regex }];
  }

  // 1. Users + total count (parallel)
  const [users, total] = await Promise.all([
    User.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ name: 1 })
      .skip(skip)
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  if (users.length === 0) {
    return {
      users: [],
      pagination: { page: Number(page), limit: Number(limit), total: 0, totalPages: 0 },
    };
  }

  const userIds = users.map((u) => u._id);

  // 2. All relationships between currentUser ↔ these users (one query)
  const relationships = await Friend.find({
    $or: [
      { requester: currentUserId, recipient: { $in: userIds } },
      { requester: { $in: userIds }, recipient: currentUserId },
    ],
  });

  // Build: targetUserId → relationship document
  const relationMap = {};
  relationships.forEach((rel) => {
    const otherId =
      rel.requester.toString() === currentUserId.toString()
        ? rel.recipient.toString()
        : rel.requester.toString();
    relationMap[otherId] = rel;
  });

  // 3. Friend counts for all returned users (one aggregation)
  const friendCountAgg = await Friend.aggregate([
    {
      $match: {
        status: 'accepted',
        $or: [
          { requester: { $in: userIds } },
          { recipient:  { $in: userIds } },
        ],
      },
    },
    {
      $project: {
        participant: {
          $cond: {
            if:   { $in: ['$requester', userIds] },
            then: '$requester',
            else: '$recipient',
          },
        },
      },
    },
    { $group: { _id: '$participant', count: { $sum: 1 } } },
  ]);

  const friendCountMap = {};
  friendCountAgg.forEach((fc) => {
    friendCountMap[fc._id.toString()] = fc.count;
  });

  // 4. Combine everything
  const enriched = users.map((user) => {
    const uid = user._id.toString();
    const rel = relationMap[uid];

    let friendship = { status: 'none' };

    if (rel) {
      const iAmRequester = rel.requester.toString() === currentUserId.toString();
      friendship = {
        status:       rel.status,
        friendshipId: rel._id,
        ...(rel.status === 'pending' && { direction: iAmRequester ? 'outgoing' : 'incoming' }),
        ...(rel.blockedBy && { blockedBy: rel.blockedBy }),
      };
    }

    return {
      ...user.toObject(),
      friendsCount: friendCountMap[uid] ?? 0,
      friendship,
    };
  });

  return {
    users: enriched,
    pagination: {
      page:       Number(page),
      limit:      Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get a single user's full public profile.
 *
 * Returns:
 *  - User fields
 *  - friendsCount
 *  - friends[]  (first 20 accepted friends, populated)
 *  - incomingCount / outgoingCount (only when viewing own profile)
 *  - friendship  — how the current user relates to this person
 */
const getUserById = async (currentUserId, targetUserId) => {
  const user = await User.findById(targetUserId).select(PUBLIC_FIELDS);
  if (!user) fail('User not found', 404);

  const isSelf = currentUserId.toString() === targetUserId.toString();

  // Run all parallel queries
  const queries = [
    // Friends list (first 20)
    Friend.find({
      status: 'accepted',
      $or: [{ requester: targetUserId }, { recipient: targetUserId }],
    })
      .populate('requester', PUBLIC_FIELDS)
      .populate('recipient', PUBLIC_FIELDS)
      .select('-__v')
      .sort({ updatedAt: -1 })
      .limit(20),

    // Total friends count
    Friend.countDocuments({
      status: 'accepted',
      $or: [{ requester: targetUserId }, { recipient: targetUserId }],
    }),

    // Relationship with current user (null if self)
    isSelf ? Promise.resolve(null) : findRelationship(currentUserId, targetUserId),
  ];

  // Additional counts when viewing own profile
  if (isSelf) {
    queries.push(
      Friend.countDocuments({ recipient: targetUserId, status: 'pending' }),   // incoming
      Friend.countDocuments({ requester: targetUserId, status: 'pending' }),   // outgoing
      Friend.countDocuments({ status: 'blocked', blockedBy: targetUserId })    // blocked
    );
  }

  const results = await Promise.all(queries);
  const [friendDocs, friendsCount, relationship] = results;

  // Shape the friends list — return the "other" user in each pair
  const friends = friendDocs.map((f) => ({
    friendshipId: f._id,
    user:
      f.requester._id.toString() === targetUserId.toString()
        ? f.recipient
        : f.requester,
    since: f.updatedAt,
  }));

  // Build friendship status block
  let friendship = { status: isSelf ? 'self' : 'none' };

  if (!isSelf && relationship) {
    const iAmRequester = relationship.requester.toString() === currentUserId.toString();
    friendship = {
      status:       relationship.status,
      friendshipId: relationship._id,
      direction:    iAmRequester ? 'outgoing' : 'incoming',
      initiatedBy:  relationship.requester,
      blockedBy:    relationship.blockedBy ?? null,
      since:        relationship.createdAt,
    };
  }

  const profile = {
    ...user.toObject(),
    friendsCount,
    friends,
    friendship,
  };

  // Attach self-only counts
  if (isSelf) {
    profile.incomingRequestsCount = results[3];
    profile.outgoingRequestsCount = results[4];
    profile.blockedCount          = results[5];
  }

  return profile;
};

module.exports = {
  getProfile,
  updateProfile,
  getAllUsers,
  getUserById,
};
