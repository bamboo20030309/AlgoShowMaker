const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, hash } = require('../cloud-content');
const Cloud = require('../public/slides-cloud');
const Storage = require('../public/slides-storage');

function fixture() {
  const decks = new Map([['owned', { deck_uid: 'owned', user_uid: 'owner', deck: { groups: [] },
    updated_at: new Date(1), resource_keys: [] }]]), rows = [];
  let failCommit = false, uploads = 0, failPart = false, requests = [];
  const store = createStore({
    parts: async (id, key) => rows.filter(row => row.id === id && row.key === key).sort((a, b) => a.part - b.part),
    usage: async id => rows.filter(row => row.id === id).reduce((sum, row) => sum + Buffer.byteLength(row.data), 0),
    put: async (id, key, part, total, data) => {
      if (!rows.some(row => row.id === id && row.key === key && row.part === part))
        rows.push({ id, key, part, total, data, touched_at: new Date() });
    },
    pin: async () => {},
    deck: async query => {
      const deck = decks.get(query.deck_uid);
      return deck && (!query.user_uid || query.user_uid === deck.user_uid) ? { ...deck } : null;
    },
    commit: async (query, updates) => {
      if (failCommit) return null;
      const old = decks.get(query.deck_uid);
      if (old.updated_at !== query.updated_at) return null;
      const saved = { ...old, ...updates }; decks.set(query.deck_uid, saved); return saved;
    },
    remove: async (id, keys) => {
      for (let index = rows.length - 1; index >= 0; index--)
        if (rows[index].id === id && keys.includes(rows[index].key)) rows.splice(index, 1);
    },
    staleDecks: async () => [...new Set(rows.map(row => row.id))],
    sweep: async (id, keys, cutoff) => {
      for (let index = rows.length - 1; index >= 0; index--)
        if (rows[index].id === id && !keys.includes(rows[index].key) && rows[index].touched_at < cutoff) rows.splice(index, 1);
    }
  });
  const fetch = async (url, options) => {
    requests.push({ url, body: options.body });
    try {
      const match = url.match(/resources\/([a-f0-9]+)(?:\/(\d+))?$/);
      let data;
      if (match && options.method === 'GET') {
        const parts = rows.filter(row => row.id === 'owned' && row.key === match[1]);
        data = { parts: parts.map(row => row.part), total: parts[0]?.total };
      } else if (match) {
        uploads++;
        if (failPart && uploads === 3) throw Object.assign(new Error('interrupted'), { status: 503 });
        const body = JSON.parse(options.body);
        await store.put('owned', match[1], Number(match[2]), body.total, body.data);
        data = { success: true };
      } else {
        const body = JSON.parse(options.body);
        data = await store.commit('owned', { deck_uid: 'owned', user_uid: 'owner' }, body.snapshot, { title: body.title });
      }
      return { ok: true, json: async () => data };
    } catch (error) { return { ok: false, status: error.status || 500, json: async () => ({ error: error.message }) }; }
  };
  return { store, rows, decks, requests, fetch, uploads: () => uploads,
    interrupt: value => { failPart = value; }, conflict: value => { failCommit = value; } };
}
const deck = value => ({ groups: [{ slides: [{ canvas: { objects: [{ src: 'data:image/png;base64,AAAA' }] },
  animation: { code: 'cpp', input: '6', traceDocument: {
    sourceCode: 'cpp', frames: [{ state: { arr: [value] } }], studio: { zoom: 2 }
  } } }] }] });
const options = f => ({ endpoint: '/api/slides/owned', fetch: f.fetch, storage: Storage, headers: {}, title: 'test' });

