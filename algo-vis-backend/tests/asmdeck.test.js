const { test } = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');
const { gunzipSync, gzipSync } = require('node:zlib');

global.crypto = webcrypto;
global.ASMTraceProvenance = require('../public/trace-provenance.js');
global.ASMTraceViewSource = require('../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => value };
const archive = require('../public/asmdeck.js');

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
