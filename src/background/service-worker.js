/**
 * LLMTrack Background Service Worker
 * Central tracking engine for LLM usage stats.
 *
 * Single Source of Truth for detection state.
 */

import { detectLLM } from "../utils/llmDetector.js";

console.log("LLMTrack Background Service Worker initialized.");

// State schema: represents the currently active state of the user
let activeState = {
  active: false,
  platform: null,
  tabId: null
};

/**
 * Log state transitions neatly
 */
function logTransition(oldState, newState) {
  if (oldState.platform !== newState.platform || oldState.active !== newState.active) {
    const oldPlatformStr = oldState.active ? oldState.platform : "Unsupported";
    const newPlatformStr = newState.active ? newState.platform : "Unsupported";
    console.log(`[LLMTrack] Active platform: ${newPlatformStr.toUpperCase()}`);
    console.log(`[LLMTrack] Platform changed: ${oldPlatformStr} → ${newPlatformStr}`);
  }
}

/**
 * Updates the central active state based on a tab ID and URL.
 */
function updateActiveState(tabId, url) {
  const previousState = { ...activeState };
  const detection = detectLLM(url);

  if (detection.supported) {
    activeState = {
      active: true,
      platform: detection.platform,
      tabId: tabId
    };
  } else {
    activeState = {
      active: false,
      platform: null,
      tabId: tabId
    };
  }

  logTransition(previousState, activeState);
}

/**
 * Re-evaluate active state from scratch (usually when window focus shifts or tab is removed)
 */
function reevaluateActiveTab() {
  chrome.windows.getLastFocused({ populate: true }, (window) => {
    if (chrome.runtime.lastError || !window || !window.focused) {
      // No window is currently focused
      const previousState = { ...activeState };
      activeState = { active: false, platform: null, tabId: null };
      logTransition(previousState, activeState);
      return;
    }

    // Find the active tab in the currently focused window
    const activeTab = window.tabs ? window.tabs.find(t => t.active) : null;
    if (activeTab) {
      updateActiveState(activeTab.id, activeTab.url);
    } else {
      const previousState = { ...activeState };
      activeState = { active: false, platform: null, tabId: null };
      logTransition(previousState, activeState);
    }
  });
}

/**
 * Listens for messages from the Popup or Content Scripts.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ENGINE_STATUS") {
    sendResponse({
      success: true,
      data: {
        trackingEngine: "Active (Phase 1 Detection)",
        version: "0.1.0"
      }
    });
  } else if (request.action === "GET_ACTIVE_PLATFORM") {
    sendResponse({
      success: true,
      data: activeState
    });
  }
  return true; // Keep message channel open
});

/**
 * Handle Tab Activation (active tab switches within same window)
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab) return;

    // Only update if this activation is in the currently focused window
    chrome.windows.get(tab.windowId, (win) => {
      if (chrome.runtime.lastError || !win) return;
      if (win.focused) {
        updateActiveState(tab.id, tab.url);
      }
    });
  });
});

/**
 * Handle Tab URL Changes/Updates (navigation)
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We monitor url changes. It could be loading or complete.
  if (changeInfo.url) {
    // Only update activeState if this tab is the active one in the focused window
    chrome.windows.get(tab.windowId, (win) => {
      if (chrome.runtime.lastError || !win) return;
      if (win.focused && tab.active) {
        updateActiveState(tabId, changeInfo.url);
      }
    });
  }
});

/**
 * Handle Window Focus Changes
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus completely
    const previousState = { ...activeState };
    activeState = { active: false, platform: null, tabId: null };
    logTransition(previousState, activeState);
  } else {
    reevaluateActiveTab();
  }
});

/**
 * Handle Tab Removal
 */
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // If the closed tab was our active tracking tab, re-evaluate active tab across windows
  if (tabId === activeState.tabId) {
    reevaluateActiveTab();
  }
});
