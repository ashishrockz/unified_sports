/**
 * requireAdmin — must be used AFTER the protect middleware.
 * Allows both 'admin' and 'superadmin' roles through.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden — admin access required' });
  }
  next();
};

/**
 * requireSuperAdmin — must be used AFTER the protect middleware.
 * Allows only 'superadmin' role through.
 * Admins (employees) are blocked here.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ message: 'Forbidden — super admin access required' });
  }
  next();
};

module.exports = { requireAdmin, requireSuperAdmin };
