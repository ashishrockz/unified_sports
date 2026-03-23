const bcrypt    = require('bcryptjs');
const User      = require('../user/user.model');
const Room      = require('../room/room.model');
const Match     = require('../match/match.model');
const SportType = require('../sportType/sportType.model');
const { fail }  = require('../../utils/AppError');
const { escapeRegex } = require('../../utils/sanitize');
const { STAFF_ROLES } = require('../../config/permissions');

const ADMIN_FIELDS = 'name username email phone avatar role status createdAt updatedAt';

// Staff roles that can be created (super_admin cannot be created via API)
const CREATABLE_ROLES = ['admin', 'manager', 'editor', 'viewer'];

// ── Admin (employee) management — superadmin only ────────────────────────────

/**
 * Create a new staff account.
 *
 * Rules:
 *  - email must be unique
 *  - password is hashed before storage
 *  - role can be: admin, manager, editor, viewer (NOT super_admin)
 *  - status starts as 'active'
 */
const createAdmin = async ({ name, email, password, role = 'admin' }) => {
  if (!name || !email || !password) {
    fail('name, email, and password are required', 400);
  }

  if (!CREATABLE_ROLES.includes(role)) {
    fail(`role must be one of: ${CREATABLE_ROLES.join(', ')}`, 400);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) fail('An account with this email already exists', 409);

  if (password.length < 6) fail('Password must be at least 6 characters', 400);

  const hashedPassword = await bcrypt.hash(password, 12);

  const admin = await User.create({
    name:     name.trim(),
    email:    email.toLowerCase().trim(),
    password: hashedPassword,
    role,
    status:   'active',
  });

  const adminData = admin.toObject();
  delete adminData.password;
  return adminData;
};

/**
 * List all staff accounts with optional search, role filter, and status filter.
 */
const getAllAdmins = async ({ search = '', status = '', role = '', page = 1, limit = 20 } = {}) => {
  const filter = { role: { $in: STAFF_ROLES } };

  if (search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { username: regex }];
  }
  if (['active', 'inactive'].includes(status)) {
    filter.status = status;
  }
  if (role && STAFF_ROLES.includes(role)) {
    filter.role = role;
  }

  const [admins, total] = await Promise.all([
    User.find(filter)
      .select(ADMIN_FIELDS)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    User.countDocuments(filter),
  ]);

  return {
    admins,
    pagination: {
      page:       Number(page),
      limit:      Number(limit),
      total,
      totalPages: Math.ceil(total / Number(limit)),
    },
  };
};

/**
 * Get a single staff member's full profile.
 */
const getAdminById = async (adminId) => {
  const admin = await User.findOne({ _id: adminId, role: { $in: STAFF_ROLES } }).select(ADMIN_FIELDS);
  if (!admin) fail('Admin not found', 404);
  return admin;
};

/**
 * Core helper for activating or deactivating a staff account.
 *
 * Rules:
 *  - Cannot change a super_admin's status
 *  - Cannot act on self
 *  - Cannot set a status that is already set
 */
const changeAdminStatus = async (superAdminId, adminId, newStatus) => {
  if (superAdminId.toString() === adminId.toString()) {
    fail('You cannot change your own status', 400);
  }

  const admin = await User.findById(adminId);
  if (!admin) fail('Admin not found', 404);

  if (admin.role === 'super_admin') {
    fail('Super admin account cannot be modified', 403);
  }
  if (!STAFF_ROLES.includes(admin.role)) {
    fail('Target is not a staff account', 400);
  }
  if (admin.status === newStatus) {
    fail(`Admin account is already ${newStatus}`, 409);
  }

  admin.status = newStatus;
  await admin.save();
  return admin;
};

const activateAdmin = (superAdminId, adminId) =>
  changeAdminStatus(superAdminId, adminId, 'active');

const deactivateAdmin = (superAdminId, adminId) =>
  changeAdminStatus(superAdminId, adminId, 'inactive');

/**
 * Permanently delete a staff account.
 *
 * Rules:
 *  - Cannot remove a super_admin
 *  - Cannot remove yourself
 */
const removeAdmin = async (superAdminId, adminId) => {
  if (superAdminId.toString() === adminId.toString()) {
    fail('You cannot delete your own account', 400);
  }

  const admin = await User.findById(adminId);
  if (!admin) fail('Admin not found', 404);

  if (admin.role === 'super_admin') {
    fail('Super admin account cannot be deleted', 403);
  }
  if (!STAFF_ROLES.includes(admin.role)) {
    fail('Target is not a staff account', 400);
  }

  await admin.deleteOne();
  return { message: `Admin account "${admin.name || admin.email}" has been permanently removed` };
};

/**
 * Dashboard summary — counts of admins by status.
 */
const getDashboardStats = async () => {
  const [
    totalUsers, activeUsers, inactiveUsers, bannedUsers,
    totalAdmins, activeAdmins, inactiveAdmins,
    totalRooms, activeRooms, completedRooms,
    totalMatches, activeMatches, completedMatches,
    totalSportTypes,
  ] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    User.countDocuments({ role: 'user', status: 'active' }),
    User.countDocuments({ role: 'user', status: 'inactive' }),
    User.countDocuments({ role: 'user', status: 'banned' }),
    User.countDocuments({ role: { $in: STAFF_ROLES } }),
    User.countDocuments({ role: { $in: STAFF_ROLES }, status: 'active' }),
    User.countDocuments({ role: { $in: STAFF_ROLES }, status: 'inactive' }),
    Room.countDocuments(),
    Room.countDocuments({ status: 'active' }),
    Room.countDocuments({ status: 'completed' }),
    Match.countDocuments(),
    Match.countDocuments({ status: 'active' }),
    Match.countDocuments({ status: 'completed' }),
    SportType.countDocuments(),
  ]);

  return {
    users:      { total: totalUsers,   active: activeUsers,   inactive: inactiveUsers, banned: bannedUsers },
    admins:     { total: totalAdmins,  active: activeAdmins,  inactive: inactiveAdmins },
    rooms:      { total: totalRooms,   active: activeRooms,   completed: completedRooms },
    matches:    { total: totalMatches, active: activeMatches, completed: completedMatches },
    sportTypes: totalSportTypes,
  };
};

module.exports = {
  createAdmin,
  getAllAdmins,
  getAdminById,
  activateAdmin,
  deactivateAdmin,
  removeAdmin,
  getDashboardStats,
};
