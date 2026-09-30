/**
 * 驗證預設演算法的獨立預覽／完整 Trace 資產及其建置接線。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  const preview = await decode('linear-sieve-preview.asmtrace', manifest.preview, 'preview');
  const full = await decode('linear-sieve-full.asmtrace', manifest.full, 'full');

  assert.equal(manifest.totalFrames, 116);
  assert.equal(preview.animation.traceDocument.frames.length, 1);
  assert.equal(full.animation.traceDocument.frames.length, 116);
  assert.equal(preview.animation.code, full.animation.code);
  assert.equal(preview.animation.input, '100');
  assert.equal(full.animation.traceDocument.sourceCode, full.animation.code);
  assert.ok(manifest.preview.bytes < 30 * 1024, 'first-frame preview should remain lightweight');
  assert.ok(manifest.full.bytes < fs.statSync(path.join(publicRoot, 'guest-decks/linear-sieve.asmdeck')).size,
    'standalone animation should remain smaller than the complete teaching deck');
});

test('guest deck prebuild regenerates the standalone default animation', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/prebuild-guest-decks.js'), 'utf8');
  assert.match(script, /entry\.id === 'linear-sieve'/);
  assert.match(script, /buildDefaultAlgorithmAssets\(rebuilt/);
});
