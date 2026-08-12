/**
 * LLMTrack Usage Tracker
 * Handles calculating elapsed durations, tracking daily usage stats,
 * persisting to storage, and splitting sessions that cross midnight.
 */

import { getData, setData } from "../utils/storage.js";
import { getLocalDateString } from "../utils/time.js";

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
 * Records usage duration for a platform in the daily usage stats.
 * Uses splitSessionByDay to handle midnight boundaries.
 * @param {string} platform - The LLM platform id (e.g. 'chatgpt').
 * @param {number} startTime - Start timestamp in ms.
 * @param {number} endTime - End timestamp in ms.
 * @returns {Promise<object>} The updated daily usage object.
 */
export async function recordSessionUsage(platform, startTime, endTime) {
  if (!platform || !startTime || !endTime || endTime <= startTime) {
    const storageData = await getData("dailyUsage");
    return storageData.dailyUsage || {};
  }

  const segments = splitSessionByDay(startTime, endTime);
  const storageData = await getData("dailyUsage");
  const dailyUsage = storageData.dailyUsage || {};

  segments.forEach(segment => {
    const { date, durationMs } = segment;
    // Calculate seconds, ensuring we don't drop fractions of a second completely
    // by using standard rounding or floor. Since we are doing floor, let's keep it consistent.
    const durationSeconds = Math.floor(durationMs / 1000);
    if (durationSeconds <= 0) return;

    if (!dailyUsage[date]) {
      dailyUsage[date] = {};
    }
    if (!dailyUsage[date][platform]) {
      dailyUsage[date][platform] = { totalUsageSeconds: 0 };
    }
    dailyUsage[date][platform].totalUsageSeconds += durationSeconds;

    console.log(`[LLMTrack] Usage added: ${platform} +${durationSeconds}s for ${date}`);
  });

  await setData({ dailyUsage });
  return dailyUsage;
}

/**
 * Gets the daily usage data from storage.
 * @returns {Promise<object>} The daily usage object.
 */
export async function getDailyUsage() {
  const storageData = await getData("dailyUsage");
  return storageData.dailyUsage || {};
}
