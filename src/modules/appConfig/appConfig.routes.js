const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const {
  getPublicConfigHandler,
  getAdminConfigHandler,
  updateConfigHandler,
} = require('./appConfig.controller');

// Public — mobile app fetches config on startup
router.get('/', getPublicConfigHandler);

// Admin-only — full config with metadata
router.get('/admin', protect, requireAdmin, getAdminConfigHandler);

// Admin-only — partial section updates
router.put('/', protect, requireAdmin, updateConfigHandler);

module.exports = router;
