# LLMTrack

**AI Usage Intelligence — Track how much time you spend using ChatGPT, Gemini, and Claude.**

LLMTrack is a privacy-first Chrome extension that automatically tracks your usage of supported AI platforms. It detects when you are actively using **ChatGPT, Gemini, or Claude**, records valid usage time, and provides daily, weekly, and analytical insights through a clean dark-themed dashboard.

> **Your conversations are not the product. Your usage patterns are.**

---

## ✨ Features

### 🤖 Supported LLMs

LLMTrack currently supports:

* **ChatGPT** — `chatgpt.com`
* **Gemini** — `gemini.google.com`
* **Claude** — `claude.ai`

The extension becomes active for tracking when you are on a supported LLM platform.

---

### ⏱️ Automatic Usage Tracking

LLMTrack automatically tracks valid time spent on supported AI platforms.

It records:

* Platform usage
* Session start times
* Daily usage
* Weekly usage
* Platform-specific usage

You don't need to start or stop a timer manually.

---

### 🕐 Session Tracking

LLMTrack distinguishes between your first usage of an LLM during the day and your current session.

For example:

```text
Started Today       9:18 AM
Current Session     4:01 PM
```

This allows you to understand both:

* When you first opened an LLM that day
* When your current session began

Opening the extension popup does **not** restart the session.

---

### 📊 Daily Usage

The Overview dashboard provides a quick breakdown of your current day's usage:

```text
ChatGPT       1 hr 07 min
Gemini        <1 min
Claude        <1 min
```

Usage is displayed in a human-readable format rather than constantly showing seconds.

---

### 📅 7-Day History

LLMTrack provides a Monday–Sunday weekly history view.

You can see:

* Daily total usage
* Weekly total
* Current day
* Platform activity
* Most-used day

The history automatically transitions to the next week without requiring manual cleanup.

---

### 📈 Analytics

The Analytics dashboard provides higher-level insights into your AI usage.

It includes:

* Weekly total
* Platform mix
* Usage percentages
* Average usage per day
* Most-used LLM
* Highest-usage day
* Lowest-usage day
* Weekly activity visualization

Example:

```text
WEEKLY TOTAL

8 hr 42 min
```

and:

```text
PLATFORM MIX

ChatGPT     61%
Gemini      27%
Claude      12%
```

---

### ⚙️ Data Management

LLMTrack provides controls for managing locally stored usage data.

Available actions include:

* Clear today's usage
* Clear 7-day history
* Reset all tracking data

Destructive actions require confirmation to prevent accidental deletion.

Resetting data also safely handles an active LLM session so previously deleted usage does not reappear.

---

### 🔒 Privacy First

LLMTrack is designed around a simple principle:

> **Track usage, not conversations.**

LLMTrack does **not** need to read or store:

* Prompts
* AI responses
* Conversation messages
* Conversation content

The extension focuses on platform detection, timestamps, sessions, and usage statistics.

No account is required to use the core extension.

---

## 🎨 Interface

LLMTrack uses a **dark-only, compact interface** designed specifically for a Chrome extension popup.

The interface includes:

* Premium dark UI
* LLM-specific colors
* Compact dashboard cards
* Session status indicators
* Overview / History / Analytics navigation
* Settings
* Loading and empty states
* Confirmation dialogs
* Usage visualizations

---

## 🧠 How It Works

At a high level:

```text
Supported LLM Website
        │
        ▼
Platform Detection
        │
        ▼
Tracking Engine
        │
        ▼
Session State
        │
        ▼
Usage Data
        │
        ├──────────────┐
        ▼              ▼
     Daily Data    Weekly Data
        │              │
        └──────┬───────┘
               ▼
          Dashboard
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
    Overview History Analytics
```

The tracking engine maintains the authoritative usage state, while the popup acts as a visualization and control layer.

---

## 🛡️ Tracking Principles

LLMTrack is designed to avoid common time-tracking problems such as:

* Duplicate sessions
* Overlapping usage intervals
* Stale session timestamps
* Incorrect weekly totals
* Usage resurrection after data deletion
* Incorrect time after browser/service-worker restarts
* Unsupported websites being counted as LLM usage

The extension validates tracking state before committing usage data.

---

## 🌐 Supported Platform Detection

| Platform | Domain              | Status      |
| -------- | ------------------- | ----------- |
| ChatGPT  | `chatgpt.com`       | ✅ Supported |
| Gemini   | `gemini.google.com` | ✅ Supported |
| Claude   | `claude.ai`         | ✅ Supported |

Unsupported websites are not counted as LLM usage.

---

## 🗓️ Weekly Tracking

