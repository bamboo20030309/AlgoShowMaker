/**
 * 驗證預設演算法的獨立預覽／完整 Trace 資產及其建置接線。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { readPackage, savedTrace } = require('./helpers/deck-package');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
global.ASMTraceProvenance = require('../public/trace-provenance.js');
global.ASMDeck = require('../public/asmdeck.js');
const traceBundle = require('../public/trace-bundle.js');

test('standalone linear-sieve assets contain one preview frame and the complete verified trace', async () => {
  const directory = path.join(publicRoot, 'default-animation');
  const manifest = traceBundle.validateManifest(JSON.parse(
    fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')
  ));
  const decode = async (name, descriptor, kind) => traceBundle.decode(
    new Blob([fs.readFileSync(path.join(directory, name))]), descriptor, manifest, kind
  );
  const preview = await decode(path.basename(manifest.preview.url), manifest.preview, 'preview');
  const full = await decode(path.basename(manifest.full.url), manifest.full, 'full');

  assert.equal(manifest.totalFrames, 116);
  assert.equal(preview.animation.traceDocument.frames.length, 1);
  assert.equal(full.animation.traceDocument.frames.length, 116);
  assert.equal(preview.animation.code, full.animation.code);
  assert.equal(preview.animation.input, '100');
  assert.equal(full.animation.traceDocument.sourceCode, full.animation.code);
  assert.ok(manifest.preview.bytes < 30 * 1024, 'first-frame preview should remain lightweight');
  // The deck now contains IDs only. Compare the standalone transfer with the
  // complete teaching deck plus its external, compressed animation payloads.
  const deckBytes = fs.readFileSync(path.join(publicRoot, 'guest-decks/linear-sieve.asmdeck'));
  const body = readPackage(deckBytes).body;
  const animations = body.deck.groups.flatMap(group => group.slides || []).filter(slide => slide.animation);
  const traces = new Map(animations.map(slide => [slide.animation.traceRef,
    savedTrace(body, slide.animation, { presentation: false })]));
  const completeBytes = deckBytes.length + [...traces.values()].reduce((sum, trace) =>
    sum + gzipSync(Buffer.from(JSON.stringify(trace))).length, 0);
  assert.ok(manifest.full.bytes < completeBytes,
    'standalone animation should remain smaller than the complete teaching deck and its external traces');
});

test('standalone default builder publishes immutable preview/full files before its manifest', async t => {
  const target = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'asm-default-assets-'));
  t.after(() => fs.rmSync(target, { recursive: true, force: true }));
  const original = JSON.parse(fs.readFileSync(path.join(publicRoot, 'default-animation/manifest.json')));
  const full = await traceBundle.decode(new Blob([fs.readFileSync(path.join(publicRoot, original.full.url))]), original.full, original, 'full');
  const manifest = await require('../scripts/build/default-algorithm-assets').buildDefaultAlgorithmAssets({ groups: [{ slides: [{ id: original.sourceSlideId, animation: full.animation }] }] },
    { publicRoot: target, engineVersion: original.engineVersion, immutable: true });
  for (const descriptor of [manifest.preview, manifest.full]) {
    assert.match(descriptor.url, /-[a-f0-9]{64}\.asmtrace$/);
    assert.equal(fs.statSync(path.join(target, descriptor.url)).size, descriptor.bytes);
  }
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(target, 'default-animation/manifest.json'))), manifest);
});
