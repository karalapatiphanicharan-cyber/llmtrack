/**
 * LLMTrack Popup script
 * Integrates with the background service-worker to show real-time engine status
 * and active LLM detection state.
 */

import { formatSessionDuration, formatCleanTime, getLocalDateString, splitSessionByDay } from "../utils/time.js";

document.addEventListener("DOMContentLoaded", async () => {
  const engineStatusElement = document.getElementById("engine-status");
  const indicatorElement = document.getElementById("detection-indicator");
  const platformTextElement = document.getElementById("detected-platform");
  const detectionStatusElement = document.getElementById("detection-status");
  const startedTodayElement = document.getElementById("session-started-today");
  const currentSessionElement = document.getElementById("session-current-start");
  const currentCardElement = document.getElementById("current-card");

  const usageElements = {
    chatgpt: document.getElementById("usage-chatgpt"),
    gemini: document.getElementById("usage-gemini"),
    claude: document.getElementById("usage-claude")
  };

  // Central state memory
  let activeSessionState = null;
  let accumulatedDailyUsage = {};
  let updateIntervalId = null;

  // Attempt to query the background service worker
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    try {
      // 1. Get Tracking Engine Status
      chrome.runtime.sendMessage({ action: "GET_ENGINE_STATUS" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Could not communicate with background script:", chrome.runtime.lastError);
          setOfflineStatus(engineStatusElement);
          return;
        }

        if (response && response.success && response.data) {
          if (engineStatusElement) {
            engineStatusElement.textContent = "ACTIVE";
            engineStatusElement.className = "engine-badge active";
          }
        } else {
          setOfflineStatus(engineStatusElement);
        }
      });

      // Fetch dynamic state immediately and kick off UI interval
      await fetchAndUpdateState();
      updateIntervalId = setInterval(tickUI, 1000);

    } catch (e) {
      console.error("Error communicating with service worker:", e);
      setOfflineStatus(engineStatusElement);
      setUnsupportedPlatform();
    }
  } else {
    // Non-extension/mock preview context
    setMockStatus(engineStatusElement);
    setMockPlatform();
  }

  /**
   * Fetches latest state from background service worker
   */
  async function fetchAndUpdateState() {
    return new Promise((resolve) => {
      // 2. Get Currently Active Platform
      chrome.runtime.sendMessage({ action: "GET_ACTIVE_PLATFORM" }, (responseActive) => {
        if (chrome.runtime.lastError) {
          console.warn("Could not retrieve active platform:", chrome.runtime.lastError);
          setUnsupportedPlatform();
          resolve();
          return;
        }

        if (responseActive && responseActive.success && responseActive.data) {
          activeSessionState = responseActive.data;
        } else {
          activeSessionState = null;
        }

        // 3. Get Today's Daily Usage
        chrome.runtime.sendMessage({ action: "GET_DAILY_USAGE" }, (responseUsage) => {
          if (!chrome.runtime.lastError && responseUsage && responseUsage.success && responseUsage.data) {
            accumulatedDailyUsage = responseUsage.data;
          } else {
            accumulatedDailyUsage = {};
          }

          updatePlatformUI(activeSessionState);
          updateUsageDisplay();
          resolve();
        });
      });
    });
  }

  /**
   * Render Today's usage total.
   * If a platform is active, we add the live running elapsed time to its display dynamically.
   * Uses splitSessionByDay to ensure only today's segment of a running session is added.
   */
  function updateUsageDisplay() {
    const todayStr = getLocalDateString();
    const todayData = accumulatedDailyUsage[todayStr] || {};

    const platforms = ["chatgpt", "gemini", "claude"];
    platforms.forEach(platform => {
      let totalSeconds = 0;
      if (todayData[platform]) {
        totalSeconds = todayData[platform].totalUsageSeconds || 0;
      }

      // Add live running time if active
      if (activeSessionState && activeSessionState.active && activeSessionState.platform === platform && activeSessionState.sessionStartedAt) {
        // Split the running session up to now
        const segments = splitSessionByDay(activeSessionState.sessionStartedAt, Date.now());
        const todaySegment = segments.find(s => s.date === todayStr);
        if (todaySegment) {
          totalSeconds += Math.floor(todaySegment.durationMs / 1000);
        }
      }

      const formatted = formatSessionDuration(totalSeconds * 1000);
      if (usageElements[platform]) {
        usageElements[platform].textContent = formatted;
      }
    });
  }

  /**
   * Dynamic local interval UI ticks to update running session durations in Daily Usage list
   */
  function tickUI() {
    if (activeSessionState && activeSessionState.active && activeSessionState.sessionStartedAt) {
      updateUsageDisplay();
    }
  }

  function setOfflineStatus(element) {
    if (element) {
      element.textContent = "OFFLINE";
      element.className = "engine-badge inactive";
    }
  }

  function setMockStatus(element) {
    if (element) {
      element.textContent = "ACTIVE";
      element.className = "engine-badge active";
    }
  }

  function setUnsupportedPlatform() {
    if (indicatorElement) {
      indicatorElement.className = "indicator inactive";
    }
    if (platformTextElement) {
      platformTextElement.textContent = "No supported LLM";
    }
    if (detectionStatusElement) {
      detectionStatusElement.textContent = "INACTIVE";
      detectionStatusElement.className = "status-badge inactive";
    }
    if (startedTodayElement) {
      startedTodayElement.textContent = "-";
    }
    if (currentSessionElement) {
      currentSessionElement.textContent = "-";
    }
    if (currentCardElement) {
      currentCardElement.className = "detail-rows";
    }
  }

  function setMockPlatform() {
    if (indicatorElement) {
      indicatorElement.className = "indicator chatgpt";
    }
    if (platformTextElement) {
      platformTextElement.textContent = "ChatGPT";
    }
    if (detectionStatusElement) {
      detectionStatusElement.textContent = "ACTIVE";
      detectionStatusElement.className = "status-badge active";
    }
    if (startedTodayElement) {
      startedTodayElement.textContent = "4:30 PM";
    }
    if (currentSessionElement) {
      currentSessionElement.textContent = "8:03 PM";
    }
    if (currentCardElement) {
      currentCardElement.className = "detail-rows active-chatgpt";
    }
    if (usageElements.chatgpt) {
      usageElements.chatgpt.textContent = "28 min";
    }
    if (usageElements.gemini) {
      usageElements.gemini.textContent = "<1 min";
    }
    if (usageElements.claude) {
      usageElements.claude.textContent = "<1 min";
    }
  }

  function updatePlatformUI(state) {
    if (!state || !state.active || !state.platform) {
      setUnsupportedPlatform();
      return;
    }

    const platformNameMap = {
      chatgpt: "ChatGPT",
      gemini: "Gemini",
      claude: "Claude"
    };

    const prettyName = platformNameMap[state.platform] || state.platform;

    if (indicatorElement) {
      indicatorElement.className = `indicator ${state.platform}`;
    }
    if (platformTextElement) {
      platformTextElement.textContent = prettyName;
    }
    if (detectionStatusElement) {
      detectionStatusElement.textContent = "ACTIVE";
      detectionStatusElement.className = "status-badge active";
    }

    // Apply platform-specific active glow/tint classes
    if (currentCardElement) {
      currentCardElement.className = `detail-rows active-${state.platform}`;
    }

    // 1. Started Today (firstOpenedAt)
    const todayStr = getLocalDateString();
    const todayData = accumulatedDailyUsage[todayStr] || {};
    let firstOpenedAt = null;
    if (todayData[state.platform]) {
      firstOpenedAt = todayData[state.platform].firstOpenedAt;
    }

    // Fallback: if firstOpenedAt is not yet in storage, use the active session started time
    if (!firstOpenedAt) {
      firstOpenedAt = state.sessionStartedAt;
    }

    if (startedTodayElement) {
      startedTodayElement.textContent = formatCleanTime(firstOpenedAt);
    }

    // 2. Current Session (sessionStartedAt)
    if (currentSessionElement) {
      currentSessionElement.textContent = formatCleanTime(state.sessionStartedAt);
    }
  }
});
