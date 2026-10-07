const test = require('node:test');
const assert = require('node:assert/strict');
const { IDBFactory } = require('fake-indexeddb');
const Storage = require('../public/slides-storage');
const TraceStore = require('../public/slide-trace-store');

const original = () => ({ groups: [{ slides: [{ animation: { mode: 'trace', camera: null,
  traceDocument: { frames: [{ state: { arr: [1, 2] } }],
    studio: { eventSettings: { autoFixedEnabled: false } },
    skins: { arr: { color: '#123456' } }, rules: [] } } }] }] });

test('legacy inline results migrate to IDs, survive lazy reopen and retain explicit view settings', async () => {
  const db = new IDBFactory(), client = Storage.create(db, null);
  const source = original(), traces = TraceStore.create(Storage, client);
  const deck = await traces.detachDeck(source, { upload: true });
  const animation = deck.groups[0].slides[0].animation;
  assert.equal(animation.traceDocument, undefined);
  assert.match(animation.traceRef, /^[a-f0-9]{64}$/);
  await client.saveDeck('local', JSON.stringify(deck), traces.retainedKeys());
  const reopened = Storage.create(db, null);
  let reads = 0;
  const read = reopened.loadTrace;
  reopened.loadTrace = key => { reads++; return read(key); };
  const lazy = await reopened.loadDeck('local', [], { lazyTraces: true });
  assert.equal(reads, 0);
  const results = TraceStore.create(Storage, reopened);
  assert.deepEqual(await results.materializeDeck(lazy), source);
  assert.equal(reads, 1);
  await results.materializeAnimation(lazy.groups[0].slides[0].animation);
  assert.equal(reads, 1, 'navigation reuses a loaded result');
  assert.deepEqual(source, original(), 'migration does not mutate the original');
});

test('metadata saves and undo retain IDs without reading traces; recompiled results have a new ID', async () => {
  const client = Storage.create(new IDBFactory(), null), traces = TraceStore.create(Storage, client);
  const deck = await traces.detachDeck(original());
  const old = deck.groups[0].slides[0].animation.traceRef;
  const removed = { groups: [{ slides: [] }] };
  await client.saveDeck('local', JSON.stringify(removed), traces.retainedKeys());
  const changed = original(); changed.groups[0].slides[0].animation.traceDocument.frames[0].state.arr[0] = 3;
  const latest = await traces.detachDeck(changed);
  assert.notEqual(latest.groups[0].slides[0].animation.traceRef, old);
  await client.saveDeck('local', JSON.stringify(latest), traces.retainedKeys());
  await client.saveDeck('local', JSON.stringify(deck), traces.retainedKeys());
  assert.deepEqual((await traces.materializeDeck(await client.loadDeck('local', [], { lazyTraces: true }))), original());
  const edited = JSON.parse(JSON.stringify(deck)); edited.title = 'new title';
  const projected = await Storage.project(edited);
  assert.equal(Object.keys(projected.traces).length, 0);
  assert.equal(projected.references[0].key, old);
});

test('cloud reference fetch is on demand, coalesced, hash checked and locally cached', async () => {
  const projected = await Storage.project(original());
  const key = projected.references[0].key;
  const deck = projected.deck;
  deck.groups[0].slides[0].animation.traceView = projected.references[0].view;
  const client = Storage.create(new IDBFactory(), null);
  let fetches = 0;
  const traces = TraceStore.create(Storage, client, async id => {
    fetches++; assert.equal(id, key); return projected.traces[key];
  });
  await traces.detachDeck(deck);
  await client.saveDeck('remote', JSON.stringify(deck), traces.retainedKeys(), { allowMissingTraces: true });
  assert.equal(fetches, 0);
  await Promise.all([traces.materializeDeck(deck), traces.materializeDeck(deck)]);
  assert.equal(fetches, 1);
  const local = TraceStore.create(Storage, client, () => { throw Error('should use cache'); });
  assert.deepEqual(await local.materializeDeck(deck), original());
  await assert.rejects(client.putTrace(key, { frames: [] }), /驗證|不一致|雜湊/);
});

test('an unrelated metadata save cannot collect a newly staged animation in another tab', async () => {
  const db = new IDBFactory(), first = Storage.create(db, null), other = Storage.create(db, null);
  const staged = await TraceStore.create(Storage, other).detachDeck(original());
  await first.saveDeck('unrelated', JSON.stringify({ groups: [] }));
  await other.saveDeck('import', JSON.stringify(staged));
  assert.ok(await other.loadTrace(staged.groups[0].slides[0].animation.traceRef));
});

test('missing IDs recover once per revision and the replacement survives save/reopen', async () => {
  const db = new IDBFactory(), client = Storage.create(db, null);
  const animation = { code: 'saved source', input: '7', traceRef: 'a'.repeat(64),
    traceView: { studio: { eventSettings: { autoFixedEnabled: false }, codePanelFontSize: 19 } } };
  let runs = 0;
  const traces = TraceStore.create(Storage, client, async () => {
    throw Object.assign(Error('404'), { code: 'TRACE_NOT_FOUND' });
  }, async saved => {
    runs++;
    const result = { ...saved, traceDocument: { frames: [{ id: 'new' }], ...saved.traceView } };
    const detached = await traces.detachDeck({ groups: [{ slides: [{ animation: result }] }] }, { upload: true });
    Object.assign(saved, detached.groups[0].slides[0].animation);
    return result;
  });
  const [first, second] = await Promise.all([traces.materializeAnimation(animation), traces.materializeAnimation(animation)]);
  assert.equal(runs, 1); assert.deepEqual(first, second);
  assert.notEqual(animation.traceRef, 'a'.repeat(64));
  const deck = { groups: [{ slides: [{ animation }] }] };
  await client.saveDeck('recovered', JSON.stringify(deck), traces.retainedKeys());
  const reopened = Storage.create(db, null);
  const loaded = await TraceStore.create(Storage, reopened).materializeDeck(await reopened.loadDeck('recovered', [], { lazyTraces: true }));
  assert.equal(loaded.groups[0].slides[0].animation.traceDocument.studio.eventSettings.autoFixedEnabled, false);
  assert.equal(loaded.groups[0].slides[0].animation.traceDocument.studio.codePanelFontSize, 19);
  assert.equal(Object.keys(await traces.uploadTraces([{ key: animation.traceRef }])).length, 1);
});

test('permission/network errors never compile; failed recovery does not loop on navigation', async () => {
  const client = Storage.create(new IDBFactory(), null);
  const animation = { code: 'bad source', traceRef: 'b'.repeat(64) };
  let runs = 0;
  for (const failure of [Error('network'), Object.assign(Error('403'), { code: 'TRACE_LOAD_FAILED' })]) {
    const traces = TraceStore.create(Storage, client, async () => { throw failure; }, async () => { runs++; });
    await assert.rejects(traces.materializeAnimation(animation));
  }
  assert.equal(runs, 0);
  const missing = TraceStore.create(Storage, client, null, async () => { runs++; throw Error('compile failed'); });
  await assert.rejects(missing.materializeAnimation(animation), /compile failed/);
  await assert.rejects(missing.materializeAnimation(animation), /compile failed/);
  assert.equal(runs, 1);
});
