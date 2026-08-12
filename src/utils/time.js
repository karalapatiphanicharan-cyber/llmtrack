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

/**
 * Splits a session crossing midnight boundaries into segments for each local calendar date.
 * @param {number} startTime - Start timestamp in ms.
 * @param {number} endTime - End timestamp in ms.
 * @returns {Array<{date: string, durationMs: number}>} Segments of the session.
 */
export function splitSessionByDay(startTime, endTime) {
  if (!startTime || !endTime || endTime <= startTime) {
    return [];
  }

  const segments = [];
  let currentStart = startTime;

  while (currentStart < endTime) {
    const d = new Date(currentStart);
    // Get the timestamp of the next midnight in local timezone
    const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
    const nextMidnightTime = nextMidnight.getTime();

    if (endTime < nextMidnightTime) {
      const dateStr = getLocalDateString(new Date(currentStart));
      const durationMs = endTime - currentStart;
      segments.push({ date: dateStr, durationMs });
      break;
    } else {
      const dateStr = getLocalDateString(new Date(currentStart));
      const durationMs = nextMidnightTime - currentStart;
      segments.push({ date: dateStr, durationMs });
      currentStart = nextMidnightTime;
    }
  }

  return segments;
}

/**
 * Returns a Date representing the Monday 00:00:00 of the current week in local timezone.
 * @param {Date} [date] - Optional date object. Defaults to current date.
 * @returns {Date} Monday of the current week.
 */
export function getStartOfCurrentWeek(date = new Date()) {
  const currentDay = date.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
  const daysToSubtract = currentDay === 0 ? 6 : currentDay - 1;

  const monday = new Date(date);
  monday.setDate(date.getDate() - daysToSubtract);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Returns an array of YYYY-MM-DD date strings for the current Monday-Sunday week.
 * @param {Date} [date] - Optional date object. Defaults to current date.
 * @returns {string[]} Date strings.
 */
export function getCurrentWeekDates(date = new Date()) {
  const monday = getStartOfCurrentWeek(date);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(getLocalDateString(d));
  }
  return dates;
}
