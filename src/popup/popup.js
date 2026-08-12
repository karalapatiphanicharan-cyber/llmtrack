/**
 * LLMTrack Popup script
 * Integrates with the background service-worker to show real-time engine status.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const engineStatusElement = document.getElementById("engine-status");

  // Attempt to query the background service worker
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
    try {
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
    } catch (e) {
      console.error("Error sending message to service worker:", e);
      setOfflineStatus(engineStatusElement);
    }
  } else {
    // Non-extension/mock preview context
    setMockStatus(engineStatusElement);
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
