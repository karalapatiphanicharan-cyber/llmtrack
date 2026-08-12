/**
 * LLMTrack Tab Manager
 * Manages active tab state, window focus listeners, and platform detection.
 */

import { detectLLM } from "../utils/llmDetector.js";
import { handleTransition, getActiveSession, initializationPromise } from "./session-tracker.js";

/**
 * Re-evaluate and reconcile active tab from scratch across all Chrome windows.
 * Determines the currently focused window and its active tab to determine if an LLM is focused.
 * Centralizing state reconciliation prevents race conditions and event-order bugs.
 * Returns a Promise that resolves when active state is reconciled and transitions complete.
 */
export function reconcileActiveState() {
  if (typeof chrome === "undefined" || !chrome.windows) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    chrome.windows.getLastFocused({ populate: true }, (window) => {
      if (chrome.runtime.lastError || !window) {
        console.log("[LLMTrack] No focused window found on reconciliation.");
        initializationPromise.then(() => {
          handleTransition(null, null).then(resolve);
        });
        return;
      }

      if (!window.focused) {
        console.log("[LLMTrack] Last focused window is not actively focused in OS.");
        initializationPromise.then(() => {
          handleTransition(null, null).then(resolve);
        });
        return;
      }

      // Find active tab in currently focused window
      const activeTab = window.tabs ? window.tabs.find(t => t.active) : null;
      if (activeTab) {
        const detection = detectLLM(activeTab.url);
        const platform = detection.supported ? detection.platform : null;
        initializationPromise.then(() => {
          handleTransition(platform, activeTab.id).then(resolve);
        });
      } else {
        console.log("[LLMTrack] No active tab found in the focused window.");
        initializationPromise.then(() => {
          handleTransition(null, null).then(resolve);
        });
      }
    });
  });
}

/**
 * Setup and bind all Chrome API event listeners.
 * Every single focus, activation, navigation, and removal event calls reconcileActiveState() to maintain state consistency.
 */
export function initTabManager() {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return;
  }

  // 1. Tab activation (switching tabs within the same window)
  chrome.tabs.onActivated.addListener((activeInfo) => {
    console.log("[LLMTrack] Listener: tab activated", activeInfo.tabId);
    reconcileActiveState();
  });

  // 2. Tab URL updates (navigation within a tab)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      console.log("[LLMTrack] Listener: tab updated URL", tabId, changeInfo.url);
      reconcileActiveState();
    }
  });

  // 3. Window focus changes
  chrome.windows.onFocusChanged.addListener((windowId) => {
    console.log("[LLMTrack] Listener: window focus changed", windowId);
    reconcileActiveState();
  });

  // 4. Tab removal / closing
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    console.log("[LLMTrack] Listener: tab removed", tabId);
    reconcileActiveState();
  });

  // Initial tab reevaluation on service worker start
  reconcileActiveState();
}
