/**
 * LLMTrack Background Service Worker
 * Central tracking engine for LLM usage stats.
 *
 * Single Source of Truth for detection and timing state.
 */

import { initTabManager } from "./tab-manager.js";
import { initializeSessionFromStorage, getActiveSession } from "./session-tracker.js";
import { getDailyUsage } from "./usage-tracker.js";

console.log("LLMTrack Background Service Worker initialized.");

// Initialize session state from storage (e.g. recovery after suspension/restart)
initializeSessionFromStorage().then(() => {
  // Setup the Chrome Event listeners via tab manager
  initTabManager();
});

/**
 * Listens for messages from the Popup or Content Scripts.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ENGINE_STATUS") {
    sendResponse({
      success: true,
      data: {
        trackingEngine: "Active (Phase 2 Tracking)",
        version: "0.2.0"
      }
    });
  } else if (request.action === "GET_ACTIVE_PLATFORM") {
    const session = getActiveSession();
    // Re-format to match Phase 1 activeState schema while exposing Phase 2 sessionStartedAt
    sendResponse({
      success: true,
      data: {
        active: session.activePlatform !== null,
        platform: session.activePlatform,
        tabId: session.activeTabId,
        sessionStartedAt: session.sessionStartedAt
      }
    });
  } else if (request.action === "GET_DAILY_USAGE") {
    getDailyUsage().then(dailyUsage => {
      sendResponse({
        success: true,
        data: dailyUsage
      });
    }).catch(err => {
      console.error("[LLMTrack] Error retrieving daily usage:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
  }
  return true; // Keep message channel open
});
