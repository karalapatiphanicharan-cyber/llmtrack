/**
 * LLMTrack Session Tracker
 * Manages active session lifecycle, same-platform tab switches,
 * platform switching, browser focus shifts, and transient navigation debouncing.
 */

import { recordSessionUsage, recordFirstOpened } from "./usage-tracker.js";
import { getData, setData } from "../utils/storage.js";
import { getLocalDateString } from "../utils/time.js";

// Central memory state for current active session
let activeSession = {
  activePlatform: null,
  activeTabId: null,
  sessionStartedAt: null,
  lastActive: null
};

// Reusable state recovery or persistence
async function saveSessionToStorage() {
  await setData({ activeSession });
}

// Timeout handle for the transient navigation debounce
let debounceTimeout = null;
const DEBOUNCE_DELAY_MS = 1500; // 1.5 seconds

/**
 * Loads session state from storage to handle service worker restart/recovery.
 * Returns a promise that resolves when activeState is loaded.
 */
export const initializationPromise = (async () => {
  try {
    const data = await getData("activeSession");
    if (data && data.activeSession) {
      activeSession = data.activeSession;
      console.log("[LLMTrack] Session state recovered:", activeSession);
    }
  } catch (err) {
    console.error("[LLMTrack] Failed to initialize session from storage:", err);
  }
})();

/**
 * Checks if the current active session is stale (i.e. has been inactive for too long,
 * or belongs to a different day/week with a long gap).
 * If stale, it finalizes the session up to its last active timestamp.
 */
export async function reconcileStaleSession() {
  const { activePlatform, sessionStartedAt, lastActive } = activeSession;
  if (!activePlatform || !sessionStartedAt) return;

  const now = Date.now();
  const maxGapMs = 15 * 60 * 1000; // 15 minutes

  const referenceTime = lastActive || sessionStartedAt;
  const gap = now - referenceTime;

  const startedDate = getLocalDateString(new Date(sessionStartedAt));
  const todayDate = getLocalDateString(new Date(now));
  const isDifferentDay = startedDate !== todayDate;

  // A session is stale if there is a gap of more than 15 minutes since lastActive,
  // OR if the session date is different from today and there is any significant gap (>5 min)
  if (gap > maxGapMs || (isDifferentDay && gap > 5 * 60 * 1000)) {
    console.log(`[LLMTrack] Stale session detected for ${activePlatform}. Started: ${sessionStartedAt}, Last Active: ${referenceTime}. Finalizing at Last Active.`);

    const endTime = Math.max(sessionStartedAt, referenceTime);
    await recordSessionUsage(activePlatform, sessionStartedAt, endTime);

    activeSession.activePlatform = null;
    activeSession.activeTabId = null;
    activeSession.sessionStartedAt = null;
    activeSession.lastActive = null;
    await saveSessionToStorage();
  }
}

/**
 * Updates the last active timestamp of the current session to now.
 */
export async function updateSessionLastActive() {
  await reconcileStaleSession();
  if (activeSession.activePlatform && activeSession.sessionStartedAt) {
    activeSession.lastActive = Date.now();
    await saveSessionToStorage();
  }
}

/**
 * Handle platform and tab state transitions.
 * Ensures transitions to 'Unsupported' (null) are debounced to prevent false negatives during page loading/navigation.
 * @param {string|null} newPlatform - The newly detected platform ('chatgpt', 'gemini', 'claude' or null).
 * @param {number|null} newTabId - The newly detected active tab's ID.
 */
export async function handleTransition(newPlatform, newTabId) {
  // Always reconcile stale session first before handling any transition
  await reconcileStaleSession();

  const prevPlatform = activeSession.activePlatform;
  const prevTabId = activeSession.activeTabId;

  // Clear any existing debounce timer when a new state arrives
  if (debounceTimeout) {
    clearTimeout(debounceTimeout);
    debounceTimeout = null;
  }

  // Case 1: Switching from supported platform to null (Unsupported)
  if (prevPlatform && !newPlatform) {
    // Initiate the reconciliation / debounce timer
    debounceTimeout = setTimeout(async () => {
      debounceTimeout = null;
      console.log(`[LLMTrack] Debounce elapsed. Ending session for ${prevPlatform}`);
      await endActiveSession();
    }, DEBOUNCE_DELAY_MS);

    // We update the activeTabId and keep the activeSession in-memory as still running for now,
    // so if user returns or navigation finishes, it's continuous.
    activeSession.activeTabId = newTabId;
    activeSession.lastActive = Date.now();
    await saveSessionToStorage();
    return;
  }

  // Case 2: Returning to the SAME supported platform
  if (newPlatform && prevPlatform === newPlatform) {
    // If we switched tabs but on the same platform
    if (prevTabId !== newTabId) {
      console.log(`[LLMTrack] Same-platform tab switch: ${newPlatform} (tab ${prevTabId} -> ${newTabId})`);
      console.log(`[LLMTrack] Existing session preserved`);
      activeSession.activeTabId = newTabId;
    }
    activeSession.lastActive = Date.now();
    await saveSessionToStorage();
    return;
  }

  // Case 3: Switching from unsupported/null to a supported platform, or switching between different supported platforms
  if (newPlatform) {
    if (prevPlatform) {
      // Platform changed: chatgpt -> gemini, etc.
      console.log(`[LLMTrack] Platform changed: ${prevPlatform} → ${newPlatform}`);
      await endActiveSession();
    }

    // Start new session
    activeSession.activePlatform = newPlatform;
    activeSession.activeTabId = newTabId;
    activeSession.sessionStartedAt = Date.now();
    activeSession.lastActive = Date.now();
    await saveSessionToStorage();
    console.log(`[LLMTrack] Session started: ${newPlatform}`);

    // Persist firstOpenedAt for this platform today
    await recordFirstOpened(newPlatform, activeSession.sessionStartedAt);
  }
}

/**
 * Ends the active session, calculates elapsed time, records daily usage,
 * and resets session memory.
 */
export async function endActiveSession() {
  const { activePlatform, sessionStartedAt, lastActive } = activeSession;
  if (activePlatform && sessionStartedAt) {
    const endTime = Date.now();
    console.log(`[LLMTrack] Session ended: ${activePlatform}`);
    await recordSessionUsage(activePlatform, sessionStartedAt, endTime);
  }

  activeSession.activePlatform = null;
  activeSession.activeTabId = null;
  activeSession.sessionStartedAt = null;
  activeSession.lastActive = null;
  await saveSessionToStorage();
}

/**
 * Direct access to current memory state.
 */
export function getActiveSession() {
  return activeSession;
}
