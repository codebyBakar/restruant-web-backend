const asyncHandler = require("../middleware/asyncHandler");
const User = require("../models/User");
const { sendTokenResponse } = require("../utils/generateToken");

// @desc    Register first admin (should be disabled/protected after initial setup in production)
// @route   POST /api/auth/register
// @access  Public (only allowed if no admin exists yet) OR Private/admin for adding staff
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const existingAdminCount = await User.countDocuments();
  // If an admin already exists, only a logged-in admin can create more staff accounts
  if (existingAdminCount > 0) {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin account already exists. Only an existing admin can create new staff accounts.",
      });
    }
  }

  const userExists = await User.findOne({ email });
  if (userExists) {
    return res.status(400).json({ success: false, message: "Email already registered" });
  }

  const user = await User.create({
    name,
    email,
    password,
    role: existingAdminCount === 0 ? "admin" : role || "staff",
  });

  sendTokenResponse(user, 201, res);
});

// @desc    Login
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password +loginAttempts +lockUntil");
  if (!user || !user.isActive) {
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  if (user.isLocked()) {
    const remaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
    return res.status(429).json({
      success: false,
      message: `Account temporarily locked. Try again in ${remaining} minute(s).`,
    });
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    user.loginAttempts += 1;
    if (user.loginAttempts >= 5) {
      user.lockUntil = Date.now() + 15 * 60 * 1000;
      user.loginAttempts = 0;
      await user.save({ validateBeforeSave: false });
      return res.status(429).json({
        success: false,
        message: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes.",
      });
    }
    await user.save({ validateBeforeSave: false });
    return res.status(401).json({ success: false, message: "Invalid credentials" });
  }

  user.loginAttempts = 0;
  user.lockUntil = undefined;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res);
});

// @desc    Logout
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res) => {
  res.cookie("token", "none", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ success: true, message: "Logged out" });
});

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// @desc    Update admin profile (email and/or password)
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (name && name !== user.name) {
    user.name = name;
  }

  if (email && email !== user.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    user.email = email;
  }

  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ success: false, message: "Current password is required to set a new password" });
    }
    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "New password must be at least 8 characters" });
    }
    user.password = newPassword;
  }

  await user.save();
  sendTokenResponse(user, 200, res);
});

// @desc    Update password
// @route   PUT /api/auth/update-password
// @access  Private
exports.updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id).select("+password");

  const isMatch = await user.matchPassword(currentPassword);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: "Current password is incorrect" });
  }

  user.password = newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});
