const AppConfig = require('./appConfig.model');
const { logAction } = require('../auditLog/auditLog.service');

// ── In-memory cache ─────────────────────────────────────────
let cachedConfig = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Get the singleton config, creating it with defaults if missing.
 * Uses in-memory cache to avoid DB hits on every request.
 */
const getConfig = async () => {
  if (cachedConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedConfig;
  }

  let config = await AppConfig.findOne({ key: 'active' });
  if (!config) {
    config = await AppConfig.create({ key: 'active' });
  }

  cachedConfig = config;
  cacheTimestamp = Date.now();
  return config;
};

/**
 * Return config stripped of admin-only fields for the public endpoint.
 */
const getPublicConfig = async () => {
  const config = await getConfig();
  const obj = config.toObject();

  // Strip admin-only fields
  delete obj._id;
  delete obj.__v;
  delete obj.key;
  delete obj.lastModifiedBy;
  delete obj.createdAt;
  delete obj.updatedAt;
  if (obj.maintenance) {
    delete obj.maintenance.allowedRoles;
    delete obj.maintenance._id;
  }
  if (obj.features) delete obj.features._id;
  if (obj.settings) delete obj.settings._id;
  if (obj.content) {
    delete obj.content._id;
    if (obj.content.announcement) delete obj.content.announcement._id;
    if (obj.content.forceUpdate) delete obj.content.forceUpdate._id;
  }
  if (obj.branding) {
    delete obj.branding._id;
    if (obj.branding.splashScreen) delete obj.branding.splashScreen._id;
  }
  // Never expose integrations (credentials) to public
  delete obj.integrations;
  if (obj.advertisements) {
    delete obj.advertisements._id;
    if (obj.advertisements.placements) {
      delete obj.advertisements.placements._id;
      if (obj.advertisements.placements.splash) delete obj.advertisements.placements.splash._id;
      if (obj.advertisements.placements.homeBanner) delete obj.advertisements.placements.homeBanner._id;
      if (obj.advertisements.placements.tossScreen) delete obj.advertisements.placements.tossScreen._id;
    }
    // Clean up AdMob units _id fields
    if (obj.advertisements.admob) {
      delete obj.advertisements.admob._id;
      if (Array.isArray(obj.advertisements.admob.units)) {
        obj.advertisements.admob.units = obj.advertisements.admob.units.map((u) => {
          const { _id, ...rest } = u;
          return rest;
        });
      }
    }
  }

  return obj;
};

/**
 * Merge partial updates into the config and persist.
 */
const updateConfig = async (updates, actorId, ip) => {
  const config = await getConfig();
  const oldVersion = config.version;

  // Merge each top-level section
  const sections = ['maintenance', 'features', 'settings', 'content', 'branding', 'advertisements', 'integrations'];
  const changes = {};

  for (const section of sections) {
    if (updates[section] && typeof updates[section] === 'object') {
      changes[section] = {};
      for (const [field, value] of Object.entries(updates[section])) {
        if (config[section] && config[section][field] !== undefined) {
          // Arrays should be replaced wholesale (e.g. admob.units)
          if (Array.isArray(value)) {
            changes[section][field] = { from: config[section][field], to: value };
            config[section][field] = value;
          }
          // For nested objects (announcement, forceUpdate, admob), merge deeper
          else if (
            typeof value === 'object' &&
            value !== null &&
            typeof config[section][field] === 'object'
          ) {
            for (const [subKey, subVal] of Object.entries(value)) {
              // Nested arrays (e.g. admob.units) are replaced wholesale
              if (Array.isArray(subVal)) {
                changes[section][`${field}.${subKey}`] = { from: config[section][field][subKey], to: subVal };
                config[section][field][subKey] = subVal;
              } else if (config[section][field][subKey] !== subVal) {
                changes[section][`${field}.${subKey}`] = {
                  from: config[section][field][subKey],
                  to: subVal,
                };
                config[section][field][subKey] = subVal;
              } else {
                config[section][field][subKey] = subVal;
              }
            }
          } else {
            if (config[section][field] !== value) {
              changes[section][field] = {
                from: config[section][field],
                to: value,
              };
            }
            config[section][field] = value;
          }
        }
      }
      // Remove empty change sections
      if (Object.keys(changes[section]).length === 0) {
        delete changes[section];
      }
    }
  }

  config.lastModifiedBy = actorId;
  config.markModified('maintenance');
  config.markModified('features');
  config.markModified('settings');
  config.markModified('content');
  config.markModified('branding');
  config.markModified('advertisements');
  config.markModified('integrations');

  await config.save();

  // Invalidate cache immediately
  cachedConfig = config;
  cacheTimestamp = Date.now();

  // Audit log
  if (Object.keys(changes).length > 0) {
    await logAction({
      actor: actorId,
      action: 'appConfig.update',
      targetModel: 'AppConfig',
      targetId: config._id,
      details: { previousVersion: oldVersion, newVersion: config.version, changes },
      ip,
    });
  }

  return config;
};

/**
 * Invalidate the in-memory cache (e.g. for testing).
 */
const invalidateCache = () => {
  cachedConfig = null;
  cacheTimestamp = 0;
};

module.exports = { getConfig, getPublicConfig, updateConfig, invalidateCache };
