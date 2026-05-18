const rateLimit = require('express-rate-limit');

function createLimiters(config) {
  const rlCfg = config.features?.rateLimit || {};

  const globalLimiter = rateLimit({
    windowMs: rlCfg.windowMs || 15 * 60 * 1000,
    max: rlCfg.globalMax || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
  });

  const authLimiter = rateLimit({
    windowMs: rlCfg.windowMs || 15 * 60 * 1000,
    max: rlCfg.authMax || 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, please try again later.' }
  });

  return { globalLimiter, authLimiter };
}

module.exports = { createLimiters };
