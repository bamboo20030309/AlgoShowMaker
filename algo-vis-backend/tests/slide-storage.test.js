/**
 * 測試模組：slide-storage.test
 *
 * 驗證重點：slide storage.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const SlideStorage = require('../public/slides-storage');
const { IDBFactory } = require('fake-indexeddb');
const compact = source => require('../public/animation-recipe').deck(source);

function draft(label = 'initial') {
  return { groups: [{ id: 'g', slides: [{ id: 's', canvas: { label },
    animation: { code: 'int main(){}', traceDocument: { frames: [{ state: { arr: [1, 2] } }],
      studio: { zoom: 2 }, skins: {}, rules: [] } } }] }] };
}

function inspect(dbFactory, storeName) {
  return new Promise((resolve, reject) => {
    const request = dbFactory.open('algoshowmaker-drafts-v1', 2);
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

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('large drafts bypass localStorage quota and restore source and settings', async () => {
  const db = new IDBFactory();
  const storage = memoryStorage({}, () => { throw quotaError(); });
  const client = SlideStorage.create(db, storage);
  const deck = draft();
  deck.groups[0].slides[0].animation.traceDocument.large = 'x'.repeat(6 * 1024 * 1024);
  await client.saveDeck('draft', JSON.stringify(deck));
  assert.deepEqual(await SlideStorage.create(db, storage).loadDeck('draft'), compact(deck));
  assert.equal(storage.values.size, 0);
});

test('migration commits before removing legacy data and prefers IndexedDB afterwards', async () => {
  const db = new IDBFactory();
  const deck = draft();
  const storage = memoryStorage({ old: JSON.stringify(deck), unrelated: 'keep' });
  const client = SlideStorage.create(db, storage);
  assert.deepEqual(await client.loadDeck('draft', ['old']), compact(deck));
  assert.equal(storage.getItem('old'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
  storage.setItem('old', JSON.stringify(draft('obsolete')));
  assert.deepEqual(await client.loadDeck('draft', ['old']), compact(deck));
});

test('failed migration preserves the original localStorage draft', async () => {
  const deck = draft();
  const storage = memoryStorage({ old: JSON.stringify(deck) });
  const client = SlideStorage.create(null, storage);
  await assert.rejects(client.loadDeck('draft', ['old']), /IndexedDB/);
  assert.equal(storage.getItem('old'), JSON.stringify(deck));
});

test('ordered saves preserve the newest edit and persist no trace records', async () => {
  const db = new IDBFactory();
  const client = SlideStorage.create(db, memoryStorage());
  await Promise.all(['first', 'second', 'latest'].map(label =>
    client.saveDeck('draft', JSON.stringify(draft(label)))));
  assert.deepEqual(await client.loadDeck('draft'), compact(draft('latest')));
  assert.equal((await inspect(db, 'traces')).length, 0);
  const changed = draft('changed');
  changed.groups[0].slides[0].animation.traceDocument.frames[0].state.arr = [3, 4];
  await client.saveDeck('draft', JSON.stringify(changed));
  assert.equal((await inspect(db, 'traces')).length, 0);
  assert.deepEqual(await client.loadDeck('draft'), compact(changed));
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
  assert.deepEqual(await client.loadDeck('draft'), compact(draft()));
  await client.saveDeck('draft', JSON.stringify(draft('recovered')));
  assert.deepEqual(await client.loadDeck('draft'), compact(draft('recovered')));
});

test('deleting and restoring a slide never references a collected trace', async () => {
  const db = new IDBFactory();
  const client = SlideStorage.create(db, memoryStorage());
  await client.saveDeck('draft', JSON.stringify(draft()));
  await client.saveDeck('draft', JSON.stringify({ groups: [] }));
  assert.equal((await inspect(db, 'traces')).length, 0);
  await client.saveDeck('draft', JSON.stringify(draft()));
  assert.deepEqual(await client.loadDeck('draft'), compact(draft()));
});

test('another tab cannot invalidate reused trace references', async () => {
  const db = new IDBFactory();
  const first = SlideStorage.create(db, memoryStorage());
  const second = SlideStorage.create(db, memoryStorage());
  await first.saveDeck('draft', JSON.stringify(draft()));
  await second.saveDeck('draft', JSON.stringify({ groups: [] }));
  await first.saveDeck('draft', JSON.stringify(draft('restored')));
  assert.deepEqual(await second.loadDeck('draft'), compact(draft('restored')));
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
  assert.equal((await inspect(db, 'traces')).length, 0);
  const raw = (await inspect(db, 'decks'))[0];
  assert.equal(raw.deck.groups[0].slides[0].animation.traceRef, undefined);
  assert.equal(raw.deck.groups[0].slides[0].animation.traceDocument, undefined);
  assert.deepEqual(await SlideStorage.create(db, memoryStorage()).loadDeck('one'), compact(deck));
  await client.saveDeck('one', JSON.stringify({ groups: [] }));
  assert.equal((await inspect(db, 'traces')).length, 0);
  assert.deepEqual(await client.loadDeck('two'), compact(draft('other')));
  await client.saveDeck('two', JSON.stringify({ groups: [] }));
  assert.equal((await inspect(db, 'traces')).length, 0);
});

test('cloud recipe merge keeps presentation settings without requiring old result payloads', async () => {
  const changed=draft('camera edit');changed.groups[0].slides[0].animation.traceDocument.studio.zoom=8;
  const projected=await SlideStorage.project(changed);assert.deepEqual(projected.traces,{});
  assert.deepEqual(SlideStorage.hydrate(await SlideStorage.merge(projected)),compact(changed));
  assert.equal(SlideStorage.hydrate(projected).groups[0].slides[0].animation.traceView.studio.zoom,8);
});
test('runtime hashes validate execution data while result-free drafts remain saveable', async () => {
  const client=SlideStorage.create(new IDBFactory(),memoryStorage()),trace={frames:[{state:{arr:[1,2]}}]};
  const key=await SlideStorage.digest(SlideStorage.canonical(trace));
  await client.putTrace(key,trace);await assert.rejects(client.putTrace(key,{frames:[]}),/hash/i);
  await client.saveDeck('empty-result',JSON.stringify((await SlideStorage.project(draft())).deck));
  assert.equal((await client.loadDeck('empty-result')).groups[0].slides[0].animation.traceRef,undefined);
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


test('deleting an obsolete sample removes only that draft, preserving other drafts and other decks',async()=>{
 const db=new IDBFactory(),legacy=memoryStorage(),client=SlideStorage.create(db,legacy);
 await client.saveDeck('sample',JSON.stringify(draft('sample')));await client.saveDeck('project',JSON.stringify(draft('project')));legacy.setItem('sample','old fallback');
 await client.deleteDeck('sample');assert.equal(await client.loadDeck('sample'),null);assert.equal(legacy.getItem('sample'),null);assert.deepEqual(await client.loadDeck('project'),compact(draft('project')));assert.equal((await inspect(db,'traces')).length,0);
});
