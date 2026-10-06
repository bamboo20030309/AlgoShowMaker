'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  ArtifactCache,
  ArtifactCacheCapacityError,
  canonicalStringify,
  createExecutableKey,
  createTraceKey,
  sha256Canonical,
} = require('../artifact-cache');

const fsp = fs.promises;

async function temporaryCache(t, options = {}) {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'asm-artifact-cache-'));
  t.after(() => fsp.rm(directory, { recursive: true, force: true }));
  const cache = new ArtifactCache({ rootDir: directory, ...options });
  await cache.init();
  return { cache, directory };
}

test('canonical hashes are stable across object key order and reject ambiguous values', () => {
  assert.equal(canonicalStringify({ z: 1, a: { y: 2, x: 3 } }), '{"a":{"x":3,"y":2},"z":1}');
  assert.equal(sha256Canonical({ a: 1, b: 2 }), sha256Canonical({ b: 2, a: 1 }));
  assert.notEqual(sha256Canonical(['-O2', '-g']), sha256Canonical(['-g', '-O2']));
  assert.throws(() => canonicalStringify({ invalid: Number.NaN }), /finite numbers/);
  const circular = {};
  circular.self = circular;
  assert.throws(() => canonicalStringify(circular), /circular/);
});

test('executable key excludes input while covering source, compiler, flags and engine', () => {
  const base = {
    source: 'int main(){}',
    compiler: { path: '/usr/bin/g++', version: '14.2' },
    flags: ['-std=c++17', '-O2'],
    engine: { version: 'AV_V4.12', instrumentation: 3 },
  };
  const first = createExecutableKey({ ...base, input: '1 2 3' });
  const second = createExecutableKey({ ...base, input: 'different input' });
  assert.equal(first, second);
  for (const [field, changed] of [
    ['source', { ...base, source: 'int main(){return 1;}' }],
    ['compiler', { ...base, compiler: { path: '/usr/bin/g++', version: '15' } }],
    ['flags', { ...base, flags: ['-std=c++20', '-O2'] }],
    ['engine', { ...base, engine: { version: 'AV_V4.13', instrumentation: 3 } }],
  ]) {
    assert.notEqual(first, createExecutableKey(changed), field);
  }
});

test('trace key includes input, trace config, engine and executable identity', () => {
  const executableKey = createExecutableKey({ source: 'x', compiler: 'g++ 14', engine: 'v1' });
  const base = { executableKey, input: '7', traceConfig: { watches: ['a'], maxFrames: 100 }, engine: 'v1' };
  const first = createTraceKey(base);
  assert.notEqual(first, createTraceKey({ ...base, input: '8' }));
  assert.notEqual(first, createTraceKey({ ...base, traceConfig: { watches: ['b'], maxFrames: 100 } }));
  assert.notEqual(first, createTraceKey({ ...base, engine: 'v2' }));
});

test('put, lookup and read persist metadata and hit/miss/byte statistics', async (t) => {
  let now = 1000;
  const { cache, directory } = await temporaryCache(t, { now: () => now, maxBytes: 100 });
  const key = sha256Canonical('hello');
  const stored = await cache.put('trace', key, 'hello', {
    ttlMs: 500,
    metadata: { encoding: 'identity', label: 'sample' },
  });
  assert.equal(stored.size, 5);
  assert.ok(stored.path.startsWith(directory));
  assert.deepEqual(stored.metadata, { encoding: 'identity', label: 'sample' });

  now = 1100;
  const hit = await cache.read('trace', key);
  assert.equal(hit.data.toString(), 'hello');
  assert.equal(hit.lastAccessedAt, 1100);
  assert.equal(await cache.lookup('trace', '0'.repeat(64)), null);
  assert.deepEqual(
    { hits: cache.stats().hits, misses: cache.stats().misses, bytes: cache.stats().bytes },
    { hits: 1, misses: 1, bytes: 5 },
  );

  const reopened = new ArtifactCache({ rootDir: directory, now: () => now, maxBytes: 100 });
  await reopened.init();
  const persisted = await reopened.lookup('trace', key, { touch: false });
  assert.equal(persisted.size, 5);
  assert.equal(persisted.lastAccessedAt, 1100);
});

test('TTL removes disposable artifacts but never expires pinned official assets', async (t) => {
  let now = 0;
  const { cache } = await temporaryCache(t, { now: () => now, maxBytes: 10 });
  const expiringKey = sha256Canonical('temporary');
  const pinnedKey = sha256Canonical('official');
  await cache.put('trace', expiringKey, '1234', { ttlMs: 10 });
  await cache.put('trace', pinnedKey, 'official trace', { ttlMs: 10, pinned: true });

  now = 11;
  assert.equal(await cache.lookup('trace', expiringKey), null);
  assert.ok(await cache.lookup('trace', pinnedKey));
  assert.equal(cache.stats().expired, 1);
  assert.equal(cache.stats().pinnedArtifacts, 1);
});

