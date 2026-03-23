const { STAFF_ROLES, hasPermission, hasAnyPermission } = require('../config/permissions');

/**
 * requireStaff — must be used AFTER the protect middleware.
 * Allows any staff role (super_admin, admin, manager, editor, viewer) through.
 */
const requireStaff = (req, res, next) => {
  if (!req.user || !STAFF_ROLES.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden — staff access required' });
  }
  next();
};

/**
 * requireAdmin — must be used AFTER the protect middleware.
 * Allows super_admin and admin roles through.
 * Backwards-compatible alias for routes that need admin-level access.
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || !['super_admin', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden — admin access required' });
  }
  next();
};

/**
 * requireSuperAdmin — must be used AFTER the protect middleware.
 * Allows only 'super_admin' role through.
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Forbidden — super admin access required' });
  }
  next();
};

/**
 * requirePermission — granular permission check middleware.
 * Usage: router.get('/users', protect, requirePermission('users.read'), handler)
 *
 * @param {...string} permissions - One or more permission strings. User needs ANY ONE to pass.
 */
const requirePermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden — staff access required' });
    }

    if (!hasAnyPermission(req.user.role, permissions)) {
      return res.status(403).json({
        message: `Forbidden — requires permission: ${permissions.join(' or ')}`,
      });
    }

    next();
  };
};

module.exports = { requireStaff, requireAdmin, requireSuperAdmin, requirePermission };
