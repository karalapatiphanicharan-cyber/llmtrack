/**
 * LLMTrack Session Tracker
 * Manages active session lifecycle, same-platform tab switches,
 * platform switching, browser focus shifts, and transient navigation debouncing.
 */

import { recordSessionUsage } from "./usage-tracker.js";
import { getData, setData } from "../utils/storage.js";

// Central memory state for current active session
let activeSession = {
  activePlatform: null,
  activeTabId: null,
  sessionStartedAt: null
};

// Reusable state recovery or persistence
async function saveSessionToStorage() {
  await setData({ activeSession });
}

// Loads session state from storage to handle service worker restart/recovery
export async function initializeSessionFromStorage() {
  const data = await getData("activeSession");
  if (data.activeSession) {
    activeSession = data.activeSession;
    console.log("[LLMTrack] Session state recovered:", activeSession);
  }
}

// Timeout handle for the transient navigation debounce
let debounceTimeout = null;
const DEBOUNCE_DELAY_MS = 1500; // 1.5 seconds

/**
 * Handle platform and tab state transitions.
 * Ensures transitions to 'Unsupported' (null) are debounced to prevent false negatives during page loading/navigation.
 * @param {string|null} newPlatform - The newly detected platform ('chatgpt', 'gemini', 'claude' or null).
 * @param {number|null} newTabId - The newly detected active tab's ID.
 */
export async function handleTransition(newPlatform, newTabId) {
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
      await saveSessionToStorage();
    }
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
    await saveSessionToStorage();
    console.log(`[LLMTrack] Session started: ${newPlatform}`);
  }
}

/**
 * Ends the active session, calculates elapsed time, records daily usage,
 * and resets session memory.
 */
export async function endActiveSession() {
  const { activePlatform, sessionStartedAt } = activeSession;
  if (activePlatform && sessionStartedAt) {
    const endTime = Date.now();
    console.log(`[LLMTrack] Session ended: ${activePlatform}`);
    await recordSessionUsage(activePlatform, sessionStartedAt, endTime);
  }

  activeSession.activePlatform = null;
  activeSession.activeTabId = null;
  activeSession.sessionStartedAt = null;
  await saveSessionToStorage();
}

/**
 * Direct access to current memory state.
 */
export function getActiveSession() {
  return activeSession;
}
