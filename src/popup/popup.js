/**
 * LLMTrack Popup script
 * Integrates with the background service-worker to show real-time engine status
 * and active LLM detection state.
 */

import {
  formatSessionDuration,
  formatCleanTime,
  getLocalDateString,
  splitSessionByDay,
  getCurrentWeekDates
} from "../utils/time.js";

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const engineStatusElement = document.getElementById("engine-status");
  const indicatorElement = document.getElementById("detection-indicator");
  const platformTextElement = document.getElementById("detected-platform");
  const detectionStatusElement = document.getElementById("detection-status");
  const startedTodayElement = document.getElementById("session-started-today");
  const currentSessionElement = document.getElementById("session-current-start");
  const currentCardElement = document.getElementById("current-card");

  // Navigation toggle buttons & views
  const toggleBtn = document.getElementById("history-toggle-btn");
  const btnText = document.getElementById("nav-btn-text");
  const btnIcon = document.getElementById("nav-btn-icon");
  const overviewView = document.getElementById("overview-view");
  const historyView = document.getElementById("history-view");

  // History Elements
  const historyRangeElement = document.getElementById("history-date-range");
  const weeklyTotalValueElement = document.getElementById("weekly-total-value");
  const mostUsedElement = document.getElementById("most-used-platform");

  const usageElements = {
    chatgpt: document.getElementById("usage-chatgpt"),
    gemini: document.getElementById("usage-gemini"),
    claude: document.getElementById("usage-claude")
  };

  // State
  let activeSessionState = null;
  let accumulatedDailyUsage = {};
  let isHistoryView = false;
  let updateIntervalId = null;

  // Set toggle listener
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isHistoryView = !isHistoryView;
      if (isHistoryView) {
        // Switch to History
        overviewView.classList.add("hidden");
        historyView.classList.remove("hidden");
        btnText.textContent = "OVERVIEW";
        btnIcon.textContent = "←";
        renderHistoryView();
      } else {
        // Switch to Overview
        historyView.classList.add("hidden");
        overviewView.classList.remove("hidden");
        btnText.textContent = "7 DAYS";
        btnIcon.textContent = "◷";
        updateUsageDisplay();
      }
    });
  }

  // Query background service worker
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
          if (isHistoryView) {
            renderHistoryView();
          } else {
            updateUsageDisplay();
          }
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
   * Renders the 7-Day History View
   */
  function renderHistoryView() {
    const todayStr = getLocalDateString();
    const currentWeekDates = getCurrentWeekDates(); // Monday -> Sunday dates

    // 1. Format and display date range (e.g. AUG 10 — AUG 16)
    if (historyRangeElement && currentWeekDates.length === 7) {
      const monStr = currentWeekDates[0];
      const sunStr = currentWeekDates[6];
      historyRangeElement.textContent = formatWeekRange(monStr, sunStr);
    }

    // 2. Sum up daily and platform totals
    let weeklyTotalSeconds = 0;
    const platformWeeklySeconds = { chatgpt: 0, gemini: 0, claude: 0 };
    const dailyTotalSeconds = [0, 0, 0, 0, 0, 0, 0]; // MON -> SUN totals

    currentWeekDates.forEach((dateStr, index) => {
      const dayData = accumulatedDailyUsage[dateStr] || {};
      const platforms = ["chatgpt", "gemini", "claude"];

      platforms.forEach(platform => {
        let seconds = 0;
        if (dayData[platform]) {
          seconds = dayData[platform].totalUsageSeconds || 0;
        }

        // Add live running time if active and matching this date
        if (activeSessionState && activeSessionState.active && activeSessionState.platform === platform && activeSessionState.sessionStartedAt) {
          const segments = splitSessionByDay(activeSessionState.sessionStartedAt, Date.now());
          const matchSegment = segments.find(s => s.date === dateStr);
          if (matchSegment) {
            seconds += Math.floor(matchSegment.durationMs / 1000);
          }
        }

        dailyTotalSeconds[index] += seconds;
        platformWeeklySeconds[platform] += seconds;
        weeklyTotalSeconds += seconds;
      });
    });

    // 3. Render Weekly Total
    if (weeklyTotalValueElement) {
      weeklyTotalValueElement.textContent = formatSessionDuration(weeklyTotalSeconds * 1000);
    }

    // 4. Render Day Rows
    const maxDaySeconds = Math.max(...dailyTotalSeconds);

    currentWeekDates.forEach((dateStr, index) => {
      const dayTotalSec = dailyTotalSeconds[index];
      const row = document.getElementById(`day-row-${index}`);
      const tag = row ? row.querySelector(".day-tag") : null;
      const bar = document.getElementById(`bar-${index}`);
      const valSpan = document.getElementById(`day-val-${index}`);

      if (!row) return;

      // Reset styles
      row.className = "history-day-row";
      if (tag) tag.classList.add("hidden");

      if (dateStr > todayStr) {
        // Future Day
        if (valSpan) valSpan.textContent = "—";
        if (bar) bar.style.width = "0%";
      } else {
        // Today or Completed Day
        if (dateStr === todayStr) {
          row.classList.add("today-highlight");
          if (tag) tag.classList.remove("hidden");
        }

        if (dayTotalSec === 0) {
          if (valSpan) valSpan.textContent = "0 min";
          if (bar) bar.style.width = "0%";
        } else {
          if (valSpan) valSpan.textContent = formatSessionDuration(dayTotalSec * 1000);
          if (bar && maxDaySeconds > 0) {
            const pct = (dayTotalSec / maxDaySeconds) * 100;
            bar.style.width = `${pct}%`;
          }
        }
      }
    });

    // 5. Render Most Used Platform
    if (mostUsedElement) {
      let highestPlatform = "—";
      let highestSeconds = 0;

      const platforms = ["chatgpt", "gemini", "claude"];
      platforms.forEach(p => {
        if (platformWeeklySeconds[p] > highestSeconds) {
          highestSeconds = platformWeeklySeconds[p];
          highestPlatform = p;
        }
      });

      if (highestSeconds > 0) {
        const prettyNames = { chatgpt: "ChatGPT", gemini: "Gemini", claude: "Claude" };
        const prettyName = prettyNames[highestPlatform] || highestPlatform;
        mostUsedElement.textContent = `${prettyName} (${formatSessionDuration(highestSeconds * 1000)})`;
      } else {
        mostUsedElement.textContent = "—";
      }
    }
  }

  /**
   * Helper to format week range string cleanly (e.g. "AUG 10 — AUG 16" or "AUG 31 — SEP 6")
   */
  function formatWeekRange(monStr, sunStr) {
    const months = ["AUG", "SEP", "OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL"]; // Sample maps
    const fullMonths = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

    const monDate = new Date(monStr + "T00:00:00");
    const sunDate = new Date(sunStr + "T00:00:00");

    const monMonth = fullMonths[monDate.getMonth()];
    const monDay = monDate.getDate();
    const sunMonth = fullMonths[sunDate.getMonth()];
    const sunDay = sunDate.getDate();

    if (monMonth === sunMonth) {
      return `${monMonth} ${monDay} — ${sunDay}`;
    } else {
      return `${monMonth} ${monDay} — ${sunMonth} ${sunDay}`;
    }
  }

  /**
   * Dynamic local interval UI ticks to update running session durations
   */
  function tickUI() {
    if (activeSessionState && activeSessionState.active && activeSessionState.sessionStartedAt) {
      if (isHistoryView) {
        renderHistoryView();
      } else {
        updateUsageDisplay();
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
