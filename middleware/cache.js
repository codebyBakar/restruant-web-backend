const NodeCache = require("node-cache");

// stdTTL in seconds - default cache time
const cache = new NodeCache({ stdTTL: 120, checkperiod: 60 });

/**
 * Cache GET responses by full request URL.
 * Usage: router.get('/', cacheMiddleware(300), controller)
 */
const cacheMiddleware = (ttlSeconds = 120) => (req, res, next) => {
  if (req.method !== "GET") return next();

  const key = req.originalUrl;
  const cached = cache.get(key);

  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached);
  }

  res.setHeader("X-Cache", "MISS");
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode === 200 && body && body.success !== false) {
      cache.set(key, JSON.parse(JSON.stringify(body)), ttlSeconds);
    }
    return originalJson(body);
  };
  next();
};

/**
 * Clear cache keys matching a prefix, e.g. '/api/products'
 */
const clearCacheByPrefix = (prefix) => {
  const keys = cache.keys().filter((k) => k.startsWith(prefix));
  cache.del(keys);
};

module.exports = { cache, cacheMiddleware, clearCacheByPrefix };
