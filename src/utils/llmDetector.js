/**
 * LLM Detector Utility
 * Centrally defines supported platforms and matches URLs.
 */

export const SUPPORTED_LLMS = {
  CHATGPT: {
    id: "chatgpt",
    name: "ChatGPT",
    domain: "chatgpt.com",
    urlPattern: "https://chatgpt.com"
  },
  GEMINI: {
    id: "gemini",
    name: "Gemini",
    domain: "gemini.google.com",
    urlPattern: "https://gemini.google.com"
  },
  CLAUDE: {
    id: "claude",
    name: "Claude",
    domain: "claude.ai",
    urlPattern: "https://claude.ai"
  }
};

/**
 * Normalizes and analyzes a URL to determine if it is a supported LLM platform.
 * @param {string} urlString - The URL to analyze.
 * @returns {{supported: boolean, platform: string|null}} Detection result.
 */
export function detectLLM(urlString) {
  if (!urlString) {
    return { supported: false, platform: null };
  }

  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Direct and subdomain matching
    if (hostname === "chatgpt.com" || hostname.endsWith(".chatgpt.com")) {
      return { supported: true, platform: SUPPORTED_LLMS.CHATGPT.id };
    }
    if (hostname === "gemini.google.com" || hostname.endsWith(".gemini.google.com")) {
      return { supported: true, platform: SUPPORTED_LLMS.GEMINI.id };
    }
    if (hostname === "claude.ai" || hostname.endsWith(".claude.ai")) {
      return { supported: true, platform: SUPPORTED_LLMS.CLAUDE.id };
    }
  } catch (e) {
    // If invalid URL, handle gracefully (e.g. standard string fallback check)
    const lowerUrl = urlString.toLowerCase();
    if (lowerUrl.includes("chatgpt.com")) {
      return { supported: true, platform: SUPPORTED_LLMS.CHATGPT.id };
    }
    if (lowerUrl.includes("gemini.google.com")) {
      return { supported: true, platform: SUPPORTED_LLMS.GEMINI.id };
    }
    if (lowerUrl.includes("claude.ai")) {
      return { supported: true, platform: SUPPORTED_LLMS.CLAUDE.id };
    }
  }

  return { supported: false, platform: null };
}
