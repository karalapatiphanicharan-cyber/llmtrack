import assert from "assert";
import { detectLLM } from "../src/utils/llmDetector.js";
import { getData, setData, removeData, clearData, mockStorage } from "../src/utils/storage.js";
import { getCurrentTimestamp, getLocalDateString, getElapsedTime, formatDuration } from "../src/utils/time.js";

async function runTests() {
  console.log("=== Running LLMTrack Foundation Unit Tests ===\n");

  // 1. Test LLM Detector
  console.log("Testing llmDetector.js...");

  // Valid ChatGPT URLs
  assert.deepStrictEqual(detectLLM("https://chatgpt.com"), { supported: true, platform: "chatgpt" });
  assert.deepStrictEqual(detectLLM("https://chatgpt.com/c/uuid-here"), { supported: true, platform: "chatgpt" });
  assert.deepStrictEqual(detectLLM("https://subdomain.chatgpt.com/"), { supported: true, platform: "chatgpt" });

  // Valid Gemini URLs
  assert.deepStrictEqual(detectLLM("https://gemini.google.com"), { supported: true, platform: "gemini" });
  assert.deepStrictEqual(detectLLM("https://gemini.google.com/app"), { supported: true, platform: "gemini" });

  // Valid Claude URLs
  assert.deepStrictEqual(detectLLM("https://claude.ai"), { supported: true, platform: "claude" });
  assert.deepStrictEqual(detectLLM("https://claude.ai/chat/123"), { supported: true, platform: "claude" });

  // Unsupported URLs
  assert.deepStrictEqual(detectLLM("https://google.com"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM("https://github.com"), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM(""), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM(null), { supported: false, platform: null });
  assert.deepStrictEqual(detectLLM(undefined), { supported: false, platform: null });

  console.log("✅ llmDetector.js tests passed.");

  // 2. Test Time Utilities
  console.log("\nTesting time.js...");

  // getCurrentTimestamp
  const now = getCurrentTimestamp();
  assert.strictEqual(typeof now, "number");
  assert.ok(now > 0);

  // getLocalDateString
  const todayStr = getLocalDateString();
  assert.match(todayStr, /^\d{4}-\d{2}-\d{2}$/);

  // Test specific dates with timezone offsets
  const specificDate = new Date("2025-01-15T12:00:00Z");
  const localDateStr = getLocalDateString(specificDate);
  assert.match(localDateStr, /^\d{4}-\d{2}-\d{2}$/);

  // getElapsedTime
  const start = Date.now() - 5000;
  const elapsed = getElapsedTime(start);
  assert.ok(elapsed >= 5000 && elapsed < 5100);
  assert.strictEqual(getElapsedTime(0), 0);

  // formatDuration
  assert.strictEqual(formatDuration(0), "0s");
  assert.strictEqual(formatDuration(150), "0s"); // less than 1 second
  assert.strictEqual(formatDuration(1000), "1s");
  assert.strictEqual(formatDuration(65000), "1m 5s");
  assert.strictEqual(formatDuration(3665000), "1h 1m 5s");
  assert.strictEqual(formatDuration(-500), "0s");
  assert.strictEqual(formatDuration(null), "0s");

  console.log("✅ time.js tests passed.");

  // 3. Test Storage Utilities (Mock fallback mode)
  console.log("\nTesting storage.js (fallback mock storage)...");

  // Initial clear
  await clearData();
  let emptyData = await getData();
  assert.deepStrictEqual(emptyData, {});

  // Write and Read
  await setData({ testKey: "testValue", counter: 10 });
  let fetched = await getData("testKey");
  assert.deepStrictEqual(fetched, { testKey: "testValue" });

  let multiple = await getData(["testKey", "counter", "nonExistent"]);
  assert.deepStrictEqual(multiple, { testKey: "testValue", counter: 10, nonExistent: undefined });

  // Remove data
  await removeData("testKey");
  let afterRemove = await getData("testKey");
  assert.deepStrictEqual(afterRemove, { testKey: undefined });

  // Multi-key removal
  await setData({ keyA: 1, keyB: 2 });
  await removeData(["keyA", "keyB"]);
  let afterMultiRemove = await getData(["keyA", "keyB"]);
  assert.deepStrictEqual(afterMultiRemove, { keyA: undefined, keyB: undefined });

  console.log("✅ storage.js tests passed.");

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Phase 0 foundation is robust.");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
