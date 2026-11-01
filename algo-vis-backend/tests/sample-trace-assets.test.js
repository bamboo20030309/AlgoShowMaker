const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { filenameFor, createLoader } = require('../public/sample-trace-assets');
const { registerSampleTraceRoute } = require('../sample-trace-route');
const { registerDeckTraces } = require('../scripts/build/sample-trace-assets');

test('named sample lookup rejects path traversal and retains unknown legacy IDs', () => {
  const id = 'a'.repeat(64), other = 'b'.repeat(64);
  assert.equal(filenameFor({ traces: { [id]: { file: 'merge-sort-01.json' } } }, id), 'merge-sort-01.json');
  assert.equal(filenameFor({}, other), other + '.json');
  assert.throws(() => filenameFor({ traces: { [id]: { file: '../private.json' } } }, id));
  assert.throws(() => filenameFor({}, '../secret'));
});

test('loader shares its index, uses readable names and supports old deployments', async () => {
  const id = 'a'.repeat(64), calls = [];
  const load = createLoader(async url => {
    calls.push(url);
    return { ok: true, status: 200, json: async () => url.endsWith('/index.json')
      ? { schema: 1, traces: { [id]: { file: 'prefix-sum-01.json' } } } : { frames: [1] } };
  });
  assert.deepEqual(await load(id), { frames: [1] }); await load(id);
  assert.equal(calls.filter(url => url.endsWith('/index.json')).length, 1);
  assert.equal(calls[1], '/deck-traces/prefix-sum-01.json');
  const old = createLoader(async url => url.endsWith('/index.json') ? { status: 404 } : { ok: true, json: async () => ({ old: true }) });
  assert.deepEqual(await old(id), { old: true });
  const retry = createLoader(async () => ({ status: 503, ok: false }));
  await assert.rejects(retry(id), /503/); await assert.rejects(retry(id), /503/);
});

test('rebuilding a named sample preserves the previous result under its immutable ID', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-sample-trace-assets-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const entry = { archive: '/guest-decks/merge-sort.asmdeck' };
  const a = 'a'.repeat(64), b = 'b'.repeat(64);
  const deck = id => ({ groups: [{ slides: [{ id: 'animation', animation: { traceRef: id } }] }] });
  registerDeckTraces(root, entry, deck(a), [{ key: a, trace: { frames: [1] } }]);
  registerDeckTraces(root, entry, deck(b), [{ key: b, trace: { frames: [2] } }]);
  const directory = path.join(root, 'deck-traces');
  const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json')));
  assert.equal(index.traces[b].file, 'merge-sort-01.json');
  assert.equal(index.traces[a].legacy, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, index.traces[a].file))), { frames: [1] });
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(directory, index.traces[b].file))), { frames: [2] });
});

test('a cached index refreshes once when a named sample has been replaced', async () => {
  const id = 'a'.repeat(64), other = 'b'.repeat(64);
  let indexes = 0;
  const load = createLoader(async url => ({ ok: true, status: 200, json: async () => {
    if (url.endsWith('/index.json')) return { schema: 1, traces: { [id]: {
      file: ++indexes === 1 ? 'sample-01.json' : 'legacy/sample-previous-01.json'
    } } };
    return { id: url.includes('/legacy/') ? id : other };
  } }), { fingerprint: trace => trace.id });
  assert.equal((await load(id)).id, id);
  assert.equal(indexes, 2);
});

test('legacy public URLs redirect to named assets without exposing nonpublic files', async t => {
  const publicRoot = path.resolve(__dirname, '../public');
  const index = JSON.parse(fs.readFileSync(path.join(publicRoot, 'deck-traces/index.json')));
  const [id, record] = Object.entries(index.traces).find(([, value]) => value.legacy);
  const app = express(); registerSampleTraceRoute(app, publicRoot); app.use(express.static(publicRoot));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base + '/deck-traces/' + id + '.json', { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), '/deck-traces/' + record.file);
  const trace = await (await fetch(new URL(response.headers.get('location'), base))).json();
  assert.ok(trace.frames.length > 0);
  assert.equal((await fetch(base + '/deck-traces/' + '0'.repeat(64) + '.json')).status, 404);
});
