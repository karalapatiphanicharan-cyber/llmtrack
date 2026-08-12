# LLMTrack — Phase 0: Project Foundation

LLMTrack is a Chrome Extension that will eventually track active usage time across major LLMs (ChatGPT, Google Gemini, and Claude) and provide daily/weekly insights through an elegant dashboard.

This is the foundational setup (**Phase 0**) of LLMTrack, preparing the extension with modular utilities, empty content scripts, an elegant action popup, and a background service worker template.

## Supported Platforms

LLMTrack centers detection logic on official domains:
- **ChatGPT**: `chatgpt.com`
- **Gemini**: `gemini.google.com`
- **Claude**: `claude.ai`

## Project Structure

```text
llmtrack/
├── manifest.json
├── README.md
├── .gitignore
├── package.json
│
├── src/
│   ├── background/
│   │   └── service-worker.js
│   │
│   ├── content/
│   │   ├── chatgpt.js
│   │   ├── gemini.js
│   │   └── claude.js
│   │
│   ├── popup/
│   │   ├── index.html
│   │   ├── popup.js
│   │   └── popup.css
│   │
│   └── utils/
│       ├── llmDetector.js
│       ├── storage.js
│       └── time.js
│
└── assets/
    └── icons/
        ├── icon-16.png
        ├── icon-48.png
        └── icon-128.png
```

## How to Load the Extension in Chrome

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `llmtrack` project directory.
6. The LLMTrack extension will load and appear in your extension toolbar.

## Privacy Principle

LLMTrack values user privacy and is designed to run completely locally.
- **No conversation tracking**: The extension does **NOT** read user prompts, AI responses, conversation details, or page content.
- **Usage Metadata Only**: Only the timing metadata of active tabs (duration, timestamps) is saved in the local chrome storage.

---

*Note: The actual background timers, multi-tab synchronization, and statistics dashboard will be implemented in later phases. Currently, the extension runs in structural verification mode.*
