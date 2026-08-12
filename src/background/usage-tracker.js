/**
 * LLMTrack Usage Tracker
 * Handles calculating elapsed durations, tracking daily usage stats,
 * persisting to storage, and splitting sessions that cross midnight.
 */

import { getData, setData } from "../utils/storage.js";
import { getLocalDateString, splitSessionByDay } from "../utils/time.js";

/**
 * Records the first opened timestamp of the day for a platform if it doesn't already exist.
 * Keeps "Started Today" timestamp unchanged for the rest of the day.
 * @param {string} platform - The LLM platform id.
 * @param {number} timestamp - The current epoch timestamp in ms.
 * @returns {Promise<object>} The updated daily usage object.
 */
export async function recordFirstOpened(platform, timestamp) {
  if (!platform || !timestamp) {
    const storageData = await getData("dailyUsage");
    return storageData.dailyUsage || {};
  }

  const date = getLocalDateString(new Date(timestamp));
  const storageData = await getData("dailyUsage");
  const dailyUsage = storageData.dailyUsage || {};

  if (!dailyUsage[date]) {
    dailyUsage[date] = {};
  }
  if (!dailyUsage[date][platform]) {
    dailyUsage[date][platform] = { totalUsageSeconds: 0 };
  }

  // If firstOpenedAt is not set, set it now. If it's already set, do NOT overwrite it!
  if (!dailyUsage[date][platform].firstOpenedAt) {
    dailyUsage[date][platform].firstOpenedAt = timestamp;
    console.log(`[LLMTrack] Record firstOpenedAt for ${platform}: ${timestamp} (${date})`);
    await setData({ dailyUsage });
  }

  return dailyUsage;
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
