/**
 * LLMTrack Usage Tracker
 * Handles calculating elapsed durations, tracking daily usage stats,
 * persisting to storage, and splitting sessions that cross midnight.
 */

import { getData, setData } from "../utils/storage.js";
import { getLocalDateString, splitSessionByDay, getCurrentWeekDates } from "../utils/time.js";

/**
 * Clean up/remove daily usage records older than the current week's Monday to maintain storage efficiency.
 * Ensures the active history contains only the current week's dates (Monday -> Sunday).
 * @returns {Promise<object>} The cleaned daily usage object.
 */
export async function performWeeklyRolloverCleanup() {
  const currentWeekDates = getCurrentWeekDates();
  const storageData = await getData("dailyUsage");
  const dailyUsage = storageData.dailyUsage || {};

  let changed = false;
  // Remove any keys that are older than current week's Monday
  for (const dateKey of Object.keys(dailyUsage)) {
    if (!currentWeekDates.includes(dateKey)) {
      delete dailyUsage[dateKey];
      changed = true;
    }
  }

  if (changed) {
    console.log("[LLMTrack] Cleaned up old week data from dailyUsage. Active current week dates:", currentWeekDates);
    await setData({ dailyUsage });
  }
  return dailyUsage;
}

/**
 * Records the first opened timestamp of the day for a platform if it doesn't already exist.
 * Keeps "Started Today" timestamp unchanged for the rest of the day.
 * @param {string} platform - The LLM platform id.
 * @param {number} timestamp - The current epoch timestamp in ms.
 * @returns {Promise<object>} The updated daily usage object.
 */
export async function recordFirstOpened(platform, timestamp) {
  if (!platform || !timestamp) {
    const dailyUsage = await performWeeklyRolloverCleanup();
    return dailyUsage;
  }

  const date = getLocalDateString(new Date(timestamp));
  // Perform weekly cleanup before record, just in case
  const dailyUsage = await performWeeklyRolloverCleanup();

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
    const dailyUsage = await performWeeklyRolloverCleanup();
    return dailyUsage;
  }

  const segments = splitSessionByDay(startTime, endTime);
  const dailyUsage = await performWeeklyRolloverCleanup();

  segments.forEach(segment => {
    const { date, durationMs } = segment;
    // Calculate seconds, ensuring we don't drop fractions of a second completely
    // by using standard rounding or floor. Since we are doing floor, let's keep it consistent.
    const durationSeconds = Math.floor(durationMs / 1000);
    if (durationSeconds <= 0) return;

    // Only save the usage segment if it belongs to the current week's dates
    const currentWeekDates = getCurrentWeekDates();
    if (currentWeekDates.includes(date)) {
      if (!dailyUsage[date]) {
        dailyUsage[date] = {};
      }
      if (!dailyUsage[date][platform]) {
        dailyUsage[date][platform] = { totalUsageSeconds: 0 };
      }
      dailyUsage[date][platform].totalUsageSeconds += durationSeconds;
      console.log(`[LLMTrack] Usage added: ${platform} +${durationSeconds}s for ${date}`);
    } else {
      console.log(`[LLMTrack] Discarded segment ${platform} +${durationSeconds}s for old week date: ${date}`);
    }
  });

  await setData({ dailyUsage });
  return dailyUsage;
}

/**
 * Gets the daily usage data from storage.
 * Runs cleanups first to maintain data integrity.
 * @returns {Promise<object>} The daily usage object.
 */
export async function getDailyUsage() {
  const dailyUsage = await performWeeklyRolloverCleanup();
  return dailyUsage;
}

/**
 * Generates a single, authoritative, precise usage and session snapshot.
 * Combines persisted storage, current week bounds, and the live running session's exact elapsed seconds.
 * Both the main popup and the 7-day history must derive their displayed values from this snapshot.
 * @param {object|null} activeSession - Current active session memory state.
 * @returns {Promise<object>} Authoritative snapshot.
 */
export async function getUsageSnapshot(activeSession) {
  const currentWeekDates = getCurrentWeekDates();
  const todayStr = getLocalDateString();
  const dailyUsage = await performWeeklyRolloverCleanup();

  // Create a deep copy to prevent mutating the persisted storage in memory
  const snapshotUsage = JSON.parse(JSON.stringify(dailyUsage));

  // If there is an active session running, split its live elapsed time up to now
  // and temporarily add it to the snapshot copy.
  if (activeSession && activeSession.activePlatform && activeSession.sessionStartedAt) {
    const platform = activeSession.activePlatform;
    const segments = splitSessionByDay(activeSession.sessionStartedAt, Date.now());

    segments.forEach(seg => {
      const { date, durationMs } = seg;
      const seconds = Math.floor(durationMs / 1000);
      if (seconds <= 0) return;

      if (currentWeekDates.includes(date)) {
        if (!snapshotUsage[date]) {
          snapshotUsage[date] = {};
        }
        if (!snapshotUsage[date][platform]) {
          snapshotUsage[date][platform] = { totalUsageSeconds: 0 };
        }
        snapshotUsage[date][platform].totalUsageSeconds += seconds;
      }
    });
  }

  // Construct structured daily and weekly weekData mapping
  const weekData = {};
  currentWeekDates.forEach(date => {
    const dayData = snapshotUsage[date] || {};
    const chatgpt = (dayData.chatgpt && dayData.chatgpt.totalUsageSeconds) || 0;
    const gemini = (dayData.gemini && dayData.gemini.totalUsageSeconds) || 0;
    const claude = (dayData.claude && dayData.claude.totalUsageSeconds) || 0;

    const chatgptFirst = (dayData.chatgpt && dayData.chatgpt.firstOpenedAt) || null;
    const geminiFirst = (dayData.gemini && dayData.gemini.firstOpenedAt) || null;
    const claudeFirst = (dayData.claude && dayData.claude.firstOpenedAt) || null;

    weekData[date] = {
      chatgpt,
      gemini,
      claude,
      total: chatgpt + gemini + claude,
      firstOpened: {
        chatgpt: chatgptFirst,
        gemini: geminiFirst,
        claude: claudeFirst
      }
    };
  });

  return {
    activePlatform: (activeSession && activeSession.activePlatform) || null,
    activeTabId: (activeSession && activeSession.activeTabId) || null,
    sessionStartedAt: (activeSession && activeSession.sessionStartedAt) || null,
    todayStr,
    weekData
  };
}
