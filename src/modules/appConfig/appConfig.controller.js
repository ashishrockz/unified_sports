const { getConfig, getPublicConfig, updateConfig } = require('./appConfig.service');
const { testSmtpConnection } = require('../../config/mailer');
const { testTwilioConnection } = require('../../config/sms');

/**
 * GET /api/app-config  (public — no auth required)
 * Supports conditional fetch: ?since=<version> returns 304 if unchanged.
 */
const getPublicConfigHandler = async (req, res, next) => {
  try {
    const sinceVersion = Number(req.query.since) || 0;
    const config = await getPublicConfig();

    if (sinceVersion && config.version <= sinceVersion) {
      return res.status(304).end();
    }

    res.json(config);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/app-config/admin  (admin-only — full config with metadata)
 */
const getAdminConfigHandler = async (req, res, next) => {
  try {
    const config = await getConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/app-config  (admin-only — partial section updates)
 * Body can contain any combination of: maintenance, features, settings, content, branding
 */
const updateConfigHandler = async (req, res, next) => {
  try {
    const config = await updateConfig(req.body, req.user._id, req.ip);
    res.json({ message: 'Configuration updated', version: config.version });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/app-config/test-sms  (admin-only)
 * Body: { phoneNumber: '+919876543210' }
 */
const testSmsHandler = async (req, res, next) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: 'Phone number is required' });
    }
    const result = await testTwilioConnection(phoneNumber);
    res.json({ message: 'Test SMS sent successfully', ...result });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to send test SMS' });
  }
};

/**
 * POST /api/app-config/test-smtp  (admin-only)
 * Body: { email: 'test@example.com' }
 */
const testSmtpHandler = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    const result = await testSmtpConnection(email);
    res.json({ message: 'Test email sent successfully', ...result });
  } catch (err) {
    res.status(400).json({ message: err.message || 'Failed to send test email' });
  }
};

module.exports = { getPublicConfigHandler, getAdminConfigHandler, updateConfigHandler, testSmsHandler, testSmtpHandler };
