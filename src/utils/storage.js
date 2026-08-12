/**
 * Storage Utility
 * Wraps chrome.storage.local with a clean, centralized abstraction.
 * Includes a fallback mock for non-extension environments (e.g. testing, popup preview).
 */

const isChromeExtension = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;

// In-memory mock storage for fallback environments
const mockStorage = {
  data: {},
  get(keys) {
    if (!keys) {
      return Promise.resolve({ ...this.data });
    }
    if (typeof keys === "string") {
      return Promise.resolve({ [keys]: this.data[keys] });
    }
    if (Array.isArray(keys)) {
      const res = {};
      keys.forEach(k => {
        res[k] = this.data[k];
      });
      return Promise.resolve(res);
    }
    if (typeof keys === "object") {
      const res = {};
      Object.keys(keys).forEach(k => {
        res[k] = this.data[k] !== undefined ? this.data[k] : keys[k];
      });
      return Promise.resolve(res);
    }
    return Promise.resolve({});
  },
  set(items) {
    Object.assign(this.data, items);
    return Promise.resolve();
  },
  remove(keys) {
    if (typeof keys === "string") {
      delete this.data[keys];
    } else if (Array.isArray(keys)) {
      keys.forEach(k => delete this.data[k]);
    }
    return Promise.resolve();
  },
  clear() {
    this.data = {};
    return Promise.resolve();
  }
};

/**
 * Gets data from storage.
 * @param {string|string[]|object|null} keys - Keys to retrieve, with optional defaults if an object.
 * @returns {Promise<object>} Map of key-value pairs.
 */
export function getData(keys = null) {
  if (isChromeExtension) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  } else {
    return mockStorage.get(keys);
  }
}

/**
 * Sets data in storage.
 * @param {object} items - Object containing key-value pairs to update.
 * @returns {Promise<void>}
 */
export function setData(items) {
  if (isChromeExtension) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(items, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } else {
    return mockStorage.set(items);
  }
}

/**
 * Removes keys from storage.
 * @param {string|string[]} keys - Key or list of keys to remove.
 * @returns {Promise<void>}
 */
export function removeData(keys) {
  if (isChromeExtension) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } else {
    return mockStorage.remove(keys);
  }
}

/**
 * Clears all data from local storage.
 * @returns {Promise<void>}
 */
export function clearData() {
  if (isChromeExtension) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  } else {
    return mockStorage.clear();
  }
}
export { mockStorage };
