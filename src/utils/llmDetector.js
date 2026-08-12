/**
 * LLM Detector Utility
 * Centrally defines supported platforms and matches URLs securely based on hostnames.
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
 * Ensures strict hostname-based matching to prevent false positives (e.g. example.com/chatgpt.com).
 * @param {string} urlString - The URL to analyze.
 * @returns {{supported: boolean, platform: string|null}} Detection result.
 */
export function detectLLM(urlString) {
  if (!urlString) {
    return { supported: false, platform: null };
  }

  try {
    const url = new URL(urlString);

    // Only support http and https protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { supported: false, platform: null };
    }

    const hostname = url.hostname.toLowerCase();

    // Direct match or subdomain matching for chatgpt.com
    if (hostname === "chatgpt.com" || hostname.endsWith(".chatgpt.com")) {
      return { supported: true, platform: SUPPORTED_LLMS.CHATGPT.id };
    }
    // Direct match or subdomain matching for gemini.google.com
    if (hostname === "gemini.google.com" || hostname.endsWith(".gemini.google.com")) {
      return { supported: true, platform: SUPPORTED_LLMS.GEMINI.id };
    }
    // Direct match or subdomain matching for claude.ai
    if (hostname === "claude.ai" || hostname.endsWith(".claude.ai")) {
      return { supported: true, platform: SUPPORTED_LLMS.CLAUDE.id };
    }
  } catch (e) {
    // If URL parsing fails, we return unsupported to prevent false positives
    return { supported: false, platform: null };
  }

  return { supported: false, platform: null };
}
