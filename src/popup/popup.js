/**
 * LLMTrack Popup script
 * Integrates with the background service-worker to show real-time engine status
 * and active LLM detection state.
 */

import { formatDuration, getLocalDateString } from "../utils/time.js";

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

  // State to calculate running session duration locally (without owning the source timer)
  let activeSessionState = null;
  let accumulatedDailyUsage = {};

  // Tick interval to update UI every second
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
          engineStatusElement.textContent = response.data.trackingEngine;
          engineStatusElement.className = "status-value active";
        } else {
          setOfflineStatus(engineStatusElement);
        }
      });

      // Fetch dynamic state and start interval
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
   * Fetches the central states from background worker
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
   * Updates elements representing stored daily usage.
   * If a platform is currently active, displays stored usage + active session usage.
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

      // If this platform is currently running, add the live running elapsed time
      if (activeSessionState && activeSessionState.active && activeSessionState.platform === platform && activeSessionState.sessionStartedAt) {
        const elapsedMs = Date.now() - activeSessionState.sessionStartedAt;
        const liveSeconds = Math.floor(elapsedMs / 1000);
        if (liveSeconds > 0) {
          totalSeconds += liveSeconds;
        }
      }

      const formatted = formatDuration(totalSeconds * 1000);
      if (usageElements[platform]) {
        usageElements[platform].textContent = formatted;
      }
    });
  }

  /**
   * Periodic tick to calculate elapsed times on the fly for active session.
   */
  function tickUI() {
    if (activeSessionState && activeSessionState.active && activeSessionState.sessionStartedAt) {
      const elapsedMs = Date.now() - activeSessionState.sessionStartedAt;
      if (currentDurationElement) {
        currentDurationElement.textContent = formatDuration(elapsedMs);
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
      element.textContent = "Offline (Not running)";
      element.className = "status-value";
      element.style.color = "#ef4444";
    }
  }

  function setMockStatus(element) {
    if (element) {
      element.textContent = "Mock Sandbox Mode";
      element.className = "status-value active";
      element.style.color = "#3b82f6";
    }
  }

  function setUnsupportedPlatform() {
    if (indicatorElement) {
      indicatorElement.className = "indicator inactive";
    }
    if (platformTextElement) {
      platformTextElement.textContent = "No supported LLM detected";
    }
    if (detectionStatusElement) {
      detectionStatusElement.textContent = "Inactive";
      detectionStatusElement.className = "engine-status inactive";
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
      platformTextElement.textContent = "ChatGPT (Mock)";
    }
    if (detectionStatusElement) {
      detectionStatusElement.textContent = "Active";
      detectionStatusElement.className = "engine-status active";
    }
    if (sessionStartedElement) {
      sessionStartedElement.textContent = "Mock Started";
    }
    if (currentDurationElement) {
      currentDurationElement.textContent = "1m 30s";
    }
  }

  function updatePlatformUI(state) {
    if (!state || !state.active || !state.platform) {
      setUnsupportedPlatform();
      return;
    }

    // Format platform name prettily
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
      detectionStatusElement.textContent = "Active";
      detectionStatusElement.className = "engine-status active";
    }

    if (state.sessionStartedAt) {
      const startTimeDate = new Date(state.sessionStartedAt);
      if (sessionStartedElement) {
        sessionStartedElement.textContent = startTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    } else {
      if (sessionStartedElement) {
        sessionStartedElement.textContent = "-";
      }
    }
  }
});
