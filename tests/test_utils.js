import assert from "assert";
import { detectLLM } from "../src/utils/llmDetector.js";
import { getData, setData, removeData, clearData, mockStorage } from "../src/utils/storage.js";
import { getCurrentTimestamp, getLocalDateString, getElapsedTime, formatDuration, formatSessionDuration, formatCleanTime, splitSessionByDay, getStartOfCurrentWeek, getCurrentWeekDates } from "../src/utils/time.js";
import { recordSessionUsage, getDailyUsage, recordFirstOpened, performWeeklyRolloverCleanup } from "../src/background/usage-tracker.js";
import { handleTransition, getActiveSession, endActiveSession } from "../src/background/session-tracker.js";

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
  // Set up mock daily usage with both old week and current week entries
  // Let's assume current week dates are centered around 2026-08-12 (Mon Aug 10 - Sun Aug 16)
  const currentWeekDates = getCurrentWeekDates(new Date("2026-08-12T10:00:00"));

  const mockUsageData = {
    "2026-08-09": { chatgpt: { totalUsageSeconds: 100 } }, // Old week Sunday
    "2026-08-10": { chatgpt: { totalUsageSeconds: 200 } }, // Current week Monday
    "2026-08-11": { gemini: { totalUsageSeconds: 150 } },  // Current week Tuesday
  };
  await setData({ dailyUsage: mockUsageData });

  // Running recordFirstOpened should trigger automatic rollover cleanup
  // Let's mock the current system time to be Wednesday, Aug 12, 2026 during this test
  const tOpened = new Date("2026-08-12T04:30:00").getTime();
  await recordFirstOpened("chatgpt", tOpened);

  const cleanedUsage = await getDailyUsage();
  // Old week entry "2026-08-09" must be cleaned up!
  assert.strictEqual(cleanedUsage["2026-08-09"], undefined);
  // Current week entries must be preserved!
  assert.strictEqual(cleanedUsage["2026-08-10"]["chatgpt"].totalUsageSeconds, 200);
  assert.strictEqual(cleanedUsage["2026-08-11"]["gemini"].totalUsageSeconds, 150);
  // New entry must be recorded correctly under today's date!
  assert.strictEqual(cleanedUsage["2026-08-12"]["chatgpt"].firstOpenedAt, tOpened);
  console.log("✅ performWeeklyRolloverCleanup tests passed.");

  // 7. Test Usage Record & Storage Persistence
  console.log("\nTesting usage-tracker.js recording and persistence...");
  await clearData();
  const u1 = new Date("2026-08-12T10:00:00").getTime();
  const u2 = new Date("2026-08-12T10:02:00").getTime(); // 120s
  await recordSessionUsage("chatgpt", u1, u2);

  let usage = await getDailyUsage();
  assert.strictEqual(usage["2026-08-12"]["chatgpt"].totalUsageSeconds, 120);

  // Accumulate
  const u3 = new Date("2026-08-12T11:00:00").getTime();
  const u4 = new Date("2026-08-12T11:00:30").getTime(); // 30s
  await recordSessionUsage("chatgpt", u3, u4);

  usage = await getDailyUsage();
  assert.strictEqual(usage["2026-08-12"]["chatgpt"].totalUsageSeconds, 150);

  console.log("✅ usage-tracker.js persistence tests passed.");

  // 8. Test Session Tracker lifecycle transitions
  console.log("\nTesting session-tracker.js lifecycle transitions...");
  await clearData();
  await endActiveSession(); // Ensure starting from a clean state

  // Start chatgpt session
  await handleTransition("chatgpt", 101);
  let session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");
  assert.strictEqual(session.activeTabId, 101);
  assert.ok(session.sessionStartedAt > 0);

  // Backdate ChatGPT session start by 10 seconds to simulate elapsed duration
  session.sessionStartedAt = Date.now() - 10000;

  // Same-platform tab switch: chatgpt 101 -> chatgpt 102
  const initialStart = session.sessionStartedAt;
  await handleTransition("chatgpt", 102);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "chatgpt");
  assert.strictEqual(session.activeTabId, 102);
  assert.strictEqual(session.sessionStartedAt, initialStart); // Must remain continuous!

  // Platform switch: chatgpt 102 -> claude 103
  // This should record usage for chatgpt first
  await handleTransition("claude", 103);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "claude");
  assert.strictEqual(session.activeTabId, 103);

  // Verify chatgpt recorded 10 seconds of usage
  usage = await getDailyUsage();
  const todayLocalDate = getLocalDateString();
  assert.ok(usage[todayLocalDate] !== undefined);
  assert.strictEqual(usage[todayLocalDate]["chatgpt"].totalUsageSeconds, 10);

  // Debounced Transition to Unsupported: claude 103 -> null 103
  await handleTransition(null, 103);
  session = getActiveSession();
  // Immediately, session is still in-memory and tabId is updated
  assert.strictEqual(session.activePlatform, "claude");
  assert.strictEqual(session.activeTabId, 103);

  // If user returns back to claude before 1.5s delay, the debounce timer is cleared and session continues
  await handleTransition("claude", 103);
  session = getActiveSession();
  assert.strictEqual(session.activePlatform, "claude");

  // Switch to unsupported again, and let's wait for debounce to elapse
  await handleTransition(null, 103);
  console.log("Waiting 1.6 seconds for debounce to complete...");
  await new Promise(resolve => setTimeout(resolve, 1600));

  session = getActiveSession();
  assert.strictEqual(session.activePlatform, null);
  assert.strictEqual(session.activeTabId, null);
  assert.strictEqual(session.sessionStartedAt, null);

  console.log("✅ session-tracker.js lifecycle tests passed.");

  console.log("\n🎉 ALL TESTS PASSED! Ready for Phase 3.");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
