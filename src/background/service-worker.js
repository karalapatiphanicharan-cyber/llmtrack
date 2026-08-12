/**
 * LLMTrack Background Service Worker
 * Central tracking engine for LLM usage stats.
 *
 * Single Source of Truth for detection and timing state.
 */

import { initTabManager } from "./tab-manager.js";
import { initializationPromise, getActiveSession } from "./session-tracker.js";
import { getDailyUsage } from "./usage-tracker.js";

console.log("LLMTrack Background Service Worker initialized.");

// Register all Chrome event listeners synchronously at top level so MV3 can wake up the worker
initTabManager();

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
    // Wait for initialization from storage before responding
    initializationPromise.then(() => {
      const session = getActiveSession();
      sendResponse({
        success: true,
        data: {
          active: session.activePlatform !== null,
          platform: session.activePlatform,
          tabId: session.activeTabId,
          sessionStartedAt: session.sessionStartedAt
        }
      });
    }).catch(err => {
      console.error("[LLMTrack] Error in initialization in GET_ACTIVE_PLATFORM:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
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
