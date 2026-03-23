const NodeCache = require('node-cache');

// ── Cache instances with different TTLs ──────────────────────
const cache = {
  /** Short-lived: dashboard stats, active counts (2 min) */
  short: new NodeCache({ stdTTL: 120, checkperiod: 60 }),

  /** Medium-lived: leaderboards, analytics, sport types (5 min) */
  medium: new NodeCache({ stdTTL: 300, checkperiod: 120 }),

  /** Long-lived: app config, rarely-changing data (10 min) */
  long: new NodeCache({ stdTTL: 600, checkperiod: 300 }),
};

/**
 * Cache-through helper: returns cached value or calls fn() and caches the result.
 * @param {string} tier - 'short' | 'medium' | 'long'
 * @param {string} key - cache key
 * @param {Function} fn - async function to call on cache miss
 * @returns {Promise<any>}
 */
async function cacheThrough(tier, key, fn) {
  const store = cache[tier] || cache.short;
  const cached = store.get(key);
  if (cached !== undefined) return cached;

  const result = await fn();
  store.set(key, result);
  return result;
}

/**
 * Invalidate a specific key or pattern
 * @param {string} tier - 'short' | 'medium' | 'long' or 'all'
 * @param {string} [keyPattern] - specific key or prefix. If omitted, flushes entire tier.
 */
function invalidate(tier, keyPattern) {
  if (tier === 'all') {
    cache.short.flushAll();
    cache.medium.flushAll();
    cache.long.flushAll();
    return;
  }

  const store = cache[tier];
  if (!store) return;

  if (!keyPattern) {
    store.flushAll();
    return;
  }

  // Delete exact key or keys matching prefix
  const keys = store.keys().filter((k) => k === keyPattern || k.startsWith(keyPattern));
  keys.forEach((k) => store.del(k));
}

/**
 * Get cache statistics for monitoring
 */
function getStats() {
  return {
    short: cache.short.getStats(),
    medium: cache.medium.getStats(),
    long: cache.long.getStats(),
  };
}

module.exports = { cache, cacheThrough, invalidate, getStats };
