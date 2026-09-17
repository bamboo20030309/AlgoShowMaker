const test = require('node:test');
const assert = require('node:assert/strict');
const SlideStorage = require('../public/slides-storage');
const { IDBFactory } = require('fake-indexeddb');

function draft(label = 'initial') {
  return { groups: [{ id: 'g', slides: [{ id: 's', canvas: { label },
    animation: { traceDocument: { frames: [{ state: { arr: [1, 2] } }],
      studio: { zoom: 2 }, skins: {}, rules: [] } } }] }] };
}

function inspect(dbFactory, storeName) {
  return new Promise((resolve, reject) => {
    const request = dbFactory.open('algoshowmaker-drafts-v1', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName);
      const values = tx.objectStore(storeName).getAll();
      tx.oncomplete = () => { db.close(); resolve(values.result); };
      tx.onabort = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

test('large drafts bypass localStorage quota and restore complete trace', async () => {
  const db = new IDBFactory();
  const storage = memoryStorage({}, () => { throw quotaError(); });
  const client = SlideStorage.create(db, storage);
  const deck = draft();
  deck.groups[0].slides[0].animation.traceDocument.large = 'x'.repeat(6 * 1024 * 1024);
  await client.saveDeck('draft', JSON.stringify(deck));
  assert.deepEqual(await SlideStorage.create(db, storage).loadDeck('draft'), deck);
  assert.equal(storage.values.size, 0);
});

test('migration commits before removing legacy data and prefers IndexedDB afterwards', async () => {
  const db = new IDBFactory();
  const deck = draft();
  const storage = memoryStorage({ old: JSON.stringify(deck), unrelated: 'keep' });
  const client = SlideStorage.create(db, storage);
  assert.deepEqual(await client.loadDeck('draft', ['old']), deck);
  assert.equal(storage.getItem('old'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
  storage.setItem('old', JSON.stringify(draft('obsolete')));
  assert.deepEqual(await client.loadDeck('draft', ['old']), deck);
});

test('failed migration preserves the original localStorage draft', async () => {
  const deck = draft();
  const storage = memoryStorage({ old: JSON.stringify(deck) });
  const client = SlideStorage.create(null, storage);
  await assert.rejects(client.loadDeck('draft', ['old']), /IndexedDB/);
  assert.equal(storage.getItem('old'), JSON.stringify(deck));
});

test('ordered saves preserve the newest edit and reuse unchanged trace records', async () => {
  const db = new IDBFactory();
  const client = SlideStorage.create(db, memoryStorage());
  await Promise.all(['first', 'second', 'latest'].map(label =>
    client.saveDeck('draft', JSON.stringify(draft(label)))));
  assert.deepEqual(await client.loadDeck('draft'), draft('latest'));
  assert.equal((await inspect(db, 'traces')).length, 1);
  const changed = draft('changed');
  changed.groups[0].slides[0].animation.traceDocument.frames[0].state.arr = [3, 4];
  await client.saveDeck('draft', JSON.stringify(changed));
  assert.equal((await inspect(db, 'traces')).length, 1);
  assert.deepEqual(await client.loadDeck('draft'), changed);
});

test('aborted transaction preserves existing deck and a later save recovers', async () => {
  const db = new IDBFactory();
  const client = SlideStorage.create(db, memoryStorage());
  await client.saveDeck('draft', JSON.stringify(draft()));
  const open = await new Promise(resolve => {
    const request = db.open('algoshowmaker-drafts-v1');
    request.onsuccess = () => resolve(request.result);
  });
  const prototype = Object.getPrototypeOf(open.transaction('decks'));
  const original = prototype.objectStore;
  let fail = true;
  prototype.objectStore = function(name) {
    const store = original.call(this, name);
    if (fail && name === 'decks' && this.mode === 'readwrite') {
      fail = false;
      queueMicrotask(() => this.abort());
    }
    return store;
  };
  try {
    await assert.rejects(client.saveDeck('draft', JSON.stringify(draft('bad'))));
  } finally { prototype.objectStore = original; open.close(); }
  assert.deepEqual(await client.loadDeck('draft'), draft());
  await client.saveDeck('draft', JSON.stringify(draft('recovered')));
  assert.deepEqual(await client.loadDeck('draft'), draft('recovered'));
});

test('deleting and restoring a slide never references a collected trace', async () => {
  const db = new IDBFactory();
  const client = SlideStorage.create(db, memoryStorage());
  await client.saveDeck('draft', JSON.stringify(draft()));
  await client.saveDeck('draft', JSON.stringify({ groups: [] }));
  assert.equal((await inspect(db, 'traces')).length, 0);
  await client.saveDeck('draft', JSON.stringify(draft()));
  assert.deepEqual(await client.loadDeck('draft'), draft());
});

test('another tab cannot invalidate reused trace references', async () => {
  const db = new IDBFactory();
  const first = SlideStorage.create(db, memoryStorage());
  const second = SlideStorage.create(db, memoryStorage());
  await first.saveDeck('draft', JSON.stringify(draft()));
  await second.saveDeck('draft', JSON.stringify({ groups: [] }));
  await first.saveDeck('draft', JSON.stringify(draft('restored')));
  assert.deepEqual(await second.loadDeck('draft'), draft('restored'));
});

function quotaError() {
  const error = new Error('Storage quota exceeded');
  error.name = 'QuotaExceededError';
  return error;
}

test('content hashes deduplicate slides and decks without sharing presentation settings', async () => {
  const db = new IDBFactory();
  const client = SlideStorage.create(db, memoryStorage());
  const deck = draft();
  const second = JSON.parse(JSON.stringify(deck.groups[0].slides[0]));
  second.id = 'second';
  second.animation.traceDocument.studio.zoom = 5;
  deck.groups[0].slides.push(second);
  const before = JSON.stringify(deck);
  await client.saveDeck('one', before);
  await client.saveDeck('two', JSON.stringify(draft('other')));
  assert.equal(JSON.stringify(deck), before);
  assert.equal((await inspect(db, 'traces')).length, 1);
  const raw = (await inspect(db, 'decks'))[0];
  assert.match(raw.deck.groups[0].slides[0].animation.traceRef, /^[a-f0-9]{64}$/);
  assert.equal(raw.deck.groups[0].slides[0].animation.traceDocument, undefined);
  assert.deepEqual(await SlideStorage.create(db, memoryStorage()).loadDeck('one'), deck);
  await client.saveDeck('one', JSON.stringify({ groups: [] }));
  assert.equal((await inspect(db, 'traces')).length, 1);
  assert.deepEqual(await client.loadDeck('two'), draft('other'));
  await client.saveDeck('two', JSON.stringify({ groups: [] }));
  assert.equal((await inspect(db, 'traces')).length, 0);
});

test('cloud result delta restores all details and rejects missing or altered results', async () => {
  const first = await SlideStorage.project(draft());
  const changed = draft('camera edit');
  changed.groups[0].slides[0].animation.traceDocument.studio.zoom = 8;
  const second = await SlideStorage.project(changed);
  assert.deepEqual(Object.keys(first.traces), Object.keys(second.traces));
  second.traces = {};
  const merged = await SlideStorage.merge(second, first);
  assert.deepEqual(SlideStorage.hydrate(merged), changed);
  await assert.rejects(SlideStorage.merge(second), /缺少/);
  const corrupted = JSON.parse(JSON.stringify(first));
  Object.values(corrupted.traces)[0].frames[0].state.arr = [99];
  await assert.rejects(SlideStorage.merge(corrupted), /雜湊/);
  assert.deepEqual(SlideStorage.hydrate(first), draft());
});

test('trace hash ignores object property order but not execution data', async () => {
  const first = draft();
  const reordered = draft();
  reordered.groups[0].slides[0].animation.traceDocument = {
    rules: [], skins: {}, studio: { zoom: 2 }, frames: [{ state: { arr: [1, 2] } }]
  };
  assert.deepEqual(Object.keys((await SlideStorage.project(first)).traces),
    Object.keys((await SlideStorage.project(reordered)).traces));
  const incomplete = await SlideStorage.project(first);
  await assert.rejects(SlideStorage.project(incomplete.deck), /完整動畫/);
});

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