test('putting identical bytes refreshes a disposable artifact TTL', async (t) => {
  let now = 0;
  const { cache } = await temporaryCache(t, { now: () => now, maxBytes: 100 });
  const key = sha256Canonical('queued request');
  await cache.put('trace', key, 'request', { ttlMs: 10 });
  now = 8;
  await cache.put('trace', key, 'request', { ttlMs: 10 });
  now = 12;
  assert.ok(await cache.lookup('trace', key));
  now = 19;
  assert.equal(await cache.lookup('trace', key), null);
});

test('LRU bounds disposable bytes and keeps recently touched and pinned entries', async (t) => {
  let now = 1;
  const { cache } = await temporaryCache(t, { now: () => now, maxBytes: 8, defaultTtlMs: 0 });
  const first = sha256Canonical('first');
  const second = sha256Canonical('second');
  const third = sha256Canonical('third');
  const pinned = sha256Canonical('pinned');
  await cache.put('trace', first, '1111');
  now = 2;
  await cache.put('trace', second, '2222');
  now = 3;
  await cache.lookup('trace', first);
  now = 4;
  await cache.put('trace', third, '3333');
  await cache.put('trace', pinned, 'pinned-is-outside-budget', { pinned: true });

  assert.ok(await cache.lookup('trace', first));
  assert.equal(await cache.lookup('trace', second), null);
  assert.ok(await cache.lookup('trace', third));
  assert.ok(await cache.lookup('trace', pinned));
  assert.equal(cache.stats().disposableBytes, 8);
  assert.ok(cache.stats().bytes > cache.stats().maxBytes, 'pinned bytes are reported but exempt from eviction');
});

test('oversized disposable artifacts are rejected while official pinned artifacts are accepted', async (t) => {
  const { cache } = await temporaryCache(t, { maxBytes: 3 });
  const disposable = sha256Canonical('large disposable');
  await assert.rejects(
    cache.put('executable', disposable, Buffer.alloc(4)),
    ArtifactCacheCapacityError,
  );
  const official = sha256Canonical('large official');
  const entry = await cache.put('trace', official, Buffer.alloc(20), { pinned: true });
  assert.equal(entry.size, 20);
  assert.equal(cache.stats().pinnedBytes, 20);
});

test('putFile atomically imports binary data and rejects traversal-shaped keys and types', async (t) => {
  const { cache, directory } = await temporaryCache(t, { maxBytes: 100 });
  const source = path.join(directory, 'compiled-program');
  await fsp.writeFile(source, Buffer.from([0, 1, 2, 255]));
  const key = sha256Canonical('binary');
  await cache.putFile('executable', key, source, { mode: 0o700 });
  assert.deepEqual((await cache.read('executable', key)).data, Buffer.from([0, 1, 2, 255]));

  await assert.rejects(cache.put('trace', '../escape', 'x'), /SHA-256/);
  await assert.rejects(cache.put('../trace', key, 'x'), /Unsupported artifact type/);
  assert.equal(fs.existsSync(path.resolve(directory, '..', 'escape.artifact')), false);
});

test('same content key cannot silently replace different bytes, even at the same size', async (t) => {
  const { cache } = await temporaryCache(t, { maxBytes: 100 });
  const key = sha256Canonical('immutable-address');
  await cache.put('trace', key, 'abc');
  await assert.rejects(cache.put('trace', key, 'xyz'), /different bytes/);
  assert.equal((await cache.read('trace', key)).data.toString(), 'abc');
});

test('normal removal protects pinned official assets unless explicitly forced', async (t) => {
  const { cache } = await temporaryCache(t, { maxBytes: 100 });
  const key = sha256Canonical('published official asset');
  await cache.put('trace', key, 'trace', { pinned: true });
  assert.equal(await cache.remove('trace', key), false);
  assert.ok(await cache.lookup('trace', key));
  assert.equal(await cache.remove('trace', key, { forcePinned: true }), true);
  assert.equal(await cache.lookup('trace', key), null);
});

test('an acquired executable is protected from LRU eviction until release', async (t) => {
  let now = 1;
  const { cache } = await temporaryCache(t, { maxBytes: 4, defaultTtlMs: 0, now: () => now });
  const executable = sha256Canonical('leased executable');
  const replacement = sha256Canonical('replacement executable');
  await cache.put('executable', executable, 'exec');
  const lease = await cache.acquire('executable', executable);
  assert.ok(lease);
  assert.equal(cache.stats().leasedArtifacts, 1);

  now = 2;
  await assert.rejects(
    cache.put('executable', replacement, 'next'),
    ArtifactCacheCapacityError,
  );
  assert.equal((await fsp.readFile(lease.entry.path)).toString(), 'exec');
  assert.equal(await lease.release(), true);
  assert.equal(await lease.release(), false, 'release is idempotent');
  assert.equal(cache.stats().leasedArtifacts, 0);
});
