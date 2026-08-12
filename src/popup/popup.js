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
  const unsupportedMsgElement = document.getElementById("unsupported-message");

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

  // Authoritative State Memory from Background Snapshot
  let snapshotState = null;
  let isHistoryView = false;
  let updateIntervalId = null;

  // Set toggle listener
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      isHistoryView = !isHistoryView;
      if (isHistoryView) {
        overviewView.classList.add("hidden");
        historyView.classList.remove("hidden");
        btnText.textContent = "OVERVIEW";
        btnIcon.textContent = "←";
        renderHistoryView();
      } else {
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

      // Fetch unified dynamic state snapshot and kick off interval
      await fetchAndUpdateState();
      updateIntervalId = setInterval(fetchAndUpdateState, 1000);

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
   * Fetches latest authoritative snapshot from background service worker.
   * Both Overview and History views consume this SAME snapshot.
   */
  async function fetchAndUpdateState() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "GET_USAGE_SNAPSHOT" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success || !response.data) {
          console.warn("Could not retrieve usage snapshot:", chrome.runtime.lastError);
          setUnsupportedPlatform();
          resolve();
          return;
        }

        snapshotState = response.data;

        // Update popup components from the single authoritative state!
        updatePlatformUI(snapshotState);
        if (isHistoryView) {
          renderHistoryView();
        } else {
          updateUsageDisplay();
        }
        resolve();
      });
    });
  }

  /**
   * Render Today's usage total from the authoritative snapshot
   */
  function updateUsageDisplay() {
    if (!snapshotState) return;

    const todayStr = snapshotState.todayStr;
    const todayData = snapshotState.weekData[todayStr] || { chatgpt: 0, gemini: 0, claude: 0 };

    const platforms = ["chatgpt", "gemini", "claude"];
    platforms.forEach(platform => {
      const seconds = todayData[platform] || 0;
      const formatted = formatSessionDuration(seconds * 1000);
      if (usageElements[platform]) {
        usageElements[platform].textContent = formatted;
      }
    });
  }

  /**
   * Renders the 7-Day History View from the authoritative snapshot
   */
  function renderHistoryView() {
    if (!snapshotState) return;

    const todayStr = snapshotState.todayStr;
    const currentWeekDates = Object.keys(snapshotState.weekData).sort(); // Sort date strings Monday -> Sunday

    // 1. Format and display date range (e.g. AUG 10 — AUG 16)
    if (historyRangeElement && currentWeekDates.length === 7) {
      const monStr = currentWeekDates[0];
      const sunStr = currentWeekDates[6];
      historyRangeElement.textContent = formatWeekRange(monStr, sunStr);
    }

    // 2. Sum up weekly totals and daily totals directly from the snapshot!
    let weeklyTotalSeconds = 0;
    const platformWeeklySeconds = { chatgpt: 0, gemini: 0, claude: 0 };
    const dailyTotalSeconds = [0, 0, 0, 0, 0, 0, 0];

    currentWeekDates.forEach((dateStr, index) => {
      const dayData = snapshotState.weekData[dateStr] || { chatgpt: 0, gemini: 0, claude: 0, total: 0 };
      dailyTotalSeconds[index] = dayData.total;
      weeklyTotalSeconds += dayData.total;

      const platforms = ["chatgpt", "gemini", "claude"];
      platforms.forEach(p => {
        platformWeeklySeconds[p] += dayData[p] || 0;
      });
    });

    // 3. Render Weekly Total
    if (weeklyTotalValueElement) {
      weeklyTotalValueElement.textContent = formatSessionDuration(weeklyTotalSeconds * 1000);
    }

    // 4. Render Day Rows and proportional Bars
    const maxDaySeconds = Math.max(...dailyTotalSeconds);

    currentWeekDates.forEach((dateStr, index) => {
      const dayTotalSec = dailyTotalSeconds[index];
      const row = document.getElementById(`day-row-${index}`);
      const tag = row ? row.querySelector(".day-tag") : null;
      const bar = document.getElementById(`bar-${index}`);
      const valSpan = document.getElementById(`day-val-${index}`);

      if (!row) return;

      // Reset style classes
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
      currentCardElement.className = "detail-rows hidden"; // Hide session rows when unsupported!
    }
    if (unsupportedMsgElement) {
      unsupportedMsgElement.classList.remove("hidden"); // Show instruction message when unsupported!
    }
  }

  function setMockPlatform() {
    // Generate beautiful mock snapshotState representing standard Phase 3 data
    const currentWeek = getCurrentWeekDates();
    const todayStr = getLocalDateString();

    const mockWeekData = {};
    currentWeek.forEach((date, index) => {
      // Mock MON (index 0) with 90 min, TUE (index 1) with 45 min, and today with 30 min (including active)
      if (date > todayStr) {
        mockWeekData[date] = { chatgpt: 0, gemini: 0, claude: 0, total: 0 };
      } else if (date === todayStr) {
        mockWeekData[date] = { chatgpt: 1800, gemini: 0, claude: 0, total: 1800 }; // 30 min
      } else if (index === 0) {
        mockWeekData[date] = { chatgpt: 5400, gemini: 0, claude: 0, total: 5400 }; // 90 min
      } else if (index === 1) {
        mockWeekData[date] = { chatgpt: 0, gemini: 2700, claude: 0, total: 2700 }; // 45 min
      } else {
        mockWeekData[date] = { chatgpt: 0, gemini: 0, claude: 0, total: 0 }; // 0 min completed
      }
    });

    snapshotState = {
      activePlatform: "chatgpt",
      activeTabId: 999,
      sessionStartedAt: Date.now() - 14 * 60 * 1000, // 14 min ago
      todayStr,
      weekData: mockWeekData
    };

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
    if (unsupportedMsgElement) {
      unsupportedMsgElement.classList.add("hidden");
    }

    updateUsageDisplay();
  }

  function updatePlatformUI(state) {
    if (!state || !state.activePlatform) {
      setUnsupportedPlatform();
      return;
    }

    const platformNameMap = {
      chatgpt: "ChatGPT",
      gemini: "Gemini",
      claude: "Claude"
    };

    const prettyName = platformNameMap[state.activePlatform] || state.activePlatform;

    if (indicatorElement) {
      indicatorElement.className = `indicator ${state.activePlatform}`;
    }
    if (platformTextElement) {
      platformTextElement.textContent = prettyName;
    }
    if (detectionStatusElement) {
      detectionStatusElement.textContent = "ACTIVE";
      detectionStatusElement.className = "status-badge active";
    }

    // Show current card and hide unsupported message
    if (currentCardElement) {
      currentCardElement.className = `detail-rows active-${state.activePlatform}`;
    }
    if (unsupportedMsgElement) {
      unsupportedMsgElement.classList.add("hidden");
    }

    // 1. Started Today (firstOpenedAt)
    const todayStr = state.todayStr;
    const todayData = state.weekData[todayStr] || {};
    let firstOpenedAt = null;
    if (todayData.firstOpened) {
      firstOpenedAt = todayData.firstOpened[state.activePlatform];
    }

    // Fallback: if firstOpenedAt is not yet in storage, use the active session started time
    if (!firstOpenedAt) {
      firstOpenedAt = state.sessionStartedAt;
    }

    if (startedTodayElement && firstOpenedAt) {
      startedTodayElement.textContent = formatCleanTime(firstOpenedAt);
    }

    // 2. Current Session (sessionStartedAt)
    if (currentSessionElement && state.sessionStartedAt) {
      currentSessionElement.textContent = formatCleanTime(state.sessionStartedAt);
    }
  }
});
