const User   = require('./user.model');
const Friend = require('../friends/friend.model');
const Match  = require('../match/match.model');
const { fail } = require('../../utils/AppError');
const cloudinary = require('../../config/cloudinary');

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
  const user = await User.findById(userId).select('-__v -password');
  if (!user) fail('User not found', 404);

  const friendsCount = await Friend.countDocuments({
    $or: [{ requester: userId }, { recipient: userId }],
    status: 'accepted',
  });

  const obj = user.toObject();
  obj.friendsCount = friendsCount;
  return obj;
};

const updateProfile = async (userId, updates) => {
  const allowed = ['name', 'avatar', 'username', 'phone', 'email', 'termsAcceptedAt', 'location'];
  const filtered = {};
  allowed.forEach((key) => {
    if (updates[key] !== undefined) filtered[key] = updates[key];
  });

  // Validate location if provided
  if (filtered.location) {
    const loc = filtered.location;
    if (loc.coordinates && Array.isArray(loc.coordinates)) {
      const [lng, lat] = loc.coordinates;
      if (typeof lng !== 'number' || typeof lat !== 'number' ||
          lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        fail('Invalid coordinates: longitude must be -180..180, latitude -90..90', 400);
      }
    }
    if (loc.countryCode && !/^[A-Z]{2}$/.test(loc.countryCode)) {
      fail('countryCode must be a 2-letter ISO 3166-1 alpha-2 code (e.g. "IN", "US")', 400);
    }
    // Ensure GeoJSON type is set
    filtered.location = {
      type: 'Point',
      coordinates: loc.coordinates || [0, 0],
      city: loc.city || '',
      state: loc.state || '',
      country: loc.country || '',
      countryCode: loc.countryCode || '',
    };
  }

  // Uniqueness checks for username, phone, email
  const uniqueChecks = [];
  if (filtered.username) {
    uniqueChecks.push(
      User.findOne({ username: filtered.username, _id: { $ne: userId } }).then((existing) => {
        if (existing) fail('Username is already taken', 409);
      }),
    );
  }
  if (filtered.phone) {
    uniqueChecks.push(
      User.findOne({ phone: filtered.phone, _id: { $ne: userId } }).then((existing) => {
        if (existing) fail('Phone number is already registered', 409);
      }),
    );
  }
  if (filtered.email) {
    uniqueChecks.push(
      User.findOne({ email: filtered.email.toLowerCase(), _id: { $ne: userId } }).then((existing) => {
        if (existing) fail('Email is already registered', 409);
      }),
    );
  }
  if (uniqueChecks.length > 0) await Promise.all(uniqueChecks);

  const user = await User.findByIdAndUpdate(userId, filtered, {
    new: true,
    runValidators: true,
  }).select('-__v -password');
  if (!user) fail('User not found', 404);

  const friendsCount = await Friend.countDocuments({
    $or: [{ requester: userId }, { recipient: userId }],
    status: 'accepted',
  });

  const obj = user.toObject();
  obj.friendsCount = friendsCount;
  return obj;
};

/**
 * Upload a user's profile avatar to Cloudinary.
 * Enforces one-time change: once avatarChangedAt is set, further changes are blocked.
 */
const uploadAvatar = async (userId, file) => {
  if (!file) fail('No file provided', 400);

  const user = await User.findById(userId);
  if (!user) fail('User not found', 404);

  // Enforce one-time change: if the user already uploaded an avatar, block further changes
  if (user.avatarChangedAt) {
    fail('Profile photo can only be changed once', 403);
  }

  const allowedTypes = ['image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.mimetype)) {
    fail('Only JPEG and PNG images are allowed', 400);
  }

  if (file.size > 5 * 1024 * 1024) {
    fail('Image file size must be under 5 MB', 400);
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'circket/avatars',
        resource_type: 'image',
        allowed_formats: ['jpg', 'jpeg', 'png'],
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
      },
      (error, res) => {
        if (error) reject(error);
        else resolve(res);
      },
    );
    stream.end(file.buffer);
  });

  user.avatar = result.secure_url;
  user.avatarChangedAt = new Date();
  await user.save();

  const friendsCount = await Friend.countDocuments({
    $or: [{ requester: userId }, { recipient: userId }],
    status: 'accepted',
  });

  const obj = user.toObject();
  delete obj.password;
  delete obj.__v;
  obj.friendsCount = friendsCount;
  return obj;
};

