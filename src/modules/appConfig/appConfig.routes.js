const router = require('express').Router();
const { protect } = require('../../middlewares/auth.middleware');
const { requirePermission } = require('../../middlewares/admin.middleware');
const {
  getPublicConfigHandler,
  getAdminConfigHandler,
  updateConfigHandler,
  testSmsHandler,
  testSmtpHandler,
} = require('./appConfig.controller');

// Public — mobile app fetches config on startup
router.get('/', getPublicConfigHandler);

// Staff with settings.read — full config with metadata
router.get('/admin', protect, requirePermission('settings.read'), getAdminConfigHandler);

// Staff with settings.update — partial section updates
router.put('/', protect, requirePermission('settings.update'), updateConfigHandler);

// Staff with system_config permissions — test integrations
router.post('/test-sms', protect, requirePermission('system_config.update'), testSmsHandler);
router.post('/test-smtp', protect, requirePermission('system_config.update'), testSmtpHandler);

module.exports = router;
