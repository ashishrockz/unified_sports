const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../user/user.model');
const Room   = require('../room/room.model');
const Match  = require('../match/match.model');
const { fail } = require('../../utils/AppError');
const { escapeRegex } = require('../../utils/sanitize');

const ADMIN_PUBLIC_FIELDS = 'name username email phone avatar role status createdAt updatedAt';

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Shared login for admin AND superadmin.
 * Checks password, then account status before issuing a JWT.
 */
const adminLogin = async (email, password) => {
  const actor = await User.findOne({
    email:  email.toLowerCase(),
    role:   { $in: ['admin', 'superadmin'] },
  }).select('+password');

  if (!actor) fail('Invalid email or password', 401);

  const isMatch = await bcrypt.compare(password, actor.password);
  if (!isMatch) fail('Invalid email or password', 401);

  // Check account status after password verification
  if (actor.status === 'inactive') {
    fail('Your admin account has been deactivated. Contact the super admin.', 403);
  }
  if (actor.status === 'banned') {
    fail('Your admin account has been banned. Contact the super admin.', 403);
  }

  const token = jwt.sign(
    { userId: actor._id, role: actor.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  const actorData = actor.toObject();
  delete actorData.password;

  return { token, user: actorData };
};

// ── User management (Admin + SuperAdmin) ─────────────────────────────────────

/**
 * List all regular users with search, status filter, and pagination.
 */
const getAllUsers = async ({ search = '', status = '', page = 1, limit = 20 } = {}) => {
  const filter = { role: 'user' };

  if (search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: regex }, { username: regex }, { email: regex }];
  }
  if (['active', 'inactive', 'banned'].includes(status)) {
    filter.status = status;
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select(ADMIN_PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return {
    users,
    pagination: {
      page:       Number(page),
      limit:      Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get a single user's full detail (admin view — includes status).
 */
const getUserDetail = async (userId) => {
  const user = await User.findOne({ _id: userId, role: 'user' }).select(ADMIN_PUBLIC_FIELDS);
  if (!user) fail('User not found', 404);
  return user;
};

/**
 * Core function for all status-change actions.
 *
 * Protection rules:
 *  - Cannot act on superadmin accounts (ever)
 *  - Admins cannot act on other admin accounts
 *  - Cannot act on self
 *  - Cannot apply a status that is already set
 */
const changeUserStatus = async (actorId, targetUserId, newStatus, actorRole) => {
  if (actorId.toString() === targetUserId.toString()) {
    fail('You cannot change your own status', 400);
  }

  const target = await User.findById(targetUserId);
  if (!target) fail('User not found', 404);

  // Superadmin can never be touched
  if (target.role === 'superadmin') {
    fail('Super admin account cannot be modified', 403);
  }

  // Admin (employee) cannot touch other admin accounts
  if (actorRole === 'admin' && target.role === 'admin') {
    fail('Admins cannot manage other admin accounts — contact the super admin', 403);
  }

  if (target.status === newStatus) {
    fail(`User is already ${newStatus}`, 409);
  }

  target.status = newStatus;
  await target.save();

  return target;
};

const banUser = (actorId, targetUserId, actorRole) =>
  changeUserStatus(actorId, targetUserId, 'banned', actorRole);

const unbanUser = (actorId, targetUserId, actorRole) =>
  changeUserStatus(actorId, targetUserId, 'active', actorRole);

const activateUser = (actorId, targetUserId, actorRole) =>
  changeUserStatus(actorId, targetUserId, 'active', actorRole);

const deactivateUser = (actorId, targetUserId, actorRole) =>
  changeUserStatus(actorId, targetUserId, 'inactive', actorRole);

// ── Admin profile ─────────────────────────────────────────────────────────────

/**
 * Change own password. Requires current password verification.
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  if (!currentPassword || !newPassword) fail('currentPassword and newPassword are required', 400);
  if (newPassword.length < 6) fail('New password must be at least 6 characters', 400);

  const user = await User.findById(userId).select('+password');
  if (!user) fail('User not found', 404);

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) fail('Current password is incorrect', 401);

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  return { message: 'Password changed successfully' };
};

// ── Admin dashboard ──────────────────────────────────────────────────────────

/**
 * Dashboard stats for admin role — user counts only.
 */
const getAdminDashboard = async () => {
  const [totalUsers, activeUsers, inactiveUsers, bannedUsers] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', status: 'active' }),
    User.countDocuments({ role: 'user', status: 'inactive' }),
    User.countDocuments({ role: 'user', status: 'banned' }),
  ]);

  return {
    users: { total: totalUsers, active: activeUsers, inactive: inactiveUsers, banned: bannedUsers },
  };
};

// ── Room/Match oversight (read-only) ─────────────────────────────────────────

/**
 * List all rooms (admin oversight).
 */
const getAllRoomsAdmin = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;

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

const getRoomByIdAdmin = async (roomId) => {
  const room = await Room.findById(roomId)
    .populate('creator', 'name username avatar')
    .populate('sportTypeId', 'name slug sport config')
    .populate('players.userId', 'name username avatar');
  if (!room) fail('Room not found', 404);
  return room;
};

/**
 * List all matches (admin oversight).
 */
const getAllMatchesAdmin = async ({ status, page = 1, limit = 20 } = {}) => {
  const filter = {};
  if (status) filter.status = status;

  const [matches, total] = await Promise.all([
    Match.find(filter)
      .populate('roomId', 'name creator')
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    Match.countDocuments(filter),
  ]);

  return {
    matches,
    pagination: { page: Number(page), limit: Number(limit), total, totalPages: Math.ceil(total / Number(limit)) },
  };
};

const getMatchByIdAdmin = async (matchId) => {
  const match = await Match.findById(matchId)
    .populate('roomId', 'name creator players');
  if (!match) fail('Match not found', 404);
  return match;
};

/**
 * Bulk user status change.
 * Applies the given status to all provided user IDs.
 * Skips users that cannot be modified (superadmins, self, already in target status).
 */
const bulkChangeUserStatus = async (actorId, userIds, newStatus, actorRole) => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    fail('userIds array is required', 400);
  }
  if (!['active', 'inactive', 'banned'].includes(newStatus)) {
    fail('Invalid status', 400);
  }
  if (userIds.length > 100) {
    fail('Maximum 100 users per bulk action', 400);
  }

  const results = { success: 0, skipped: 0, errors: [] };

  for (const userId of userIds) {
    try {
      await changeUserStatus(actorId, userId, newStatus, actorRole);
      results.success++;
    } catch (err) {
      results.skipped++;
      results.errors.push({ userId, message: err.message });
    }
  }

  return results;
};

/**
 * Export all users as a flat array (no pagination).
 */
const exportUsers = async ({ status } = {}) => {
  const filter = { role: 'user' };
  if (status && ['active', 'inactive', 'banned'].includes(status)) {
    filter.status = status;
  }
  return User.find(filter).select('name username email phone status createdAt').sort({ createdAt: -1 }).lean();
};

// ── Profile update ───────────────────────────────────────────────────────────

/**
 * Update own admin profile (name only for now, avatar via separate upload).
 */
const updateProfile = async (userId, updates) => {
  const allowedFields = ['name'];
  const sanitized = {};
  for (const key of allowedFields) {
    if (updates[key] !== undefined) sanitized[key] = updates[key];
  }

  if (Object.keys(sanitized).length === 0) {
    fail('No valid fields to update', 400);
  }

  const user = await User.findByIdAndUpdate(userId, sanitized, { new: true, runValidators: true })
    .select(ADMIN_PUBLIC_FIELDS);
  if (!user) fail('User not found', 404);
  return user;
};

/**
 * Update avatar path for a user.
 */
const updateAvatar = async (userId, avatarPath) => {
  const user = await User.findByIdAndUpdate(userId, { avatar: avatarPath }, { new: true })
    .select(ADMIN_PUBLIC_FIELDS);
  if (!user) fail('User not found', 404);
  return user;
};

// ── Forgot / Reset password ─────────────────────────────────────────────────

// Simple in-memory store for reset tokens (in production, use Redis or DB)
const resetTokens = new Map();

/**
 * Generate a password reset token and send it via email.
 */
const forgotPassword = async (email) => {
  if (!email) fail('Email is required', 400);

  const user = await User.findOne({
    email: email.toLowerCase(),
    role: { $in: ['admin', 'superadmin'] },
  });

  // Don't reveal whether the email exists
  if (!user) return { message: 'If that email is registered, a reset link has been sent' };

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + 30 * 60 * 1000; // 30 minutes

  resetTokens.set(token, { userId: user._id.toString(), expiry });

  // Clean up expired tokens
  for (const [key, val] of resetTokens) {
    if (val.expiry < Date.now()) resetTokens.delete(key);
  }

  try {
    const { sendPasswordResetEmail } = require('../../config/mailer');
    await sendPasswordResetEmail(user.email, token, user.name);
  } catch (err) {
    console.error('Failed to send reset email:', err.message);
    // Don't fail - just log
  }

  return { message: 'If that email is registered, a reset link has been sent' };
};

/**
 * Reset password using the token.
 */
const resetPassword = async (token, newPassword) => {
  if (!token || !newPassword) fail('Token and new password are required', 400);
  if (newPassword.length < 6) fail('Password must be at least 6 characters', 400);

  const record = resetTokens.get(token);
  if (!record || record.expiry < Date.now()) {
    fail('Invalid or expired reset token', 400);
  }

  const user = await User.findById(record.userId);
  if (!user) fail('User not found', 404);

  user.password = await bcrypt.hash(newPassword, 12);
  await user.save();

  resetTokens.delete(token);

  return { message: 'Password has been reset successfully' };
};

module.exports = {
  adminLogin,
  getAllUsers,
  getUserDetail,
  banUser,
  unbanUser,
  activateUser,
  deactivateUser,
  changePassword,
  getAdminDashboard,
  getAllRoomsAdmin,
  getRoomByIdAdmin,
  getAllMatchesAdmin,
  getMatchByIdAdmin,
  bulkChangeUserStatus,
  exportUsers,
  updateProfile,
  updateAvatar,
  forgotPassword,
  resetPassword,
};