/**
 * Check if a field value is available (not taken by another user).
 * @param {string} field — 'username', 'phone', or 'email'
 * @param {string} value — the value to check
 * @param {string} [excludeUserId] — exclude this user from the check (for edits)
 */
const checkAvailability = async (field, value, excludeUserId) => {
  const validFields = ['username', 'phone', 'email'];
  if (!validFields.includes(field)) fail('Invalid field', 400);
  if (!value || !value.trim()) fail('Value is required', 400);

  const query = { [field]: field === 'email' ? value.toLowerCase() : value };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const existing = await User.findOne(query).select('_id');
  return { available: !existing };
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

/**
 * Aggregate a user's cricket match stats from completed matches.
 * Returns batting, bowling, and match win/loss stats split by matchType.
 */
const getPlayerStats = async (targetUserId) => {
  const user = await User.findById(targetUserId).select(PUBLIC_FIELDS);
  if (!user) fail('User not found', 404);

  const matches = await Match.find({
    status: 'completed',
    sport: 'cricket',
  }).populate('roomId').lean();

  const buildEmpty = () => ({
    matches: 0, wins: 0, losses: 0,
    batting: { runs: 0, ballsFaced: 0, innings: 0, fours: 0, sixes: 0, highestScore: 0, average: 0, strikeRate: 0, fifties: 0, hundreds: 0, doubleHundreds: 0 },
    bowling: { wickets: 0, runsConceded: 0, ballsBowled: 0, overs: '0.0', economy: 0, bestWickets: 0, bestRuns: 0, bestBowling: '0/0', fiveWicketHauls: 0, hatTricks: 0 },
  });

  const statsByType = { all: buildEmpty(), local: buildEmpty(), tournament: buildEmpty() };
  const uid = targetUserId.toString();

  for (const match of matches) {
    const room = match.roomId;
    if (!room) continue;

    // Build slotId → userId map
    const slotMap = {};
    let userSlotId = null;
    let userTeam = null;
    for (const slot of room.players) {
      slotMap[slot._id.toString()] = slot.userId?.toString() || null;
      if (slot.userId?.toString() === uid) {
        userSlotId = slot._id.toString();
        userTeam = slot.team;
      }
    }

    // Check if user participated
    if (!userSlotId) continue;

    const mType = match.matchType || 'local';
    const types = ['all', mType];

    // Win/loss
    for (const t of types) {
      statsByType[t].matches += 1;
      if (match.result?.winner === userTeam) {
        statsByType[t].wins += 1;
      } else if (match.result?.winner && match.result.winner !== 'draw' && match.result.winner !== 'no_result') {
        statsByType[t].losses += 1;
      }
    }

    const matchId = match._id.toString();

    // Per-innings tracking for highest score and best bowling
    const inningsScores = {};  // `${innNum}` → runs
    const inningsFigures = {}; // `${innNum}` → { wickets, runs }

    // Hat-trick tracking: consecutive wickets by this bowler across balls
    let consecutiveWickets = 0;
    let hatTricksInMatch = 0;

    for (const inn of match.innings) {
      for (const over of inn.overs) {
        for (const ball of over.balls) {
          // Batting
          if (slotMap[ball.batsmanId?.toString()] === uid) {
            const innKey = `${matchId}-${inn.number}`;
            for (const t of types) {
              const b = statsByType[t].batting;
              b.runs += ball.runs || 0;
              if (ball.isLegal) b.ballsFaced += 1;
              if (ball.runs === 4) b.fours += 1;
              if (ball.runs === 6) b.sixes += 1;
            }
            inningsScores[innKey] = (inningsScores[innKey] || 0) + (ball.runs || 0);
          }

          // Bowling
          if (slotMap[ball.bowlerId?.toString()] === uid) {
            const innKey = `${matchId}-${inn.number}`;
            const conceded = (ball.runs || 0) + (ball.extras?.runs || 0);
            for (const t of types) {
              const bw = statsByType[t].bowling;
              bw.runsConceded += conceded;
              if (ball.wicket?.type) bw.wickets += 1;
              if (ball.isLegal) bw.ballsBowled += 1;
            }
            if (!inningsFigures[innKey]) inningsFigures[innKey] = { wickets: 0, runs: 0 };
            inningsFigures[innKey].runs += conceded;
            if (ball.wicket?.type) inningsFigures[innKey].wickets += 1;

            // Hat-trick detection: count consecutive wickets on legal deliveries
            if (ball.isLegal) {
              if (ball.wicket?.type) {
                consecutiveWickets += 1;
                if (consecutiveWickets >= 3) hatTricksInMatch += 1;
              } else {
                consecutiveWickets = 0;
              }
            }
          } else if (ball.isLegal) {
            // Different bowler on a legal ball resets the streak
            consecutiveWickets = 0;
          }
        }
      }
    }

    // Add hat-tricks for this match
    if (hatTricksInMatch > 0) {
      for (const t of types) {
        statsByType[t].bowling.hatTricks += hatTricksInMatch;
      }
    }

    // Update highest score + batting milestones (50s, 100s, 200s)
    for (const [, runs] of Object.entries(inningsScores)) {
      for (const t of types) {
        if (runs > statsByType[t].batting.highestScore) {
          statsByType[t].batting.highestScore = runs;
        }
        // Count milestones (mutually exclusive: 200 counts as 200 only, not also as 100/50)
        if (runs >= 200) {
          statsByType[t].batting.doubleHundreds += 1;
        } else if (runs >= 100) {
          statsByType[t].batting.hundreds += 1;
        } else if (runs >= 50) {
          statsByType[t].batting.fifties += 1;
        }
      }
    }

    // Update batting innings count
    const battingInnings = Object.keys(inningsScores).length;
    if (battingInnings > 0) {
      for (const t of types) {
        statsByType[t].batting.innings += battingInnings;
      }
    }

    // Update best bowling + 5-wicket hauls
    for (const [, fig] of Object.entries(inningsFigures)) {
      for (const t of types) {
        const bw = statsByType[t].bowling;
        if (fig.wickets > bw.bestWickets || (fig.wickets === bw.bestWickets && fig.runs < bw.bestRuns)) {
          bw.bestWickets = fig.wickets;
          bw.bestRuns = fig.runs;
        }
        if (fig.wickets >= 5) {
          bw.fiveWicketHauls += 1;
        }
      }
    }
  }

  // Compute derived stats
  for (const t of Object.keys(statsByType)) {
    const s = statsByType[t];
    const bat = s.batting;
    bat.average = bat.innings > 0 ? Number((bat.runs / bat.innings).toFixed(2)) : 0;
    bat.strikeRate = bat.ballsFaced > 0 ? Number(((bat.runs / bat.ballsFaced) * 100).toFixed(2)) : 0;

    const bw = s.bowling;
    const fullOvers = Math.floor(bw.ballsBowled / 6);
    const partialBalls = bw.ballsBowled % 6;
    bw.overs = `${fullOvers}.${partialBalls}`;
    const oversDecimal = fullOvers + partialBalls / 6;
    bw.economy = oversDecimal > 0 ? Number((bw.runsConceded / oversDecimal).toFixed(2)) : 0;
    bw.bestBowling = `${bw.bestWickets}/${bw.bestRuns}`;
  }

  return {
    user: user.toObject(),
    cricket: statsByType,
  };
};

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getAllUsers,
  getUserById,
  getPlayerStats,
  checkAvailability,
};
