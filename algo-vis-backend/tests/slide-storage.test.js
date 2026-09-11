const test = require('node:test');
const assert = require('node:assert/strict');
const SlideStorage = require('../public/slides-storage');

function quotaError() {
  const error = new Error('Storage quota exceeded');
  error.name = 'QuotaExceededError';
  return error;
}

function memoryStorage(initial = {}, beforeSet = null) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      beforeSet?.(key, value, values);
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    }
  };
}

test('slide storage writes the current deck before removing a legacy draft', () => {
  const storage = memoryStorage({ legacy: 'old deck', unrelated: 'keep me' });
  const result = SlideStorage.save(storage, {
    storageKey: 'current',
    legacyKey: 'legacy',
    serializedDeck: '{"groups":[]}'
  });

  assert.equal(result.saved, true);
  assert.equal(result.removedLegacy, true);
  assert.equal(storage.getItem('current'), '{"groups":[]}');
  assert.equal(storage.getItem('legacy'), null);
  assert.equal(storage.getItem('unrelated'), 'keep me');
});

test('slide storage frees the legacy draft and retries after a quota failure', () => {
  let attempts = 0;
  const storage = memoryStorage({ legacy: 'large old deck' }, () => {
    attempts += 1;
    if (attempts === 1) throw quotaError();
  });
  const result = SlideStorage.save(storage, {
    storageKey: 'current',
    legacyKey: 'legacy',
    serializedDeck: '{"groups":[{"slides":[{}]}]}'
  });

  assert.equal(attempts, 2);
  assert.equal(result.saved, true);
  assert.equal(result.recoveredFromQuota, true);
  assert.equal(result.removedLegacy, true);
  assert.equal(storage.getItem('legacy'), null);
  assert.equal(storage.getItem('current'), '{"groups":[{"slides":[{}]}]}');
});

test('an unrecoverable local quota failure is reported without throwing', () => {
  const storage = memoryStorage({}, () => {
    throw quotaError();
  });
  const result = SlideStorage.save(storage, {
    storageKey: 'current',
    legacyKey: 'legacy',
    serializedDeck: '{"groups":[]}'
  });

  assert.equal(result.saved, false);
  assert.equal(result.recoveredFromQuota, false);
  assert.equal(result.error?.name, 'QuotaExceededError');
});
