/**
 * LLMTrack Popup script
 * Integrates with the background service-worker to show real-time engine status
 * and active LLM detection state.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const engineStatusElement = document.getElementById("engine-status");
  const indicatorElement = document.getElementById("detection-indicator");
  const platformTextElement = document.getElementById("detected-platform");
  const detectionStatusElement = document.getElementById("detection-status");

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

      // 2. Get Currently Active Platform
      chrome.runtime.sendMessage({ action: "GET_ACTIVE_PLATFORM" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Could not retrieve active platform:", chrome.runtime.lastError);
          setUnsupportedPlatform(indicatorElement, platformTextElement, detectionStatusElement);
          return;
        }

        if (response && response.success && response.data) {
          updatePlatformUI(response.data, indicatorElement, platformTextElement, detectionStatusElement);
        } else {
          setUnsupportedPlatform(indicatorElement, platformTextElement, detectionStatusElement);
        }
      });
    } catch (e) {
      console.error("Error communicating with service worker:", e);
      setOfflineStatus(engineStatusElement);
      setUnsupportedPlatform(indicatorElement, platformTextElement, detectionStatusElement);
    }
  } else {
    // Non-extension/mock preview context
    setMockStatus(engineStatusElement);
    setMockPlatform(indicatorElement, platformTextElement, detectionStatusElement);
  }
});

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

function setUnsupportedPlatform(indicator, text, status) {
  if (indicator) {
    indicator.className = "indicator inactive";
  }
  if (text) {
    text.textContent = "No supported LLM detected";
  }
  if (status) {
    status.textContent = "Inactive";
    status.className = "engine-status inactive";
  }
}

function setMockPlatform(indicator, text, status) {
  if (indicator) {
    indicator.className = "indicator chatgpt";
  }
  if (text) {
    text.textContent = "ChatGPT (Mock)";
  }
  if (status) {
    status.textContent = "Active";
    status.className = "engine-status active";
  }
}

function updatePlatformUI(state, indicator, text, status) {
  if (!state || !state.active || !state.platform) {
    setUnsupportedPlatform(indicator, text, status);
    return;
  }

  // Format platform name prettily
  const platformNameMap = {
    chatgpt: "ChatGPT",
    gemini: "Gemini",
    claude: "Claude"
  };

  const prettyName = platformNameMap[state.platform] || state.platform;

  if (indicator) {
    indicator.className = `indicator ${state.platform}`;
  }
  if (text) {
    text.textContent = prettyName;
  }
  if (status) {
    status.textContent = "Active";
    status.className = "engine-status active";
  }
}