test('large cloud save splits every request, restores exactly and never mutates the loaded deck', async () => {
  const f = fixture(), source = deck('large'.repeat(1800000)), original = JSON.stringify(source);
  await Cloud.save(source, options(f));
  assert.equal(JSON.stringify(source), original);
  const saved = f.decks.get('owned');
  assert.ok(JSON.stringify(saved).length < 10000, 'Mongo deck only holds a small manifest reference');
  assert.deepEqual((await f.store.snapshot('owned', saved.cloud_snapshot)).deck, source);
  assert.ok(f.requests.every(request => !request.body || Buffer.byteLength(request.body) < 8 * 1024 * 1024));
  const uploads = f.uploads();
  await Cloud.save(source, options(f));
  assert.equal(f.uploads(), uploads, 'already uploaded chunks are reused');
});
test('failed upload/commit retains old playable result; successful replacement removes only unreferenced results', async () => {
  const f = fixture(), first = deck(1);
  await Cloud.save(first, options(f));
  const old = f.decks.get('owned'), oldKeys = old.resource_keys.slice();
  f.conflict(true);
  await assert.rejects(Cloud.save(deck(2), options(f)), /其他頁面/);
  assert.equal(f.decks.get('owned'), old);
  assert.deepEqual((await f.store.snapshot('owned', old.cloud_snapshot)).deck, first);
  f.conflict(false);
  const second = deck(2);
  second.groups[0].slides.push(first.groups[0].slides[0]);
  await Cloud.save(second, options(f));
  assert.deepEqual((await f.store.snapshot('owned', f.decks.get('owned').cloud_snapshot)).deck, second);
  await Cloud.save(deck(3), options(f));
  const current = f.decks.get('owned');
  assert.ok(oldKeys.filter(key => !current.resource_keys.includes(key)).every(key => !f.rows.some(row => row.key === key)));
});
test('interrupted upload resumes missing chunks without committing an empty deck', async () => {
  const f = fixture(), source = deck('x'.repeat(2000000));
  f.interrupt(true);
  await assert.rejects(Cloud.save(source, options(f)), /interrupted/);
  assert.equal(f.decks.get('owned').cloud_snapshot, undefined);
  const uploaded = f.rows.length;
  f.interrupt(false);
  await Cloud.save(source, options(f));
  assert.equal(f.uploads(), f.rows.length + 1, 'one failed request, successful chunks not retransmitted');
  assert.ok(uploaded > 0);
});
test('resource validation rejects missing, forged, conflicting or cross-deck resources', async () => {
  const f = fixture(), text = JSON.stringify({ frames: [] }), key = hash(text);
  await f.store.put('owned', key, 0, 1, text);
  await assert.rejects(f.store.read('other', key), /完整上傳/);
  await assert.rejects(f.store.put('owned', key, 0, 1, 'changed'), /衝突/);
  await f.store.put('owned', 'a'.repeat(64), 0, 1, text);
  await assert.rejects(f.store.read('owned', 'a'.repeat(64)), /雜湊/);
  await assert.rejects(f.store.put('owned', key, -1, 1, text), /格式/);
});
test('stale upload sweep preserves currently referenced results and removes orphaned history', async () => {
  const f = fixture();
  await Cloud.save(deck(1), options(f));
  const text = JSON.stringify('orphan'), key = hash(text);
  await f.store.put('owned', key, 0, 1, text);
  f.rows.forEach(row => { row.touched_at = new Date(0); });
  await f.store.sweep();
  assert.equal(f.rows.some(row => row.key === key), false);
  assert.deepEqual((await f.store.snapshot('owned', f.decks.get('owned').cloud_snapshot)).deck, deck(1));
});
test('reading a previously captured deck after replacement uses the current snapshot, not deleted history', async () => {
  const f = fixture();
  await Cloud.save(deck(1), options(f));
  const captured = f.decks.get('owned');
  await Cloud.save(deck(2), options(f));
  assert.notEqual(captured.cloud_snapshot, f.decks.get('owned').cloud_snapshot);
  assert.deepEqual((await f.store.currentSnapshot(captured.deck_uid)).deck, deck(2));
});
test('chunk boundaries preserve Unicode surrogate pairs and escaped JSON stays under request limit', () => {
  const text = 'x'.repeat(256 * 1024 - 1) + '😀' + '\n'.repeat(800000);
  const parts = Cloud.chunks(text);
  assert.equal(parts.join(''), text);
  for (const data of parts) assert.ok(Buffer.byteLength(JSON.stringify({ data, total: parts.length })) < 8 * 1024 * 1024);
});
