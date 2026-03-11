const { getConfig, getPublicConfig, updateConfig } = require('./appConfig.service');

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

module.exports = { getPublicConfigHandler, getAdminConfigHandler, updateConfigHandler };
