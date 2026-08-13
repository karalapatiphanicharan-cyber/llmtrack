import assert from "assert";
import { detectLLM } from "../src/utils/llmDetector.js";
import { getData, setData, removeData, clearData, mockStorage } from "../src/utils/storage.js";
import { getCurrentTimestamp, getLocalDateString, getElapsedTime, formatDuration, formatSessionDuration, formatCleanTime, splitSessionByDay, getStartOfCurrentWeek, getCurrentWeekDates } from "../src/utils/time.js";
import { recordSessionUsage, getDailyUsage, recordFirstOpened, performWeeklyRolloverCleanup, getUsageSnapshot, clearTodayUsage, clearHistoryUsage } from "../src/background/usage-tracker.js";
import { handleTransition, getActiveSession, endActiveSession, reconcileStaleSession, updateSessionLastActive, rebaseActiveSession, resetActiveSessionState } from "../src/background/session-tracker.js";

async function runTests() {
  console.log("=== Running LLMTrack Phase 1, 2 & 3 Unit Tests ===\n");

  // 1. Test LLM Detector (Advanced Phase 1 cases)
  console.log("Testing llmDetector.js URL matching...");

  // Valid ChatGPT URLs
  assert.deepStrictEqual(detectLLM("https://chatgpt.com"), { supported: true, platform: "chatgpt" });
  assert.deepStrictEqual(detectLLM("https://chatgpt.com/"), { supported: true, platform: "chatgpt" });
  assert.deepStrictEqual(detectLLM("https://chatgpt.com/c/abc123"), { supported: true, platform: "chatgpt" });
  assert.deepStrictEqual(detectLLM("https://chatgpt.com/?model=gpt-5"), { supported: true, platform: "chatgpt" });
  assert.deepStrictEqual(detectLLM("https://subdomain.chatgpt.com/some/path?param=1"), { supported: true, platform: "chatgpt" });

  // Valid Gemini URLs
  assert.deepStrictEqual(detectLLM("https://gemini.google.com"), { supported: true, platform: "gemini" });
  assert.deepStrictEqual(detectLLM("https://gemini.google.com/"), { supported: true, platform: "gemini" });
  assert.deepStrictEqual(detectLLM("https://gemini.google.com/app"), { supported: true, platform: "gemini" });
  assert.deepStrictEqual(detectLLM("https://gemini.google.com/app?query=abc"), { supported: true, platform: "gemini" });
  assert.deepStrictEqual(detectLLM("https://test.gemini.google.com/"), { supported: true, platform: "gemini" });

  // Valid Claude URLs
  assert.deepStrictEqual(detectLLM("https://claude.ai"), { supported: true, platform: "claude" });
  assert.deepStrictEqual(detectLLM("https://claude.ai/"), { supported: true, platform: "claude" });
  assert.deepStrictEqual(detectLLM("https://claude.ai/new"), { supported: true, platform: "claude" });
  assert.deepStrictEqual(detectLLM("https://claude.ai/chat/abc123"), { supported: true, platform: "claude" });
  assert.deepStrictEqual(detectLLM("https://sub.claude.ai/chat/abc123?test=1"), { supported: true, platform: "claude" });

  // Prevent False Positives (No sub-string matching on host)
  assert.deepStrictEqual(detectLLM("https://example.com/chatgpt.com"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://notchatgpt.com"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://gemini.google.com.example.com"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://claude.ai.scam.ru"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://example.com/?q=chatgpt"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://example.com/gemini/app"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://example.com/claude"), { supported: false, platform: null });

  // Non-http protocols should be ignored
  assert.deepStrictEqual(detectLLM("chrome-extension://abcdef/popup.html"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("file:///C:/Users/test/index.html"), { supported: false, platform: null });

  // Handle empty / invalid cases
  assert.deepStrictEqual(detectLLM(""), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM(null), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM(undefined), { supported: false, platform: null });

  console.log("✅ llmDetector.js Phase 1 validation tests passed successfully!");

  // 2. Test Time Utilities
  console.log("\nTesting time.js...");
  const now = getCurrentTimestamp();
  assert.strictEqual(typeof now, "number");
  assert.ok(now > 0);

  const todayStr = getLocalDateString();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);

  // Original format duration
  assert.strictEqual(formatDuration(0), "0s");
  assert.strictEqual(formatDuration(1000), "1s");
  assert.strictEqual(formatDuration(65000), "1m 5s");
  assert.strictEqual(formatDuration(3665000), "1h 1m 5s");

  // New clean session duration formatter
  assert.strictEqual(formatSessionDuration(0), "<1 min");
  assert.strictEqual(formatSessionDuration(59000), "<1 min");
  assert.strictEqual(formatSessionDuration(60000), "1 min");
  assert.strictEqual(formatSessionDuration(119000), "1 min");
  assert.strictEqual(formatSessionDuration(120000), "2 min");
  assert.strictEqual(formatSessionDuration(3540000), "59 min");
  assert.strictEqual(formatSessionDuration(3600000), "1 hr");
  assert.strictEqual(formatSessionDuration(3900000), "1 hr 05 min");
  assert.strictEqual(formatSessionDuration(9000000), "2 hr 30 min");

  // New clean time formatter (local h:mm A)
  // We can construct dates to test AM/PM boundary formatting
  const amDate = new Date("2026-08-12T06:38:00").getTime();
  assert.strictEqual(formatCleanTime(amDate), "6:38 AM");

  const pmDate = new Date("2026-08-12T18:38:36").getTime();
  assert.strictEqual(formatCleanTime(pmDate), "6:38 PM");

  const midnightDate = new Date("2026-08-12T00:05:00").getTime();
  assert.strictEqual(formatCleanTime(midnightDate), "12:05 AM");

  const noonDate = new Date("2026-08-12T12:00:00").getTime();
  assert.strictEqual(formatCleanTime(noonDate), "12:00 PM");

  console.log("✅ time.js tests passed.");

  // 3. Test Storage Utilities
  console.log("\nTesting storage.js...");
  await clearData();
  await setData({ activeTab: 123, platform: "claude" });
  let data = await getData(["activeTab", "platform"]);
  assert.deepStrictEqual(data, { activeTab: 123, platform: "claude" });
  console.log("✅ storage.js tests passed.");

  // 4. Test Phase 2 Midnight boundary splitting
  console.log("\nTesting usage-tracker.js (splitSessionByDay)...");
  // Test non-crossing session
  const t1 = new Date("2026-08-12T10:00:00").getTime();
  const t2 = new Date("2026-08-12T10:15:00").getTime();
  const segs1 = splitSessionByDay(t1, t2);
  assert.strictEqual(segs1.length, 1);
  assert.strictEqual(segs1[0].date, "2026-08-12");
  assert.strictEqual(segs1[0].durationMs, 15 * 60 * 1000);

  // Test single midnight crossing
  const tStart = new Date("2026-08-12T23:59:50").getTime();
  const tEnd = new Date("2026-08-13T00:00:30").getTime();
  const segs2 = splitSessionByDay(tStart, tEnd);
  assert.strictEqual(segs2.length, 2);
  assert.strictEqual(segs2[0].date, "2026-08-12");
  assert.strictEqual(segs2[0].durationMs, 10 * 1000);
  assert.strictEqual(segs2[1].date, "2026-08-13");
  assert.strictEqual(segs2[1].durationMs, 30 * 1000);

  // Test triple midnight crossing
  const tStartMulti = new Date("2026-08-12T23:50:00").getTime();
  const tEndMulti = new Date("2026-08-14T00:05:00").getTime();
  const segs3 = splitSessionByDay(tStartMulti, tEndMulti);
  assert.strictEqual(segs3.length, 3);
  assert.strictEqual(segs3[0].date, "2026-08-12");
  assert.strictEqual(segs3[0].durationMs, 10 * 60 * 1000);
  assert.strictEqual(segs3[1].date, "2026-08-13");
  assert.strictEqual(segs3[1].durationMs, 24 * 60 * 60 * 1000);
  assert.strictEqual(segs3[2].date, "2026-08-14");
  assert.strictEqual(segs3[2].durationMs, 5 * 60 * 1000);

  console.log("✅ usage-tracker.js (splitSessionByDay) tests passed.");

  // 5. Test Phase 3 Current Week calculations
  console.log("\nTesting time.js week helpers...");
  // Test Monday start of current week
  const monTest = new Date("2026-08-12T10:00:00"); // Wednesday
  const monStart = getStartOfCurrentWeek(monTest);
  assert.strictEqual(getLocalDateString(monStart), "2026-08-10");

  const sunTest = new Date("2026-08-16T15:00:00"); // Sunday
  const sunStart = getStartOfCurrentWeek(sunTest);
  assert.strictEqual(getLocalDateString(sunStart), "2026-08-10");

  const weekDates = getCurrentWeekDates(monTest);
  assert.strictEqual(weekDates.length, 7);
  assert.strictEqual(weekDates[0], "2026-08-10"); // Monday
  assert.strictEqual(weekDates[6], "2026-08-16"); // Sunday
  console.log("✅ time.js week helper tests passed.");

  // 6. Test Weekly Rollover and storage cleanup
  console.log("\nTesting performWeeklyRolloverCleanup...");
  await clearData();
  const currentWeekDates = getCurrentWeekDates(new Date("2026-08-12T10:00:00"));

  const mockUsageData = {
    "2026-08-09": { chatgpt: { totalUsageSeconds: 100 } }, // Old week Sunday
    "2026-08-10": { chatgpt: { totalUsageSeconds: 200 } }, // Current week Monday
    "2026-08-11": { gemini: { totalUsageSeconds: 150 } },  // Current week Tuesday
  };
  await setData({ dailyUsage: mockUsageData });

  const tOpened = new Date("2026-08-12T04:30:00").getTime();
  await recordFirstOpened("chatgpt", tOpened);

  let cleanedUsage = await getDailyUsage();
  assert.strictEqual(cleanedUsage["2026-08-09"], undefined);
  assert.strictEqual(cleanedUsage["2026-08-10"]["chatgpt"].totalUsageSeconds, 200);
  assert.strictEqual(cleanedUsage["2026-08-11"]["gemini"].totalUsageSeconds, 150);
  assert.strictEqual(cleanedUsage["2026-08-12"]["chatgpt"].firstOpenedAt, tOpened);
  console.log("✅ performWeeklyRolloverCleanup tests passed.");

  // 7. Test Centralized Snapshot Logic (getUsageSnapshot)
  console.log("\nTesting getUsageSnapshot...");
  await clearData();

  const realWeekDates = getCurrentWeekDates();
  const monDateStr = realWeekDates[0]; // Monday
  const mockWeekDataSnapshot = {
    [monDateStr]: {
      chatgpt: { totalUsageSeconds: 120, firstOpenedAt: Date.now() - 24 * 3600 * 1000 }
    }
  };
  await setData({ dailyUsage: mockWeekDataSnapshot });

  // Mock active session running right now (on real today)
  const activeSess = {
    activePlatform: "chatgpt",
    activeTabId: 501,
    sessionStartedAt: Date.now() - 30000 // 30 seconds elapsed
  };

  const snapshot = await getUsageSnapshot(activeSess);

  // Verify active platform properties are present
  assert.strictEqual(snapshot.activePlatform, "chatgpt");
  assert.strictEqual(snapshot.activeTabId, 501);
  assert.strictEqual(snapshot.sessionStartedAt, activeSess.sessionStartedAt);

  // Monday's total must be preserved exactly (120s)
  assert.strictEqual(snapshot.weekData[monDateStr].chatgpt, 120);

  // Today must contain the 30 seconds of live running session!
  const todayDateStr = getLocalDateString();
  assert.strictEqual(snapshot.weekData[todayDateStr].chatgpt, 30);
  assert.strictEqual(snapshot.weekData[todayDateStr].total, 30);

  console.log("✅ getUsageSnapshot tests passed successfully!");

  // 8. Test Usage Record & Storage Persistence
  console.log("\nTesting usage-tracker.js recording and persistence...");
  await clearData();
  const u1 = new Date("2026-08-12T10:00:00").getTime();
  const u2 = new Date("2026-08-12T10:02:00").getTime(); // 120s
  await recordSessionUsage("chatgpt", u1, u2);

  let usage = await getDailyUsage();
  assert.strictEqual(usage["2026-08-12"]["chatgpt"].totalUsageSeconds, 120);

  console.log("✅ usage-tracker.js persistence tests passed.");

  // 9. Test Session Tracker lifecycle transitions
  console.log("\nTesting session-tracker.js lifecycle transitions...");
  await clearData();
  await endActiveSession();

  await handleTransition("chatgpt", 101);
  let session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");
  assert.strictEqual(session.activeTabId, 101);
  assert.ok(session.sessionStartedAt > 0);

  session.sessionStartedAt = Date.now() - 10000;

  const initialStart = session.sessionStartedAt;
  await handleTransition("chatgpt", 102);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");
  assert.strictEqual(session.activeTabId, 102);
  assert.strictEqual(session.sessionStartedAt, initialStart);

  await handleTransition("claude", 103);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "claude");
  assert.strictEqual(session.activeTabId, 103);

  usage = await getDailyUsage();
  assert.ok(usage[getLocalDateString()] !== undefined);
  assert.strictEqual(usage[getLocalDateString()]["chatgpt"].totalUsageSeconds, 10);

  await handleTransition(null, 103);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "claude");
  assert.strictEqual(session.activeTabId, 103);

  await handleTransition("claude", 103);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "claude");

  await handleTransition(null, 103);
  console.log("Waiting 1.6 seconds for debounce to complete...");
  await new Promise(resolve => setTimeout(resolve, 1600));

  session = getActiveSession();
  assert.strictEqual(session.activePlatform, null);
  assert.strictEqual(session.activeTabId, null);
  assert.strictEqual(session.sessionStartedAt, null);

  console.log("✅ session-tracker.js lifecycle tests passed.");

  // 10. Test Stale Session Detection and Healing
  console.log("\nTesting stale session detection and healing...");
  await clearData();
  await endActiveSession();

  // Mock an active session started 30 mins ago, and last active 20 mins ago (10 min active)
  const startTime = Date.now() - 30 * 60 * 1000;
  const lastActiveTime = Date.now() - 20 * 60 * 1000;

  session = getActiveSession();
  session.activePlatform = "chatgpt";
  session.activeTabId = 201;
  session.sessionStartedAt = startTime;
  session.lastActive = lastActiveTime;
  await setData({ activeSession: session });

  // Trigger reconciliation by transitioning to unsupported
  // Reconcile stale session should run and finalize session at lastActiveTime (10 min = 600s)
  await handleTransition(null, 201);

  // Verify session was terminated
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, null);
  assert.strictEqual(session.sessionStartedAt, null);

  // Verify usage recorded up to lastActiveTime (10 minutes)
  usage = await getDailyUsage();
  const todayStrKey = getLocalDateString();
  assert.strictEqual(usage[todayStrKey]["chatgpt"].totalUsageSeconds, 10 * 60);

  console.log("✅ Stale session detection and healing tests passed.");

  // 11. Test Data-Corruption Healing
  console.log("\nTesting data-corruption healing...");
  await clearData();

  // Set up a corrupted record: today has a firstOpenedAt 5 minutes ago, but totalUsageSeconds is 9 hours
  const firstOpened = Date.now() - 5 * 60 * 1000;
  const corruptedUsageData = {
    [todayStrKey]: {
      chatgpt: { totalUsageSeconds: 9 * 3600, firstOpenedAt: firstOpened },
      gemini: { totalUsageSeconds: -50 } // negative usage
    }
  };
  await setData({ dailyUsage: corruptedUsageData });

  // Running performWeeklyRolloverCleanup should sanitize these
  const sanitized = await performWeeklyRolloverCleanup();

  // ChatGPT should be reset to 0 because 9 hours is impossible since firstOpened (5 min ago)
  assert.strictEqual(sanitized[todayStrKey]["chatgpt"].totalUsageSeconds, 0);

  // Gemini should be reset to 0 because of negative value
  assert.strictEqual(sanitized[todayStrKey]["gemini"].totalUsageSeconds, 0);

  console.log("✅ Data-corruption healing tests passed.");

  // 12. Test Settings Data Deletion and Reset Routines
  console.log("\nTesting settings data clearing and active session rebasing...");
  await clearData();
  await endActiveSession();

  // Establish some historical weekly usage data
  const tToday = getLocalDateString();
  const tMon = getCurrentWeekDates()[0];
  const complexMockData = {
    [tMon]: { chatgpt: { totalUsageSeconds: 1200 } },
    [tToday]: { chatgpt: { totalUsageSeconds: 600, firstOpenedAt: Date.now() - 3600 * 1000 } }
  };
  await setData({ dailyUsage: complexMockData });

  // Start an active ChatGPT session
  await handleTransition("chatgpt", 301);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");

  // Set sessionStartedAt to 20 mins ago (elapsed = 1200 seconds)
  session.sessionStartedAt = Date.now() - 20 * 60 * 1000;
  await setData({ activeSession: session });

  // Test CLEAR_TODAY routine
  await clearTodayUsage();
  await rebaseActiveSession();

  // Verify today's storage usage is cleared, but Monday remains
  let clearedTodayUsage = await getDailyUsage();
  assert.strictEqual(clearedTodayUsage[tToday], undefined);
  assert.strictEqual(clearedTodayUsage[tMon]["chatgpt"].totalUsageSeconds, 1200);

  // Verify active session was re-based to now (meaning its elapsed contribution since reset is ~0s)
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");
  assert.ok(Date.now() - session.sessionStartedAt < 5000); // within 5 seconds of now

  // Now, test CLEAR_HISTORY routine
  // Put back some today usage
  await setData({ dailyUsage: complexMockData });
  await clearHistoryUsage();
  await rebaseActiveSession();

  // Verify all dailyUsage is wiped
  let clearedHistUsage = await getDailyUsage();
  assert.deepStrictEqual(clearedHistUsage, {});

  // Test RESET_ALL_DATA routine
  // Start session again
  await handleTransition("chatgpt", 301);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");

  // Call resetActiveSessionState
  await resetActiveSessionState();

  // Verify activeSession is fully cleared
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, null);
  assert.strictEqual(session.sessionStartedAt, null);

  console.log("✅ Settings clearing and re-basing tests passed successfully.");

  console.log("\n🎉 ALL TESTS PASSED! Ready for Phase 3.");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
