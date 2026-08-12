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
