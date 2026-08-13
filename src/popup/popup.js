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

  // Sub Navigation Tabs & Views
  const tabOverviewBtn = document.getElementById("tab-overview");
  const tabHistoryBtn = document.getElementById("tab-history");
  const tabAnalyticsBtn = document.getElementById("tab-analytics");
  const btnSettings = document.getElementById("btn-settings");
  const settingsBackBtn = document.getElementById("settings-back-btn");

  const overviewView = document.getElementById("overview-view");
  const historyView = document.getElementById("history-view");
  const analyticsView = document.getElementById("analytics-view");
  const settingsView = document.getElementById("settings-view");

  // History Container and Empty States
  const historyEmptyState = document.getElementById("history-empty-state");
  const historyContent = document.getElementById("history-content");

  // Analytics Container and Empty States
  const analyticsEmptyState = document.getElementById("analytics-empty-state");
  const analyticsContent = document.getElementById("analytics-content");

  // Settings Buttons & About Info
  const btnClearToday = document.getElementById("btn-clear-today");
  const btnClearHistory = document.getElementById("btn-clear-history");
  const btnResetAll = document.getElementById("btn-reset-all");
  const settingsVersion = document.getElementById("settings-version");

  // Confirmation Modal Elements
  const confirmModal = document.getElementById("confirm-modal");
  const modalTitle = document.getElementById("modal-title");
  const modalDesc = document.getElementById("modal-desc");
  const modalBtnCancel = document.getElementById("modal-btn-cancel");
  const modalBtnConfirm = document.getElementById("modal-btn-confirm");

  // Toast Feedback Elements
  const toastFeedback = document.getElementById("toast-feedback");
  const toastMessage = document.getElementById("toast-message");

  // History Elements
  const historyRangeElement = document.getElementById("history-date-range");
  const weeklyTotalValueElement = document.getElementById("weekly-total-value");
  const mostUsedElement = document.getElementById("most-used-platform");

  // Analytics Elements
  const analyticsWeeklyTotal = document.getElementById("analytics-weekly-total");
  const analyticsDateRange = document.getElementById("analytics-date-range");
  const stackChatgpt = document.getElementById("stack-chatgpt");
  const stackGemini = document.getElementById("stack-gemini");
  const stackClaude = document.getElementById("stack-claude");

  const mixValChatgpt = document.getElementById("mix-val-chatgpt");
  const mixPctChatgpt = document.getElementById("mix-pct-chatgpt");
  const mixValGemini = document.getElementById("mix-val-gemini");
  const mixPctGemini = document.getElementById("mix-pct-gemini");
  const mixValClaude = document.getElementById("mix-val-claude");
  const mixPctClaude = document.getElementById("mix-pct-claude");

  const kpiMostUsed = document.getElementById("kpi-most-used");
  const kpiAvgDay = document.getElementById("kpi-avg-day");
  const kpiHighestDay = document.getElementById("kpi-highest-day");
  const kpiLowestDay = document.getElementById("kpi-lowest-day");

  const usageElements = {
    chatgpt: document.getElementById("usage-chatgpt"),
    gemini: document.getElementById("usage-gemini"),
    claude: document.getElementById("usage-claude")
  };

  // Authoritative State Memory from Background Snapshot
  let snapshotState = null;
  let activeTabName = "overview"; // overview | history | analytics | settings
  let previousActiveTabName = "overview"; // Fallback for settings back navigation
  let updateIntervalId = null;

  // Set Version Dynamically from Manifest
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest) {
    const manifest = chrome.runtime.getManifest();
    if (manifest && manifest.version && settingsVersion) {
      settingsVersion.textContent = manifest.version;
    }
  }

  // Bind sub-navigation tab events
  const tabs = [
    { btn: tabOverviewBtn, name: "overview", view: overviewView },
    { btn: tabHistoryBtn, name: "history", view: historyView },
    { btn: tabAnalyticsBtn, name: "analytics", view: analyticsView },
    { btn: btnSettings, name: "settings", view: settingsView }
  ];

  tabs.forEach(tab => {
    if (tab.btn) {
      tab.btn.addEventListener("click", () => {
        if (activeTabName !== "settings") {
          previousActiveTabName = activeTabName; // Record previous tab before entering settings
        }
        activeTabName = tab.name;

        // Remove active class from all buttons & hide views
        tabs.forEach(t => {
          t.btn.classList.remove("active");
          t.view.classList.add("hidden");
        });

        // Add active class and reveal selected view
        tab.btn.classList.add("active");
        tab.view.classList.remove("hidden");

        // Force immediate render of the selected view
        if (activeTabName === "history") {
          renderHistoryView();
        } else if (activeTabName === "analytics") {
          renderAnalyticsView();
        } else if (activeTabName === "overview") {
          updateUsageDisplay();
        }
      });
    }
  });

  // Settings Back Button Listener (← settings-back-btn)
  if (settingsBackBtn) {
    settingsBackBtn.addEventListener("click", () => {
      // Find the previous tab and click it to smoothly navigate back
      const prevTab = tabs.find(t => t.name === previousActiveTabName);
      if (prevTab && prevTab.btn) {
        prevTab.btn.click();
      } else if (tabOverviewBtn) {
        tabOverviewBtn.click();
      }
    });
  }

  // Reusable confirmation dialog helper
  let onConfirmCallback = null;

  function showConfirmModal({ title, desc, confirmLabel, destructive, onConfirm }) {
    if (!confirmModal || !modalTitle || !modalDesc || !modalBtnConfirm) return;

    modalTitle.textContent = title;
    modalDesc.textContent = desc;
    modalBtnConfirm.textContent = confirmLabel;

    // Set appropriate style classes
    if (destructive) {
      modalBtnConfirm.className = "modal-btn confirm destructive";
    } else {
      modalBtnConfirm.className = "modal-btn confirm";
    }

    onConfirmCallback = onConfirm;
    confirmModal.classList.remove("hidden");
    modalBtnConfirm.focus(); // Shift focus to the action button
  }

  // Hide modal on Cancel or click outside
  if (modalBtnCancel) {
    modalBtnCancel.addEventListener("click", () => {
      if (confirmModal) confirmModal.classList.add("hidden");
      onConfirmCallback = null;
    });
  }

  if (modalBtnConfirm) {
    modalBtnConfirm.addEventListener("click", async () => {
      if (confirmModal) confirmModal.classList.add("hidden");
      if (onConfirmCallback) {
        await onConfirmCallback();
      }
      onConfirmCallback = null;
    });
  }

  // Accessibility: Close Modal on Escape Key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && confirmModal && !confirmModal.classList.contains("hidden")) {
      if (modalBtnCancel) modalBtnCancel.click();
    }
  });

  // Toast feedback helper
  function showToast(message) {
    if (!toastFeedback || !toastMessage) return;
    toastMessage.textContent = message;
    toastFeedback.classList.remove("hidden");

    setTimeout(() => {
      toastFeedback.classList.add("hidden");
    }, 2500);
  }

  // Setup Settings Actions Click Listeners
  if (btnClearToday) {
    btnClearToday.addEventListener("click", () => {
      showConfirmModal({
        title: "Clear Today's Data?",
        desc: "This will permanently remove today's tracked usage. Yesterday and older history will remain intact.",
        confirmLabel: "Clear Today",
        destructive: true,
        onConfirm: async () => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "CLEAR_TODAY" }, async (response) => {
              if (response && response.success) {
                showToast("Today's usage cleared");
                await fetchAndUpdateState();
              } else {
                showToast("Unable to clear data");
              }
            });
          } else {
            // Mock clear today's data
            if (snapshotState) {
              const todayKey = snapshotState.todayStr;
              if (snapshotState.weekData[todayKey]) {
                snapshotState.weekData[todayKey] = { chatgpt: 0, gemini: 0, claude: 0, total: 0 };
              }
              // Reset current active session to now
              snapshotState.sessionStartedAt = Date.now();
              updateUsageDisplay();
              renderHistoryView();
              renderAnalyticsView();
            }
            showToast("Today's usage cleared (Mock)");
          }
        }
      });
    });
  }

  if (btnClearHistory) {
    btnClearHistory.addEventListener("click", () => {
      showConfirmModal({
        title: "Clear 7-Day History?",
        desc: "This will permanently remove your stored weekly usage history. Current tracking session will be re-based to now.",
        confirmLabel: "Clear History",
        destructive: true,
        onConfirm: async () => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "CLEAR_HISTORY" }, async (response) => {
              if (response && response.success) {
                showToast("7-Day history cleared");
                await fetchAndUpdateState();
              } else {
                showToast("Unable to clear data");
              }
            });
          } else {
            // Mock clear weekly history
            if (snapshotState) {
              const keys = Object.keys(snapshotState.weekData);
              keys.forEach(k => {
                snapshotState.weekData[k] = { chatgpt: 0, gemini: 0, claude: 0, total: 0 };
              });
              snapshotState.sessionStartedAt = Date.now();
              updateUsageDisplay();
              renderHistoryView();
              renderAnalyticsView();
            }
            showToast("7-Day history cleared (Mock)");
          }
        }
      });
    });
  }

  if (btnResetAll) {
    btnResetAll.addEventListener("click", () => {
      showConfirmModal({
        title: "Reset all LLMTrack data?",
        desc: "This will permanently delete today's usage, 7-day history, analytics, and session state. This cannot be undone.",
        confirmLabel: "Reset Everything",
        destructive: true,
        onConfirm: async () => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ action: "RESET_ALL_DATA" }, async (response) => {
              if (response && response.success) {
                showToast("All tracking data reset");
                await fetchAndUpdateState();
              } else {
                showToast("Unable to reset data");
              }
            });
          } else {
            // Mock Reset All Data
            if (snapshotState) {
              const keys = Object.keys(snapshotState.weekData);
              keys.forEach(k => {
                snapshotState.weekData[k] = { chatgpt: 0, gemini: 0, claude: 0, total: 0 };
              });
              snapshotState.activePlatform = null;
              snapshotState.activeTabId = null;
              snapshotState.sessionStartedAt = null;
              setUnsupportedPlatform();
              updateUsageDisplay();
              renderHistoryView();
              renderAnalyticsView();
            }
            showToast("All tracking data reset (Mock)");
          }
        }
      });
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
        if (activeTabName === "history") {
          renderHistoryView();
        } else if (activeTabName === "analytics") {
          renderAnalyticsView();
        } else if (activeTabName === "overview") {
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

    // Handle History Empty State
    if (weeklyTotalSeconds === 0) {
      if (historyEmptyState) historyEmptyState.classList.remove("hidden");
      if (historyContent) historyContent.classList.add("hidden");
      return;
    } else {
      if (historyEmptyState) historyEmptyState.classList.add("hidden");
      if (historyContent) historyContent.classList.remove("hidden");
    }

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
   * Renders the Analytics View from the authoritative snapshot
   */
  function renderAnalyticsView() {
    if (!snapshotState) return;

    const todayStr = snapshotState.todayStr;
    const currentWeekDates = Object.keys(snapshotState.weekData).sort();

    // Set Date Range
    if (analyticsDateRange && currentWeekDates.length === 7) {
      const monStr = currentWeekDates[0];
      const sunStr = currentWeekDates[6];
      analyticsDateRange.textContent = formatWeekRange(monStr, sunStr);
    }

    // 1. Accumulate totals directly from the same authoritative snapshot dates
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

    // Handle Analytics Empty State
    if (weeklyTotalSeconds === 0) {
      if (analyticsEmptyState) analyticsEmptyState.classList.remove("hidden");
      if (analyticsContent) analyticsContent.classList.add("hidden");
      return;
    } else {
      if (analyticsEmptyState) analyticsEmptyState.classList.add("hidden");
      if (analyticsContent) analyticsContent.classList.remove("hidden");
    }

    // 2. Render Weekly Total
    if (analyticsWeeklyTotal) {
      analyticsWeeklyTotal.textContent = formatSessionDuration(weeklyTotalSeconds * 1000);
    }

    // 3. Render Platform Mix percentages using the Largest Remainder Method (Hamilton Method)
    if (mixPctChatgpt && mixPctGemini && mixPctClaude) {
      const platforms = ["chatgpt", "gemini", "claude"];
      const rawPct = [];
      const flooredPct = [];
      const remainders = [];
      let sumFloored = 0;

      platforms.forEach((p, idx) => {
        const S_p = platformWeeklySeconds[p];
        const valSpan = document.getElementById(`mix-val-${p}`);
        if (valSpan) {
          valSpan.textContent = formatSessionDuration(S_p * 1000);
        }

        if (weeklyTotalSeconds === 0) {
          rawPct.push(0);
          flooredPct.push(0);
          remainders.push(0);
        } else {
          const f_p = (S_p / weeklyTotalSeconds) * 100;
          const i_p = Math.floor(f_p);
          rawPct.push(f_p);
          flooredPct.push(i_p);
          remainders.push(f_p - i_p);
          sumFloored += i_p;
        }
      });

      // Discrepancy allocation
      let diff = 100 - sumFloored;
      if (weeklyTotalSeconds > 0 && diff > 0) {
        // Map elements to sort by largest remainder descending
        const items = remainders.map((r, idx) => ({ idx, remainder: r }));
        items.sort((a, b) => b.remainder - a.remainder);

        for (let i = 0; i < diff; i++) {
          flooredPct[items[i].idx] += 1;
        }
      }

      // Display correct percentages
      mixPctChatgpt.textContent = `${flooredPct[0]}%`;
      mixPctGemini.textContent = `${flooredPct[1]}%`;
      mixPctClaude.textContent = `${flooredPct[2]}%`;

      // Set stacked progress bar segment widths
      if (stackChatgpt) stackChatgpt.style.width = `${flooredPct[0]}%`;
      if (stackGemini) stackGemini.style.width = `${flooredPct[1]}%`;
      if (stackClaude) stackClaude.style.width = `${flooredPct[2]}%`;
    }

    // 4. Render KPIs
    // KPI: MOST USED platform
    if (kpiMostUsed) {
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
        kpiMostUsed.textContent = `${prettyName} (${formatSessionDuration(highestSeconds * 1000)})`;
      } else {
        kpiMostUsed.textContent = "No usage yet";
      }
    }

    // KPI: AVG / DAY (calculating correct non-future-day denominator)
    if (kpiAvgDay) {
      const elapsedDays = currentWeekDates.filter(d => d <= todayStr).length;
      if (elapsedDays > 0 && weeklyTotalSeconds > 0) {
        const avgSec = weeklyTotalSeconds / elapsedDays;
        kpiAvgDay.textContent = formatSessionDuration(avgSec * 1000);
      } else {
        kpiAvgDay.textContent = "0 min";
      }
    }

    // KPI: HIGHEST DAY of the week
    if (kpiHighestDay) {
      const completedDates = currentWeekDates.filter(d => d <= todayStr);
      let highestDate = null;
      let highestSeconds = 0;

      completedDates.forEach((dateStr, index) => {
        const dayTotalSec = dailyTotalSeconds[index];
        if (dayTotalSec > highestSeconds) {
          highestSeconds = dayTotalSec;
          highestDate = dateStr;
        }
      });

      if (highestSeconds > 0 && highestDate) {
        const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const dayIdx = currentWeekDates.indexOf(highestDate);
        const dayName = weekdayNames[dayIdx] || "—";
        kpiHighestDay.textContent = `${dayName} (${formatSessionDuration(highestSeconds * 1000)})`;
      } else {
        kpiHighestDay.textContent = "No usage yet";
      }
    }

    // KPI: LOWEST DAY (ignoring future days, completed zero-usage days count)
    if (kpiLowestDay) {
      const completedDates = currentWeekDates.filter(d => d <= todayStr);
      let lowestDate = null;
      let lowestSeconds = Infinity;

      completedDates.forEach((dateStr, index) => {
        const dayTotalSec = dailyTotalSeconds[index];
        if (dayTotalSec < lowestSeconds) {
          lowestSeconds = dayTotalSec;
          lowestDate = dateStr;
        }
      });

      if (lowestDate && lowestSeconds !== Infinity) {
        const weekdayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const dayIdx = currentWeekDates.indexOf(lowestDate);
        const dayName = weekdayNames[dayIdx] || "—";
        kpiLowestDay.textContent = `${dayName} (${formatSessionDuration(lowestSeconds * 1000)})`;
      } else {
        kpiLowestDay.textContent = "No usage yet";
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
