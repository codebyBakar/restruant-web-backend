const rateLimit = require("express-rate-limit");

// Dedicated brute-force guard for the login endpoint.
// Successful logins are not counted so legitimate admins are never blocked.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true,
});

module.exports = loginLimiter;
