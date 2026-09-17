const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const SlideStorage = require('../public/slides-storage');

function routes(previous) {
  const handlers = {}, writes = [], queries = [];
  const app = { get(path, ...args) { handlers['GET ' + path] = args.at(-1); },
    put(path, ...args) { handlers['PUT ' + path] = args.at(-1); } };
  const SlideDeck = {
    findOne(query) {
      queries.push(query);
      return { lean: async () => previous,
        select: async () => previous };
    },
    findOneAndUpdate(query, update) {
      writes.push({ query, update });
      return { select: async () => ({ title: 'saved' }) };
    }
  };
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf('async function restoreSlideDeck('),
    source.indexOf("app.delete('/api/slides/:deck_uid'")), {
    app, SlideDeck, SlideStorage, authenticateToken() {},
    cleanDeckTitle: value => value, countDeckSlides: deck => deck.groups.flatMap(g => g.slides).length,
    cleanCoverThumbnail: value => value, console: { error() {} }
  });
  async function invoke(path, body = {}) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; } };
    await handlers[path]({ body, params: { deck_uid: 'owned', share_token: 'edit' },
      user: { id: 'owner' } }, response);
    return response;
  }
  return { invoke, writes, queries };
}

test('owner and shared saves retain durable results without rewriting unchanged traces', async () => {
  const original = { groups: [{ slides: [{ animation: { code: 'code', input: '',
    traceDocument: { frames: [{ state: { arr: [1] } }], studio: { zoom: 2 } } } }] }] };
  const stored = await SlideStorage.project(original);
  const previous = { deck: stored.deck, trace_references: stored.references,
    trace_results: stored.traces, updated_at: new Date(1) };
  const edited = JSON.parse(JSON.stringify(original));
  edited.groups[0].slides[0].animation.traceDocument.studio.zoom = 3;
  const projected = await SlideStorage.project(edited);
  for (const path of ['PUT /api/slides/:deck_uid', 'PUT /api/shared-slides/:share_token']) {
    const harness = routes(previous);
    const response = await harness.invoke(path, { deck: projected.deck,
      trace_storage: { references: projected.references, traces: {} } });
    assert.equal(response.statusCode, 200);
    const { query, update } = harness.writes[0];
    assert.equal(query.updated_at, previous.updated_at);
    assert.equal(query.user_uid || query.share_edit_token, path.includes('shared') ? 'edit' : 'owner');
    assert.equal(Object.keys(update.$set).some(key => key.startsWith('trace_results')), false);
    const restored = SlideStorage.hydrate({ deck: update.$set.deck,
      references: update.$set.trace_references, traces: previous.trace_results });
    assert.deepEqual(restored, edited);
  }
});

test('missing or forged cloud result never commits a deck', async () => {
  const projected = await SlideStorage.project({ groups: [{ slides: [{ animation: {
    traceDocument: { frames: [] } } }] }] });
  const harness = routes({ deck: { groups: [] }, updated_at: new Date(1) });
  const response = await harness.invoke('PUT /api/slides/:deck_uid', {
    deck: projected.deck, trace_storage: { references: projected.references, traces: {} }
  });
  assert.equal(response.statusCode, 400);
  assert.equal(harness.writes.length, 0);
});

test('cloud reads restore complete results for owner and authorized shared viewer', async () => {
  const deck = { groups: [{ slides: [{ animation: { traceDocument: { frames: [],
    studio: { events: { declare: true } } } } }] }] };
  const record = await SlideStorage.project(deck);
  for (const path of ['GET /api/slides/:deck_uid', 'GET /api/shared-slides/:share_token']) {
    const harness = routes({ deck: record.deck, trace_references: record.references,
      trace_results: record.traces, share_edit_token: 'edit', share_mode: 'edit' });
    const response = await harness.invoke(path);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.slide.deck, deck);
    assert.deepEqual(Array.from(response.body.slide.trace_keys), Object.keys(record.traces));
  }
});

test('public HTTP uses the archive SHA-256 fallback for durable trace references', async () => {
  const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, Uint32Array,
    ArrayBuffer, DataView, console });
  vm.runInContext(fs.readFileSync(require.resolve('../public/asmdeck.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../public/slides-storage.js'), 'utf8'), context);
  const source = { groups: [{ slides: [{ animation: { traceDocument: { frames: [] } } }] }] };
  const browser = await context.ASMSlideStorage.project(source);
  const node = await SlideStorage.project(source);
  assert.deepEqual(Object.keys(browser.traces), Object.keys(node.traces));
});
