const crypto = require("crypto");

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 24 letters (no I/O for clarity)
const DIGITS = "23456789"; // 8 digits (no 0/1 to avoid confusion)

const pick = (arr, n) => {
  const bytes = crypto.randomBytes(n);
  return Array.from(bytes, (b) => arr[b % arr.length]);
};

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomBytes(1)[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Generate a cryptographically random order number.
 *
 * Format: `PC-XX99-XX99` (13 characters)
 *
 * Each 4-char group has EXACTLY 2 letters + 2 digits, shuffled.
 * This guarantees every order number has a balanced letter+digit mix.
 *
 *   PC          – brand prefix (Paratha)
 *   XXXX-XXXX   – two groups of 2 letters + 2 digits each
 *
 * Security: per-group C(4,2) × 24² × 8² ≈ 440 billion combinations.
 */
const generateOrderNumber = () => {
  // Build two groups, each with exactly 2 letters + 2 digits
  const g1 = shuffle([...pick(LETTERS, 2), ...pick(DIGITS, 2)]);
  const g2 = shuffle([...pick(LETTERS, 2), ...pick(DIGITS, 2)]);
  return `PC-${g1.join("")}-${g2.join("")}`;
};

module.exports = generateOrderNumber;
