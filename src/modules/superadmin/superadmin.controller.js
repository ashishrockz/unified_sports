const {
  createAdmin,
  getAllAdmins,
  getAdminById,
  activateAdmin,
  deactivateAdmin,
  removeAdmin,
  getDashboardStats,
} = require('./superadmin.service');
const { logAction } = require('../auditLog/auditLog.service');

const createAdminHandler = async (req, res, next) => {
  try {
    const admin = await createAdmin(req.body);
    logAction({ actor: req.user._id, action: 'admin.create', targetModel: 'User', targetId: admin._id, details: { name: admin.name, email: admin.email, role: admin.role }, ip: req.ip });
    res.status(201).json({ message: 'Admin account created successfully', admin });
  } catch (err) {
    next(err);
  }
};

const getAllAdminsHandler = async (req, res, next) => {
  try {
    const { search, status, page, limit } = req.query;
    const result = await getAllAdmins({ search, status, page, limit });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getAdminByIdHandler = async (req, res, next) => {
  try {
    const admin = await getAdminById(req.params.adminId);
    res.json(admin);
  } catch (err) {
    next(err);
  }
};

const activateAdminHandler = async (req, res, next) => {
  try {
    const admin = await activateAdmin(req.user._id, req.params.adminId);
    logAction({ actor: req.user._id, action: 'admin.activate', targetModel: 'User', targetId: req.params.adminId, details: { adminName: admin.name || admin.email }, ip: req.ip });
    res.json({ message: `Admin "${admin.name || admin.email}" has been activated`, admin });
  } catch (err) {
    next(err);
  }
};

const deactivateAdminHandler = async (req, res, next) => {
  try {
    const admin = await deactivateAdmin(req.user._id, req.params.adminId);
    logAction({ actor: req.user._id, action: 'admin.deactivate', targetModel: 'User', targetId: req.params.adminId, details: { adminName: admin.name || admin.email }, ip: req.ip });
    res.json({ message: `Admin "${admin.name || admin.email}" has been deactivated`, admin });
  } catch (err) {
    next(err);
  }
};

const removeAdminHandler = async (req, res, next) => {
  try {
    const result = await removeAdmin(req.user._id, req.params.adminId);
    logAction({ actor: req.user._id, action: 'admin.remove', targetModel: 'User', targetId: req.params.adminId, details: { removedAdminId: req.params.adminId }, ip: req.ip });
    res.json(result);
  } catch (err) {
    next(err);
  }
};

const getDashboardStatsHandler = async (req, res, next) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createAdminHandler,
  getAllAdminsHandler,
  getAdminByIdHandler,
  activateAdminHandler,
  deactivateAdminHandler,
  removeAdminHandler,
  getDashboardStatsHandler,
};
