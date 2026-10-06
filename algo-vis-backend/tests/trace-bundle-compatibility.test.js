'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { gzipSync } = require('node:zlib');
global.ASMTraceProvenance = require('../public/trace-provenance');
global.ASMDeck = require('../public/asmdeck');
const bundle = require('../public/trace-bundle');
const { createHash } = require('node:crypto');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/default-animation/manifest.json')));

test('stored older default preview/full traces remain readable and round-trip through IndexedDB', async () => {
  global.indexedDB = require('fake-indexeddb').indexedDB;
  bundle.validateManifest(manifest);
  const read = (descriptor, kind) => bundle.decode(new Blob([fs.readFileSync(path.join(__dirname, '../public', descriptor.url))]), descriptor, manifest, kind);
  const preview = await read(manifest.preview, 'preview');
  const full = await read(manifest.full, 'full');
  assert.equal(preview.animation.traceDocument.frames.length, 1);
  assert.equal(full.animation.traceDocument.frames.length, manifest.totalFrames);
  assert.equal(await bundle.cachePut(manifest, full), true);
  assert.deepEqual(await bundle.cacheGet(manifest), full);
  // Explicit old producer fixture stays useful even after official assets are rebuilt.
  const old = JSON.parse(JSON.stringify(full));
  old.engineVersion = `${global.ASMTraceProvenance.ENGINE_VERSION - 1}/1`;
  old.animation.traceDocument.provenance.engineVersion -= 1;
  old.animation.traceDocument.studio.eventSettings.autoFixedEnabled = false;
  const text = JSON.stringify(old), bytes = Buffer.concat([Buffer.from(bundle.MAGIC), gzipSync(text)]);
  const descriptor = { ...manifest.full, bytes: bytes.length, contentHash: createHash('sha256').update(text).digest('hex') };
  const oldManifest = { ...manifest, engineVersion: old.engineVersion, full: descriptor };
  bundle.validateManifest(oldManifest);
  const decodedOld = await bundle.decode(new Blob([bytes]), descriptor, oldManifest, 'full');
  assert.equal(await bundle.cachePut(oldManifest, decodedOld), true);
  assert.deepEqual(await bundle.cacheGet(oldManifest), decodedOld);
  assert.equal(decodedOld.animation.traceDocument.studio.eventSettings.autoFixedEnabled, false);
  delete global.indexedDB;
});
test('newer producers, missing/future formats, and changed code cannot reuse an old trace', async () => {
  const current = global.ASMTraceProvenance;
  for (const version of [`${current.ENGINE_VERSION + 1}/1`, `${current.ENGINE_VERSION}/2`, '0/1', undefined])
    assert.throws(() => bundle.validateManifest({ ...manifest, engineVersion: version }), /不相容/);
  const full = await bundle.decode(new Blob([fs.readFileSync(path.join(__dirname, '../public', manifest.full.url))]), manifest.full, manifest, 'full');
  full.animation.code += '\nint dirty = 1;';
  const json = JSON.stringify(full), bytes = Buffer.concat([Buffer.from(bundle.MAGIC), gzipSync(json)]);
  const descriptor = { ...manifest.full, bytes: bytes.length, contentHash: createHash('sha256').update(json).digest('hex') };
  await assert.rejects(() => bundle.decode(new Blob([bytes]), descriptor, manifest, 'full'), /程式碼版本不一致/);
});
