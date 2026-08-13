/**
 * LLMTrack Background Service Worker
 * Central tracking engine for LLM usage stats.
 *
 * Single Source of Truth for detection and timing state.
 */

import { initTabManager, reconcileActiveState } from "./tab-manager.js";
import {
  initializationPromise,
  getActiveSession,
  rebaseActiveSession,
  resetActiveSessionState
} from "./session-tracker.js";
import {
  getDailyUsage,
  getUsageSnapshot,
  clearTodayUsage,
  clearHistoryUsage
} from "./usage-tracker.js";

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
        trackingEngine: "Active (Phase 5 Settings & Data)",
        version: "0.5.0"
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
  } else if (request.action === "GET_USAGE_SNAPSHOT") {
    // 1. Force state reconciliation to determine absolute current window/tab state
    reconcileActiveState().then(() => {
      // 2. Read current active session & build the authoritative usage snapshot
      const activeSession = getActiveSession();
      getUsageSnapshot(activeSession).then((snapshot) => {
        sendResponse({
          success: true,
          data: snapshot
        });
      });
    }).catch(err => {
      console.error("[LLMTrack] Error generating usage snapshot:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === "CLEAR_TODAY") {
    clearTodayUsage()
      .then(() => rebaseActiveSession())
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error("[LLMTrack] Error during CLEAR_TODAY message processing:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (request.action === "CLEAR_HISTORY") {
    clearHistoryUsage()
      .then(() => rebaseActiveSession())
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error("[LLMTrack] Error during CLEAR_HISTORY message processing:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  } else if (request.action === "RESET_ALL_DATA") {
    clearHistoryUsage()
      .then(() => resetActiveSessionState())
      .then(() => reconcileActiveState())
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(err => {
        console.error("[LLMTrack] Error during RESET_ALL_DATA message processing:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
  return true; // Keep message channel open
});
