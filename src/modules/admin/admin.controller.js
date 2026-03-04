const {
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
} = require('./admin.service');
const { logAction } = require('../auditLog/auditLog.service');

const adminLoginHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    const result = await adminLogin(email, password);
    logAction({ actor: result.user._id, action: 'admin.login', targetModel: 'User', targetId: result.user._id, details: { email }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getAllUsersHandler = async (req, res, next) => {
  try {
    const { search, status, page, limit } = req.query;
    const result = await getAllUsers({ search, status, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getUserDetailHandler = async (req, res, next) => {
  try {
    const user = await getUserDetail(req.params.userId);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const banUserHandler = async (req, res, next) => {
  try {
    const user = await banUser(req.user._id, req.params.userId, req.user.role);
    logAction({ actor: req.user._id, action: 'user.ban', targetModel: 'User', targetId: req.params.userId, details: { userName: user.name || user.email }, ip: req.ip });
    res.json({ message: `User "${user.name || user.email}" has been banned`, user });
  } catch (err) {
    next(err);
  }
};

const unbanUserHandler = async (req, res, next) => {
  try {
    const user = await unbanUser(req.user._id, req.params.userId, req.user.role);
    logAction({ actor: req.user._id, action: 'user.unban', targetModel: 'User', targetId: req.params.userId, details: { userName: user.name || user.email }, ip: req.ip });
    res.json({ message: `User "${user.name || user.email}" has been unbanned`, user });
  } catch (err) {
    next(err);
  }
};

const activateUserHandler = async (req, res, next) => {
  try {
    const user = await activateUser(req.user._id, req.params.userId, req.user.role);
    logAction({ actor: req.user._id, action: 'user.activate', targetModel: 'User', targetId: req.params.userId, details: { userName: user.name || user.email }, ip: req.ip });
    res.json({ message: `User "${user.name || user.email}" has been activated`, user });
  } catch (err) {
    next(err);
  }
};

const deactivateUserHandler = async (req, res, next) => {
  try {
    const user = await deactivateUser(req.user._id, req.params.userId, req.user.role);
    logAction({ actor: req.user._id, action: 'user.deactivate', targetModel: 'User', targetId: req.params.userId, details: { userName: user.name || user.email }, ip: req.ip });
    res.json({ message: `User "${user.name || user.email}" has been deactivated`, user });
  } catch (err) {
    next(err);
  }
};

const getMyProfileHandler = async (req, res, next) => {
  try {
    res.json(req.user);
  } catch (err) {
    next(err);
  }
};

const changePasswordHandler = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await changePassword(req.user._id, currentPassword, newPassword);
    logAction({ actor: req.user._id, action: 'admin.change_password', targetModel: 'User', targetId: req.user._id, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getAdminDashboardHandler = async (req, res, next) => {
  try {
    const stats = await getAdminDashboard();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

const getAllRoomsAdminHandler = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await getAllRoomsAdmin({ status, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getRoomByIdAdminHandler = async (req, res, next) => {
  try {
    const room = await getRoomByIdAdmin(req.params.roomId);
    res.json(room);
  } catch (err) {
    next(err);
  }
};

const getAllMatchesAdminHandler = async (req, res, next) => {
  try {
    const { status, page, limit } = req.query;
    const result = await getAllMatchesAdmin({ status, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getMatchByIdAdminHandler = async (req, res, next) => {
  try {
    const match = await getMatchByIdAdmin(req.params.matchId);
    res.json(match);
  } catch (err) {
    next(err);
  }
};

const bulkUserActionHandler = async (req, res, next) => {
  try {
    const { userIds, action } = req.body;
    const statusMap = { ban: 'banned', unban: 'active', activate: 'active', deactivate: 'inactive' };
    const newStatus = statusMap[action];
    if (!newStatus) {
      return res.status(400).json({ message: 'Invalid action. Use: ban, unban, activate, deactivate' });
    }
    const result = await bulkChangeUserStatus(req.user._id, userIds, newStatus, req.user.role);
    logAction({ actor: req.user._id, action: `user.bulk_${action}`, targetModel: 'User', details: { userIds, action, successCount: result.success, errorCount: result.errors?.length || 0 }, ip: req.ip });
    res.json({ message: `Bulk ${action} completed`, ...result });
  } catch (err) {
    next(err);
  }
};

const exportUsersHandler = async (req, res, next) => {
  try {
    const { format = 'json', status } = req.query;
    const users = await exportUsers({ status });

    if (format === 'csv') {
      const header = 'Name,Username,Email,Phone,Status,Created At\n';
      const rows = users.map(u =>
        `"${(u.name || '').replace(/"/g, '""')}","${u.username || ''}","${u.email || ''}","${u.phone || ''}","${u.status}","${u.createdAt.toISOString()}"`
      ).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
      return res.send(header + rows);
    }

    res.json({ users, total: users.length });
  } catch (err) {
    next(err);
  }
};

const updateProfileHandler = async (req, res, next) => {
  try {
    const user = await updateProfile(req.user._id, req.body);
    logAction({ actor: req.user._id, action: 'admin.profile_update', targetModel: 'User', targetId: req.user._id, details: { updatedFields: Object.keys(req.body) }, ip: req.ip });
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    next(err);
  }
};

const uploadAvatarHandler = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await updateAvatar(req.user._id, avatarUrl);
    logAction({ actor: req.user._id, action: 'admin.avatar_upload', targetModel: 'User', targetId: req.user._id, ip: req.ip });
    res.json({ message: 'Avatar updated', user });
  } catch (err) {
    next(err);
  }
};

const forgotPasswordHandler = async (req, res, next) => {
  try {
    const result = await forgotPassword(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const resetPasswordHandler = async (req, res, next) => {
  try {
    const result = await resetPassword(req.body.token, req.body.newPassword);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  adminLoginHandler,
  getAllUsersHandler,
  getUserDetailHandler,
  banUserHandler,
  unbanUserHandler,
  activateUserHandler,
  deactivateUserHandler,
  getMyProfileHandler,
  changePasswordHandler,
  getAdminDashboardHandler,
  getAllRoomsAdminHandler,
  getRoomByIdAdminHandler,
  getAllMatchesAdminHandler,
  getMatchByIdAdminHandler,
  bulkUserActionHandler,
  exportUsersHandler,
  updateProfileHandler,
  uploadAvatarHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
};
