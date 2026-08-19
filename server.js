require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

// Behind a proxy (Railway/Render/etc.) the X-Forwarded-For header is set by the
// edge proxy. Without this, express-rate-limit rejects requests with
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. Trust the first hop only.
app.set("trust proxy", 1);

// ---------- Performance middleware ----------
app.use(compression());

// ---------- Security middleware ----------
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

if (process.env.NODE_ENV !== "production") {
  morgan.token("clean-url", (req) => req.path);
  app.use(morgan(":method :clean-url :status :response-time ms"));
}

// Skip rate limiting for authenticated admin/staff requests
const isAdminRequest = (req) => {
  try {
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith("Bearer")
        ? req.headers.authorization.split(" ")[1]
        : null);
    if (!token) return false;
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.role === "admin" || decoded.role === "staff";
  } catch {
    return false;
  }
};

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isAdminRequest,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", globalLimiter);

// Stricter limiter for auth endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isAdminRequest,
  message: { success: false, message: "Too many auth attempts, please try again later." },
});
app.use("/api/auth/prathachaiadmin@2026/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Stricter limiter for the public contact form to prevent spam abuse
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isAdminRequest,
  message: { success: false, message: "Too many messages from your IP. Please try again later." },
});
app.use("/api/contact", contactLimiter);

// ---------- Routes ----------
app.get("/api/health", (req, res) => {
  res.status(200).json({ success: true, message: "Pratha API is running", time: new Date().toISOString() });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/tags", require("./routes/tagRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/deals", require("./routes/dealRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/settings", require("./routes/settingsRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));

// ---------- Serve the built frontend (production, single-host deploy) ----------
const distPath = path.join(__dirname, "..", "frontend", "dist");
if (process.env.NODE_ENV === "production" && fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^(?!\/api\/|\/uploads\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Start server AFTER MongoDB connection is confirmed
connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Pratha backend running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
    });

    process.on("unhandledRejection", (err) => {
      console.error(`Unhandled Rejection: ${err.message}`);
      if (err?.stack) console.error(err.stack);
    });
  })
  .catch((err) => {
    console.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  });
