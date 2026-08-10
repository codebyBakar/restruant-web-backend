// Compute restaurant open/closed status from settings using a fixed timezone.
// Handles overnight schedule (close before open, e.g. 20:00 - 02:00).

function toMinutes(time) {
  if (!time || typeof time !== "string") return null;
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function to12h(time) {
  if (!time || typeof time !== "string") return time;
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2, "0")} ${period}`;
}

// Returns true when the restaurant is currently open.
function isStoreOpen(settings, now = new Date()) {
  const st = (settings && settings.storeStatus) || {};
  if (st.mode === "manual") return st.manualOpen !== false;
  if (st.mode && st.mode !== "auto") return true;

  const timezone = st.timezone || "Asia/Karachi";
  const openTime = st.openTime || "11:00";
  const closeTime = st.closeTime || "23:00";

  const parts = {};
  try {
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .forEach((p) => {
        parts[p.type] = p.value;
      });
  } catch {
    return true;
  }

  const nowMin = Number(parts.hour || 0) * 60 + Number(parts.minute || 0);
  const openMin = toMinutes(openTime);
  const closeMin = toMinutes(closeTime);
  if (openMin === null || closeMin === null) return true;

  if (openMin === closeMin) return false; // closed all day
  if (closeMin > openMin) return nowMin >= openMin && nowMin < closeMin;
  // Overnight schedule: open until closeMin next morning
  return nowMin >= openMin || nowMin < closeMin;
}

// Human readable current time in the store's timezone, e.g. "08:15".
function currentStoreTime(settings, now = new Date()) {
  const st = (settings && settings.storeStatus) || {};
  const timezone = st.timezone || "Asia/Karachi";
  try {
    const t = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(now);
    return t;
  } catch {
    return "";
  }
}

// Message to show users while the restaurant is closed.
// Auto mode: show opening hours. Manual mode: show the admin-written message.
function storeClosedMessage(settings, fallback = "We're currently closed.") {
  const st = (settings && settings.storeStatus) || {};
  if (st.mode === "manual") {
    return (st.closedMessage || "").trim() || fallback;
  }
  const openTime = st.openTime || "11:00";
  const closeTime = st.closeTime || "23:00";
  return `We're currently closed. Opening hours: ${to12h(openTime)} - ${to12h(closeTime)}`;
}

module.exports = { isStoreOpen, currentStoreTime, storeClosedMessage };