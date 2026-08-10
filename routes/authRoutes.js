const express = require("express");
const { register, login, logout, getMe, updatePassword, updateProfile } = require("../controllers/authController");
const { protect, authorize } = require("../middleware/auth");
const loginLimiter = require("../middleware/authLimiter");
const validate = require("../middleware/validate");
const { register: registerV, login: loginV, updateProfile: updateProfileV, updatePassword: updatePasswordV } = require("../middleware/validators");

const router = express.Router();

router.post(
  "/register",
  registerV,
  validate,
  (req, res, next) => {
    // Attempt to attach user if a token is present (optional auth) so we can check admin role
    if (req.cookies?.token || req.headers.authorization) {
      return protect(req, res, () => register(req, res, next));
    }
    return register(req, res, next);
  }
);

router.post(
  "/prathachaiadmin@2026/login",
  loginLimiter,
  loginV,
  validate,
  login
);

router.post("/logout", protect, logout);
router.get("/me", protect, getMe);
router.put(
  "/profile",
  protect,
  updateProfileV,
  validate,
  updateProfile
);
router.put(
  "/update-password",
  protect,
  updatePasswordV,
  validate,
  updatePassword
);

module.exports = router;
