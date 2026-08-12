/**
 * Time and Date Utilities
 * Provides support for timestamps, date extraction, elapsed time, and duration formatting.
 */

/**
 * Returns current system timestamp (in milliseconds).
 * @returns {number} Timestamp in ms.
 */
export function getCurrentTimestamp() {
  return Date.now();
}

/**
 * Returns current local date in YYYY-MM-DD format.
 * @param {Date} [date] - Optional date object. Defaults to current date.
 * @returns {string} Date string.
 */
export function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

/**
 * Calculates elapsed time in milliseconds.
 * @param {number} startTimestamp - Starting timestamp (ms).
 * @param {number} [endTimestamp] - Ending timestamp (ms). Defaults to now.
 * @returns {number} Elapsed milliseconds.
 */
export function getElapsedTime(startTimestamp, endTimestamp = Date.now()) {
  if (!startTimestamp) return 0;
  return Math.max(0, endTimestamp - startTimestamp);
}

/**
 * Formats duration in milliseconds into a user-friendly string (e.g., "1h 24m 5s", "45s").
 * Used for old/internal utility compatibility.
 * @param {number} durationMs - Duration in milliseconds.
 * @returns {string} Formatted duration string.
 */
export function formatDuration(durationMs) {
  if (typeof durationMs !== "number" || isNaN(durationMs) || durationMs < 0) {
    return "0s";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds === 0) return "0s";

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Formats duration in milliseconds into human-readable session duration (minutes/hours only).
 * Handles:
 *  - Less than 1 minute: "<1 min"
 *  - E.g.: "1 min", "59 min", "1 hr", "1 hr 05 min", "2 hr 30 min"
 * @param {number} durationMs - Duration in milliseconds.
 * @returns {string} Clean session duration string.
 */
export function formatSessionDuration(durationMs) {
  if (typeof durationMs !== "number" || isNaN(durationMs) || durationMs < 0) {
    return "<1 min";
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds < 60) {
    return "<1 min";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours} hr`;
    }
    const paddedMinutes = String(minutes).padStart(2, "0");
    return `${hours} hr ${paddedMinutes} min`;
  } else {
    return `${minutes} min`;
  }
}

/**
 * Formats timestamp to user's local clean time format: h:mm A (e.g. "6:38 PM" or "12:05 AM")
 * @param {number} timestamp - Epoch time in ms.
 * @returns {string} Formatted clean time string.
 */
export function formatCleanTime(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // Hour '0' becomes '12'
  return `${hours}:${minutes} ${ampm}`;
}
