const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { gunzipSync, gzipSync } = require('node:zlib');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

global.crypto = webcrypto;
global.ASMTraceProvenance = require('../public/trace-provenance.js');
global.ASMTraceViewSource = require('../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => value };
const archive = require('../public/asmdeck.js');

test('HTTP without SubtleCrypto preserves hashes, round-trips, and rejects tampering', async () => {
  const sandbox = { module: { exports: {} }, TextEncoder, TextDecoder, Uint8Array,
    ArrayBuffer, DataView, Uint32Array, Blob, Response, CompressionStream, DecompressionStream,
    crypto: {}, ASMTraceProvenance: global.ASMTraceProvenance,
    ASMTraceViewSource: global.ASMTraceViewSource };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/asmdeck.js'), 'utf8'), sandbox);
  const fallback = sandbox.module.exports;
  for (const input of ['', 'abc', '繁體中文🙂', 'x'.repeat(55), 'x'.repeat(56),
    'x'.repeat(64), 'x'.repeat(10000)]) {
    const nativeDeck = fixture();
    nativeDeck.groups[0].slides[0].animation.input = input;
    const animation = nativeDeck.groups[0].slides[0].animation;
    animation.traceDocument.provenance = global.ASMTraceProvenance.create(animation.code, input);
    const native = await archive.project(nativeDeck);
    const projected = await fallback.project(nativeDeck);
    assert.equal(JSON.stringify(projected), JSON.stringify(native));
    const blob = await fallback.encode(projected);
    assert.equal(JSON.stringify(await fallback.decode(blob)), JSON.stringify(await archive.decode(blob)));
    const bytes = Buffer.from(await blob.arrayBuffer());
    const payload = JSON.parse(gunzipSync(bytes.subarray(archive.MAGIC.length)));
    payload.body.deck.groups[0].slides[0].animation.input += 'tampered';
    await assert.rejects(() => fallback.decode(new Blob([
      archive.MAGIC, gzipSync(Buffer.from(JSON.stringify(payload)))
    ])), /雜湊不符/);
  }
});

test('deck transfer uses direct actions without warning or error modals', () => {
  const html = fs.readFileSync(require.resolve('../public/slides.html'), 'utf8');
  const script = fs.readFileSync(require.resolve('../public/slides.js'), 'utf8');
  assert.doesNotMatch(html + script, /deckExportWarningDialog|deckTransferErrorDialog|confirmCompactExport/);
  assert.match(script, /setCloudStatus\('error', `無法匯出投影片/);
});

function fixture() {
  const code = 'int main(){ int arr[2]={1,2}; // @frame arr\n return 0; }';
  const input = '';
  return {
    groups: [{ id: 'g', slides: [{
      id: 's', kind: 'algorithm-animation',
      canvas: { objects: [{ type: 'image', src: 'data:image/png;base64,AAAA' },
        { type: 'image', src: 'data:image/png;base64,AAAA' }] },
      animation: { code, input, sliceMode: 'manual', watches: ['arr'],
        traceDocument: {
          schemaVersion: '1.0', provenance: global.ASMTraceProvenance.create(code, input),
          sourceCode: code, variables: { arr: { id: 'arr', name: 'arr', kind: 'sequence', functionName: 'main' } },
          frames: [{ id: 'f0', source: { functionName: 'main', directiveKey: 'manual-frame:first:0' },
            state: { arr: { kind: 'sequence', items: [] } }, events: [{ type: 'declare' }] }],
          skins: { arr: { renderer: 'original-array', options: { showIndex: true } } },
          rules: [], studio: { objects: [], arrows: [], cameraRules: [{
            id: 'camera-main', frameIds: ['f0'], zoom: 1.5,
            binding: { targetKey: 'arr', targetAnchor: 'center' }
          }], transitions: [],
            positions: { f0: { arr: { x: 120, y: 80 } } },
            eventSettings: { gapMs: 720, autoFixedEnabled: false },
            eventInstructionStates: { 'assign:main:i++': true } }
        }
      }
    }] }]
  };
}

test('asmdeck projection is detached, strips trace results, and retains playback settings', async () => {
  const live = fixture();
  const before = JSON.stringify(live);
  const projected = await archive.project(live);
  assert.equal(JSON.stringify(live), before);
  const slide = projected.deck.groups[0].slides[0];
  assert.equal(slide.animation.traceDocument, undefined);
  assert.equal(slide.animation.rebuild.globals.eventSettings.gapMs, 720);
  assert.deepEqual(slide.animation.rebuild.view.studio.eventInstructionStates, {
    'assign:main:i++': true
  });
  assert.equal(Object.keys(projected.assets).length, 1);
  assert.equal(projected.cacheSeeds[0].trace.frames.length, 1);
  assert.equal(slide.animation.rebuild.view.studio.cameraRules[0].id, 'camera-main');
  assert.ok(slide.animation.rebuild.view.studio.frameMaps.positions);
  assert.match(slide.canvas.objects[0].src, /^asm-asset:/);
  assert.equal(slide.canvas.objects[0].src, slide.canvas.objects[1].src);
});

test('asmdeck gzip round-trip checks hashes and restores both deduplicated images', async () => {
  const projected = await archive.project(fixture());
  const blob = await archive.encode(projected);
  const decoded = await archive.decode(blob);
  assert.equal(decoded.deck.groups[0].slides[0].canvas.objects[0].src, 'data:image/png;base64,AAAA');
  assert.equal(decoded.deck.groups[0].slides[0].canvas.objects[1].src, 'data:image/png;base64,AAAA');
  assert.equal(decoded.deck.groups[0].slides[0].animation.traceDocument, undefined);
  const corrupt = new Blob([archive.MAGIC, new Uint8Array([1, 2, 3])]);
  await assert.rejects(() => archive.decode(corrupt), /無法解壓或解析/);
  const bytes = Buffer.from(await blob.arrayBuffer());
  const payload = JSON.parse(gunzipSync(bytes.subarray(archive.MAGIC.length)));
  payload.body.deck.groups[0].slides[0].animation.input = 'tampered';
  await assert.rejects(() => archive.decode(new Blob([
    archive.MAGIC, gzipSync(Buffer.from(JSON.stringify(payload)))
  ])), /雜湊不符/);
});

test('older engine archives rebuild on the current engine while newer or different formats remain blocked', async () => {
  const projected = await archive.project(fixture());
  const blob = await archive.encode(projected);
  const bytes = Buffer.from(await blob.arrayBuffer());
  const payload = JSON.parse(gunzipSync(bytes.subarray(archive.MAGIC.length)));
  const [currentEngine, currentFormat] = archive.engineVersion().split('/').map(Number);

  payload.manifest.engineVersion = `${Math.max(0, currentEngine - 1)}/${currentFormat}`;
  const older = new Blob([archive.MAGIC, gzipSync(Buffer.from(JSON.stringify(payload)))]);
  assert.equal((await archive.decode(older)).manifest.engineVersion, payload.manifest.engineVersion);

  payload.manifest.engineVersion = `${currentEngine + 1}/${currentFormat}`;
  const newer = new Blob([archive.MAGIC, gzipSync(Buffer.from(JSON.stringify(payload)))]);
  await assert.rejects(() => archive.decode(newer), /不相容/);

  payload.manifest.engineVersion = `${currentEngine}/${currentFormat + 1}`;
  const differentFormat = new Blob([archive.MAGIC, gzipSync(Buffer.from(JSON.stringify(payload)))]);
  await assert.rejects(() => archive.decode(differentFormat), /不相容/);
});

test('every bundled guest deck remains decodable after engine upgrades', async () => {
  const publicRoot = path.resolve(__dirname, '../public');
  const catalog = JSON.parse(fs.readFileSync(path.join(publicRoot, 'guest-decks.json'), 'utf8'));
  assert.ok(catalog.decks.length > 0);
  for (const entry of catalog.decks) {
    const bytes = fs.readFileSync(path.join(publicRoot, entry.archive.replace(/^\//, '')));
    const decoded = await archive.decode(new Blob([bytes]));
    assert.ok(decoded.deck.groups?.length > 0, entry.id);
  }
});

test('dirty code is refused instead of silently exporting the prior RUN', async () => {
  const live = fixture();
  live.groups[0].slides[0].animation.code += '\nint changed = 1;';
  await assert.rejects(() => archive.project(live), /尚未更新/);
});

test('editor draft only replaces the export snapshot', async () => {
  const live = fixture();
  const slide = live.groups[0].slides[0];
  const draft = JSON.parse(JSON.stringify(slide.animation));
  draft.traceDocument.studio.eventSettings.gapMs = 300;
  const projected = await archive.project(live, { slideId: 's', animation: draft });
  assert.equal(projected.deck.groups[0].slides[0].animation.rebuild.globals.eventSettings.gapMs, 300);
  assert.equal(slide.animation.traceDocument.studio.eventSettings.gapMs, 720);
});

test('cache miss analyzes once, RUNs once and reapplies camera, event and gap settings', async () => {
  const projected = await archive.project(fixture());
  const compact = (await archive.decode(await archive.encode(projected))).deck;
  const rawTrace = JSON.parse(JSON.stringify(fixture().groups[0].slides[0].animation.traceDocument));
  rawTrace.frames[0].id = 'new-f0';
  rawTrace.studio = { objects: [], arrows: [], cameraRules: [], transitions: [] };
  const requests = [];
  const priorFetch = global.fetch;
  const priorWarn = console.warn;
  console.warn = () => {};
  global.fetch = async (url, options) => {
    requests.push({ url, body: JSON.parse(options.body) });
    return { ok: true, json: async () => url === '/trace/analyze'
      ? { variables: [{ id: 'arr' }] } : { traceDocument: rawTrace } };
  };
  try {
    const kinds = [];
    const rebuilt = await archive.rebuildDeck(compact, () => {}, (_slide, kind) => kinds.push(kind));
    const trace = rebuilt.groups[0].slides[0].animation.traceDocument;
    assert.deepEqual(kinds, ['run']);
    assert.deepEqual(requests.map(request => request.url), ['/trace/analyze', '/compile']);
    assert.deepEqual(requests[1].body.trace.watches, ['arr']);
    assert.equal(trace.studio.eventSettings.gapMs, 720);
    assert.equal(trace.studio.cameraRules[0].id, 'camera-main');
    assert.deepEqual(trace.studio.positions['new-f0'].arr, { x: 120, y: 80 });
    assert.equal(trace.studio.eventInstructionStates['assign:main:i++'], true);
    assert.equal(trace.frames[0].id, 'new-f0');
  } finally { global.fetch = priorFetch; console.warn = priorWarn; }
});

for (const failure of ['analysis', 'compile', 'network']) {
  test(`${failure} failure retains editable slide/settings and still imports later slides`, async () => {
    const compact = (await archive.project(fixture())).deck;
    const slides = compact.groups[0].slides;
    const bad = slides[0];
    bad.animation.code = '#include <bits/stdc++.h>\nusing namespace std;\n\n\n// @camera focus arr\nint main(){}';
    bad.animation.input = '6\n5 7 2 1 9 4';
    const good = JSON.parse(JSON.stringify((await archive.project(fixture())).deck.groups[0].slides[0]));
    good.id = 'good'; slides.push(good);
    const before = JSON.stringify(compact);
    const originalFetch = global.fetch, originalWarn = console.warn;
    console.warn = () => {};
    const message = failure === 'analysis'
      ? '無法分析 C++ 程式碼：第 5 行的 @camera 前面找不到可套用的 @frame'
      : failure === 'compile' ? 'C++ 編譯失敗' : 'Failed to fetch';
    const requests = [];
    global.fetch = async (url, options) => {
      const code = JSON.parse(options.body).code;
      requests.push({ url, code });
      if (code === bad.animation.code) {
        if (failure === 'network') throw new Error(message);
        if ((failure === 'analysis' && url === '/trace/analyze')
          || (failure === 'compile' && url === '/compile')) {
          return { ok: false, json: async () => ({ error: message }) };
        }
      }
      return { ok: true, json: async () => url === '/trace/analyze'
        ? { variables: [{ id: 'arr' }] }
        : { traceDocument: fixture().groups[0].slides[0].animation.traceDocument } };
    };
    try {
      const outcomes = [];
      const imported = await archive.rebuildDeck(compact, () => {}, (slide, kind) => outcomes.push([slide.id, kind]));
      assert.equal(JSON.stringify(compact), before, 'the archive snapshot must not be mutated');
      const pending = imported.groups[0].slides[0];
      assert.equal(pending.animation.code, bad.animation.code);
      assert.equal(pending.animation.input, bad.animation.input);
      assert.deepEqual(pending.animation.rebuild, bad.animation.rebuild);
      assert.deepEqual(pending.canvas, bad.canvas);
      assert.equal(pending.animation.rebuildError, message);
      assert.equal(pending.animation.traceDocument, undefined, 'no fake successful animation');
      assert.deepEqual(outcomes, [['s', 'pending'], ['good', 'run']]);
      assert.ok(imported.groups[0].slides[1].animation.traceDocument.frames.length);
      assert.equal(imported.groups[0].slides[1].animation.rebuild, undefined);
      if (failure === 'analysis') assert.equal(requests.filter(r => r.code === bad.animation.code).length, 1);
    } finally { global.fetch = originalFetch; console.warn = originalWarn; }
  });
}

test('animation normalization keeps detached pending reconstruction settings', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/algorithm-animation.js'), 'utf8'), context);
  const source = { code: 'bad C++', input: '6', mode: 'trace', rebuildError: '請修正程式',
    rebuild: { view: { skins: { arr: { renderer: 'original-array' } }, rules: [],
      studio: { eventInstructionStates: { 'assign:main:i = 0': false } } },
      globals: { eventSettings: { gapMs: 720 } } } };
  const normalized = context.window.ASMAlgorithmAnimation.normalize(source);
  assert.equal(JSON.stringify(normalized.rebuild), JSON.stringify(source.rebuild));
  assert.equal(normalized.rebuildError, source.rebuildError);
  assert.equal(normalized.traceDocument, null);
  assert.equal(normalized.skins.arr.renderer, 'original-array');
  normalized.rebuild.globals.eventSettings.gapMs = 300;
  assert.equal(source.rebuild.globals.eventSettings.gapMs, 720);
});
