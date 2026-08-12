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
  const sessionStartedElement = document.getElementById("session-started-time");
  const currentDurationElement = document.getElementById("current-session-duration");

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
          updatePlatformUI(activeSessionState);
        } else {
          setUnsupportedPlatform();
        }

        // 3. Get Today's Daily Usage
        chrome.runtime.sendMessage({ action: "GET_DAILY_USAGE" }, (responseUsage) => {
          if (!chrome.runtime.lastError && responseUsage && responseUsage.success && responseUsage.data) {
            accumulatedDailyUsage = responseUsage.data;
          } else {
            accumulatedDailyUsage = {};
          }
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
   * Dynamic local interval UI ticks to update running session durations
   */
  function tickUI() {
    if (activeSessionState && activeSessionState.active && activeSessionState.sessionStartedAt) {
      const elapsedMs = Date.now() - activeSessionState.sessionStartedAt;
      if (currentDurationElement) {
        currentDurationElement.textContent = formatSessionDuration(elapsedMs);
      }
      updateUsageDisplay();
    } else {
      if (currentDurationElement) {
        currentDurationElement.textContent = "-";
      }
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
      element.textContent = "SANDBOX";
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
    if (sessionStartedElement) {
      sessionStartedElement.textContent = "-";
    }
    if (currentDurationElement) {
      currentDurationElement.textContent = "-";
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
    if (sessionStartedElement) {
      sessionStartedElement.textContent = "6:38 PM";
    }
    if (currentDurationElement) {
      currentDurationElement.textContent = "14 min";
    }
    if (usageElements.chatgpt) {
      usageElements.chatgpt.textContent = "48 min";
    }
    if (usageElements.gemini) {
      usageElements.gemini.textContent = "12 min";
    }
    if (usageElements.claude) {
      usageElements.claude.textContent = "7 min";
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

    if (state.sessionStartedAt) {
      if (sessionStartedElement) {
        sessionStartedElement.textContent = formatCleanTime(state.sessionStartedAt);
      }
    } else {
      if (sessionStartedElement) {
        sessionStartedElement.textContent = "-";
      }
    }
  }
});
