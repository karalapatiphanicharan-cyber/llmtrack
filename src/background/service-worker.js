/**
 * LLMTrack Background Service Worker
 * Central tracking engine for LLM usage stats.
 *
 * Designed to act as the single source of truth. Future phases will:
 * - Listen for active tab, window, and web-request events
 * - Periodically persist elapsed session times to chrome.storage
 * - Support multi-tab tracking with a shared timer
 */

import { detectLLM } from "../utils/llmDetector.js";
import { getData, setData } from "../utils/storage.js";
import { getCurrentTimestamp, getLocalDateString } from "../utils/time.js";

console.log("LLMTrack Background Service Worker initialized.");

// Track service worker start time
const serviceWorkerStartTime = getCurrentTimestamp();

// Optional internal tracking state for future phases
let currentTrackingState = {
  initialized: true,
  status: "active",
  startedAt: serviceWorkerStartTime,
  activePlatform: null,
  activeTabId: null
};

/**
 * Listens for messages from the Popup or Content Scripts.
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_ENGINE_STATUS") {
    sendResponse({
      success: true,
      data: {
        trackingEngine: "Active (Phase 0 Foundation)",
        version: "0.1.0",
        startedAt: serviceWorkerStartTime,
        activePlatform: currentTrackingState.activePlatform
      }
    });
  }
  return true; // Keep the message channel open for async response
});

/**
 * Handle Tab Activation (active tab switch within window)
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) return;
    const detection = detectLLM(tab.url);
    if (detection.supported) {
      console.log(`[ServiceWorker] Active tab switched to supported LLM: ${detection.platform}`);
      currentTrackingState.activePlatform = detection.platform;
      currentTrackingState.activeTabId = tab.id;
    } else {
      currentTrackingState.activePlatform = null;
      currentTrackingState.activeTabId = null;
    }
  });
});

/**
 * Handle Tab URL Changes/Updates
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.active) {
    const detection = detectLLM(tab.url);
    if (detection.supported) {
      console.log(`[ServiceWorker] Tab updated to supported LLM: ${detection.platform}`);
      currentTrackingState.activePlatform = detection.platform;
      currentTrackingState.activeTabId = tabId;
    } else if (tabId === currentTrackingState.activeTabId) {
      currentTrackingState.activePlatform = null;
      currentTrackingState.activeTabId = null;
    }
  }
});

/**
 * Handle Window Focus Changes
 */
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Browser lost focus completely
    console.log("[ServiceWorker] Browser lost focus");
    currentTrackingState.activePlatform = null;
  } else {
    // Get currently active tab in this newly focused window
    chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const activeTab = tabs[0];
        const detection = detectLLM(activeTab.url);
        if (detection.supported) {
          console.log(`[ServiceWorker] Window focus changed. Active LLM: ${detection.platform}`);
          currentTrackingState.activePlatform = detection.platform;
          currentTrackingState.activeTabId = activeTab.id;
        } else {
          currentTrackingState.activePlatform = null;
          currentTrackingState.activeTabId = null;
        }
      }
    });
  }
});
