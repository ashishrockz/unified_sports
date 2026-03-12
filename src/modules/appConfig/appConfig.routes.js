const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { requireAdmin } = require('../../middlewares/admin.middleware');
const {
  getPublicConfigHandler,
  getAdminConfigHandler,
  updateConfigHandler,
  testSmsHandler,
  testSmtpHandler,
} = require('./appConfig.controller');

// Public — mobile app fetches config on startup
router.get('/', getPublicConfigHandler);

// Admin-only — full config with metadata
router.get('/admin', protect, requireAdmin, getAdminConfigHandler);

// Admin-only — partial section updates
router.put('/', protect, requireAdmin, updateConfigHandler);

// Admin-only — test integrations
router.post('/test-sms', protect, requireAdmin, testSmsHandler);
router.post('/test-smtp', protect, requireAdmin, testSmtpHandler);

module.exports = router;
