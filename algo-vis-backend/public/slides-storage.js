(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideStorage = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  function isQuotaExceeded(error) {
    if (!error) return false;
    return error.name === 'QuotaExceededError'
      || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      || Number(error.code) === 22
      || Number(error.code) === 1014;
  }

  function hasStoredValue(storage, key) {
    if (!storage || !key) return false;
    return storage.getItem(key) !== null;
  }

  function removeLegacyValue(storage, storageKey, legacyKey) {
    if (!legacyKey || legacyKey === storageKey || !hasStoredValue(storage, legacyKey)) return false;
    storage.removeItem(legacyKey);
    return true;
  }

  function save(storage, {
    storageKey,
    legacyKey,
    serializedDeck
  } = {}) {
    const result = {
      saved: false,
      recoveredFromQuota: false,
      removedLegacy: false,
      error: null
    };
    if (!storage || !storageKey || typeof serializedDeck !== 'string') {
      result.error = new TypeError('Invalid slide storage request');
      return result;
    }

    try {
      storage.setItem(storageKey, serializedDeck);
      result.saved = true;
    } catch (error) {
      result.error = error;
      if (!isQuotaExceeded(error)) return result;
      try {
        result.removedLegacy = removeLegacyValue(storage, storageKey, legacyKey);
        if (!result.removedLegacy) return result;
        storage.setItem(storageKey, serializedDeck);
        result.saved = true;
        result.recoveredFromQuota = true;
        result.error = null;
      } catch (retryError) {
        result.error = retryError;
        return result;
      }
    }

    if (result.saved && !result.removedLegacy) {
      try {
        result.removedLegacy = removeLegacyValue(storage, storageKey, legacyKey);
      } catch (cleanupError) {
        // The current deck is already safe. Legacy cleanup can be retried on the next save.
      }
    }
    return result;
  }

  return { isQuotaExceeded, save };
});