LLMTrack uses a fixed weekly structure:

```text
Monday
Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday
```

The weekly dashboard automatically transitions when a new week begins.

Future days are distinguished from days with zero recorded usage.

---

## 🧹 Data Controls

### Clear Today's Usage

Removes the current day's stored usage while preserving previous history.

### Clear 7-Day History

Removes the stored weekly history while keeping the extension functional.

### Reset All Data

Completely resets stored tracking data and safely reinitializes the current tracking state.

These actions do not uninstall the extension.

---

## 🏗️ Architecture

LLMTrack follows a local-first architecture:

```text
Chrome Browser
      │
      ▼
Content Scripts
      │
      ▼
Platform Detection
      │
      ▼
Background Tracking Engine
      │
      ▼
Authoritative Session State
      │
      ▼
Chrome Extension Storage
      │
      ├── Daily Usage
      ├── Weekly History
      └── Session State
              │
              ▼
          Popup UI
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
   Overview History Analytics
```

The architecture is designed around **one authoritative tracking source** rather than separate timers running independently in the popup and background.

---

## 🔐 Permissions

LLMTrack uses Chrome extension permissions required for:

* Detecting supported LLM websites
* Tracking browser/tab state
* Maintaining extension state
* Storing usage statistics locally

The extension does not require permissions for unrelated user data.

---

## 🚀 Installation

### Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd LLMTrack
```

### Load in Chrome

1. Open Chrome.
2. Navigate to:

```text
chrome://extensions/
```

3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Select the LLMTrack project directory.
6. Pin LLMTrack to your Chrome toolbar.

Open one of the supported platforms:

* ChatGPT
* Gemini
* Claude

Then open the LLMTrack popup to view your tracking dashboard.

---

## 🧪 Testing

LLMTrack should be tested across several browser scenarios.

### Platform Switching

```text
ChatGPT
   ↓
Gemini
   ↓
Claude
   ↓
Unsupported Website
```

### Multiple Tabs

```text
ChatGPT Tab 1
ChatGPT Tab 2
Gemini Tab 1
Claude Tab 1
```

### Browser Lifecycle

* Popup open/close
* Extension reload
* Browser restart
* Service-worker restart
* Tab close
* Window close

### Date Transitions

* Midnight
* Sunday → Monday
* Month transition
* Year transition

### Data Management

* Clear Today
* Clear History
* Reset All Data

The expected result is that usage remains consistent across Overview, History, and Analytics.

---

## 📋 Project Status

**Current Phase: Phase 7 — Reliability & Final Tracking Validation**

| Phase   | Description                        | Status |
| ------- | ---------------------------------- | ------ |
| Phase 0 | Foundation                         | ✅      |
| Phase 1 | LLM Detection                      | ✅      |
| Phase 2 | Usage & Session Tracking           | ✅      |
| Phase 3 | 7-Day History                      | ✅      |
| Phase 4 | Analytics & Tracking Stabilization | ✅      |
| Phase 5 | Settings & Data Management         | ✅      |
| Phase 6 | UI/UX Polish                       | ✅      |
| Phase 7 | Reliability & Stress Testing       | 🚧     |

---

## 🛣️ Roadmap

Future improvements may include:

* Additional AI platforms
* More detailed usage insights
* Improved analytics
* Exportable usage reports
* Additional privacy controls
* Performance improvements
* Production release improvements

Features will be added without compromising the core privacy-first design.

---

## 🤝 Contributing

Contributions, suggestions, and bug reports are welcome.

### Development workflow

```bash
git clone <YOUR_REPOSITORY_URL>
cd LLMTrack
```

Create a feature branch:

```bash
git checkout -b feature/your-feature
```

Make your changes, test the extension thoroughly, and submit a pull request.

---

## 🐛 Bug Reports

When reporting a bug, include:

* Chrome version
* Operating system
* Supported LLM involved
* Steps to reproduce
* Expected behavior
* Actual behavior
* Console errors, if applicable

Do **not** include private conversation content or prompts in bug reports.

---

## 📄 License

This project is licensed under the **MIT License**.

See the `LICENSE` file for details.

---

## 👨‍💻 Author

**Phani Charan**

Computer Science Engineering — Artificial Intelligence & Machine Learning

### Links

* GitHub: `https://github.com/karalapatiphanicharan-cyber`
* LinkedIn: `https://www.linkedin.com/in/phani-charan-7335283a5/`
* LeetCode: `https://leetcode.com/u/GV2023000500/`

---

## ⭐ Support

If you find LLMTrack useful, consider giving the repository a **star ⭐** on GitHub.

---

> **LLMTrack — Understand your AI usage. Track the time, not the conversation.**
