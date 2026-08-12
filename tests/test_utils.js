import assert from "assert";
import { detectLLM } from "../src/utils/llmDetector.js";
import { getData, setData, removeData, clearData } from "../src/utils/storage.js";
import { getCurrentTimestamp, getLocalDateString, getElapsedTime, formatDuration } from "../src/utils/time.js";

async function runTests() {
  console.log("=== Running LLMTrack Phase 1 Unit Tests ===\n");

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

  assert.strictEqual(formatDuration(0), "0s");
  assert.strictEqual(formatDuration(1000), "1s");
  assert.strictEqual(formatDuration(65000), "1m 5s");
  assert.strictEqual(formatDuration(3665000), "1h 1m 5s");

  console.log("✅ time.js tests passed.");

  // 3. Test Storage Utilities
  console.log("\nTesting storage.js...");
  await clearData();
  await setData({ activeTab: 123, platform: "claude" });
  let data = await getData(["activeTab", "platform"]);
  assert.deepStrictEqual(data, { activeTab: 123, platform: "claude" });
  console.log("✅ storage.js tests passed.");

  console.log("\n🎉 ALL TESTS PASSED! Ready for Phase 1.");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});
