/**
 * LLMTrack Tab Manager
 * Manages active tab state, window focus listeners, and platform detection.
 */

import { detectLLM } from "../utils/llmDetector.js";
import { handleTransition, getActiveSession } from "./session-tracker.js";

/**
 * Update active state by executing the transition logic.
 * @param {number|null} tabId
 * @param {string|null} url
 */
export async function updateActiveState(tabId, url) {
  const detection = detectLLM(url);
  const platform = detection.supported ? detection.platform : null;
  await handleTransition(platform, tabId);
}

/**
 * Re-evaluate active tab from scratch across all Chrome windows.
 * Typically invoked when window focus shifts, browser launches, or tab is removed.
 */
export function reevaluateActiveTab() {
  if (typeof chrome === "undefined" || !chrome.windows) {
    return;
  }

  chrome.windows.getLastFocused({ populate: true }, (window) => {
    if (chrome.runtime.lastError || !window || !window.focused) {
      // No browser window has focus
      handleTransition(null, null);
      return;
    }

    // Find active tab in currently focused window
    const activeTab = window.tabs ? window.tabs.find(t => t.active) : null;
    if (activeTab) {
      updateActiveState(activeTab.id, activeTab.url);
    } else {
      handleTransition(null, null);
    }
  });
}

/**
 * Setup and bind all Chrome API event listeners
 */
export function initTabManager() {
  if (typeof chrome === "undefined" || !chrome.tabs) {
    return;
  }

  // 1. Tab activation (switching tabs within the same window)
  chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
      if (chrome.runtime.lastError || !tab) return;

      // Ensure this tab belongs to the currently focused window before acting
      chrome.windows.get(tab.windowId, (win) => {
        if (chrome.runtime.lastError || !win) return;
        if (win.focused) {
          updateActiveState(tab.id, tab.url);
        }
      });
    });
  });

  // 2. Tab URL updates (navigation within a tab)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
      chrome.windows.get(tab.windowId, (win) => {
        if (chrome.runtime.lastError || !win) return;
        if (win.focused && tab.active) {
          updateActiveState(tabId, changeInfo.url);
        }
      });
    }
  });

  // 3. Window focus changes
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      // Browser application lost focus completely
      handleTransition(null, null);
    } else {
      reevaluateActiveTab();
    }
  });

  // 4. Tab removal / closing
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    const activeSession = getActiveSession();
    if (tabId === activeSession.activeTabId) {
      reevaluateActiveTab();
    }
  });

  // Initial tab reevaluation on service worker start
  reevaluateActiveTab();
}
