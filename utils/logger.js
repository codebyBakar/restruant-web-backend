// Server-side logging only. Never sends details to the client.
const fs = require("fs");
const path = require("path");

const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "error.log");

const ensureLogDir = () => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

const timestamp = () => new Date().toISOString();

// Log full error details (stack, request info) for debugging.
const error = (req, err) => {
  const line = [
    `[${timestamp()}]`,
    req?.method ? `${req.method} ${req.originalUrl}` : "no-request",
    err?.message || "Unknown error",
  ].join(" | ");

  console.error(line);
  if (err?.stack) console.error(err.stack);

  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, `${line}\n`);
    if (err?.stack) fs.appendFileSync(LOG_FILE, `${err.stack}\n`);
  } catch (e) {
    // Logging must never crash the request cycle.
    console.error("Failed to write error log:", e.message);
  }
};

module.exports = { error, LOG_FILE };
