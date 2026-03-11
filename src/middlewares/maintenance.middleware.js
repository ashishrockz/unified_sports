const { getConfig } = require('../modules/appConfig/appConfig.service');

/**
 * Global middleware that blocks non-admin API requests when maintenance mode is on.
 * Must be registered BEFORE API route handlers in app.js.
 *
 * Always allows:
 *  - GET /api/app-config  (mobile needs to know maintenance state)
 *  - /api/admin/*          (admins must manage during maintenance)
 *  - /api/superadmin/*     (superadmins must manage during maintenance)
 *  - /api/docs*            (Swagger docs)
 *  - /                     (health check)
 */
const maintenanceCheck = async (req, res, next) => {
  try {
    const config = await getConfig();

    if (!config.maintenance || !config.maintenance.enabled) {
      return next();
    }

    // Always allow these paths through
    const path = req.originalUrl || req.url;
    if (
      path === '/api/app-config' ||
      path.startsWith('/api/app-config?') ||
      path.startsWith('/api/admin') ||
      path.startsWith('/api/superadmin') ||
      path.startsWith('/api/docs') ||
      path === '/'
    ) {
      return next();
    }

    return res.status(503).json({
      message: config.maintenance.message || 'Service temporarily unavailable',
      title: config.maintenance.title || 'Under Maintenance',
      estimatedEndTime: config.maintenance.estimatedEndTime || null,
    });
  } catch (err) {
    // If config fetch fails, don't block the app
    console.error('Maintenance middleware error:', err.message);
    next();
  }
};

module.exports = { maintenanceCheck };
