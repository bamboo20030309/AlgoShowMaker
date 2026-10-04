const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

const code = `#include <bits/stdc++.h>
using namespace std;
// @preset view
// @let alias = number
// @object number as scalar
// @object bits(alias, 4) as binary render normal with labels(none), display("\${value ? '↙' : '　'}")
// @style alias background AV_red when value == 1
// @object b as bitset_view with labels(none)
// @object bits(rows, 4) as matrix render matrix with labels(none)
// @object native as native_matrix render matrix with labels(none)
// @object flags with labels(none)
// @object zeros with labels(none)
// @object explicit_bits with labels(none)
// @endpreset
int main() {
  int number = 9, amount = 1;
  std::bitset<4> b{9};
  vector<int> rows = {9, 3};
  vector<bitset<4>> native = {bitset<4>(9), bitset<4>(3)};
  vector<bool> flags = {true, false, true, false};
  vector<int> zeros = {0, 1, 0, 1};
  std::array<bool, 4> explicit_bits = {true, false, true, false};
  // @frame use view
  number <<= amount++;
  // @frame use view
  b >>= 2;
  // @frame use view
  rows[1] <<= 1;
  // @frame use view
  native[0] >>= 1;
  // @frame use view
  b <<= 4;
  // @frame use view
  cout << number << ' ' << amount;
}`;

test('shift metadata evaluates RHS once and retains native bit identities', { timeout: 30000 }, async () => {
  const { trace } = await compile(code);
  const shifts = trace.frames.flatMap(frame => frame.events).filter(event => event.bitShift);
  assert.equal(shifts.length, 5);
  assert.deepEqual(JSON.parse(JSON.stringify(shifts.map(event => event.bitShift))), [
    { direction: 'left', amount: 1 }, { direction: 'right', amount: 2 },
    { direction: 'left', amount: 1 }, { direction: 'right', amount: 1 },
    { direction: 'left', amount: 4 }
  ]);
  assert.equal(shifts[0].payload.before.value, 9);
  assert.equal(shifts[0].payload.after.value, 18);
  const variable = name => Object.keys(trace.variables).find(id => trace.variables[id].name === name);
  assert.equal(trace.frames.at(-1).state[variable('amount')].data.value, 2);
  assert.equal(trace.frames[0].state[variable('b')].data.bitArray, true);
  assert.equal(trace.frames[0].state[variable('flags')].data.bitArray, true);
  assert.equal(trace.frames[0].state[variable('explicit_bits')].data.bitArray, true);
  assert.equal(trace.frames[0].state[variable('zeros')].data.bitArray, undefined);
  assert.deepEqual(Array.from(trace.frames[0].state[variable('b')].data.items, item => item.value), [1, 0, 0, 1]);
  assert.equal(trace.frames[0].state[variable('native')].data.items[0].bitArray, true);
  assert.equal(shifts[2].targets[0].resolvedIndex, 1);
  assert.equal(shifts[3].targets[0].resolvedIndex, 0);
});

test('bits aliases and native bitsets shift contents, scalar assignment and old saved traces stay compatible',
  { timeout: 60000 }, async () => {
    const { trace } = await compile(code);
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
      await page.waitForFunction(() => window.asmApplyTraceDocument && window.ASMTraceFrameTween);
      await page.evaluate(trace => window.asmApplyTraceDocument(trace), trace);
      const result = await page.evaluate(async () => {
        const doc = ASMTracePlayer.getDocument();
        const render = index => ASMTracePlayer.renderStable(index);
        const elements = () => new Map([...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
          .map(node => [node.dataset.traceObjectKey, node]));
        const probes = [];
        await render(0);
        const variableId = name => Object.keys(doc.variables).find(id => doc.variables[id].name === name);
        const zeroFrame = doc.frames[0];
        const zeroEvent = { bitShift: { direction: 'left', amount: 1 },
          targets: [{ role: 'target', variableId: variableId('zeros') }] };
        const plainZeroTargets = ASMTraceFrameTween.bitShiftTargets(doc, zeroFrame, zeroEvent, elements()).length;
        const flags = zeroFrame.state[variableId('flags')].data;
        flags.bitArray = false;
        const explicitlyOffTargets = ASMTraceFrameTween.bitShiftTargets(doc, zeroFrame,
          { ...zeroEvent, targets: [{ role: 'target', variableId: variableId('flags') }] }, elements()).length;
        flags.bitArray = true;
        for (let index = 1; index < doc.frames.length; index++) {
          const frame = doc.frames[index], event = frame.events.find(event => event.bitShift);
          if (!event) continue;
          await render(index - 1);
          const previous = new Map([...elements()].map(([key, node]) => [key, node.cloneNode(true)]));
          // A completed style tween stores alpha separately from RGB. The
          // shifted clone must not apply the AV color's alpha a second time.
          previous.forEach(node => node.querySelectorAll('[data-trace-index] > rect')
            .forEach(rect => rect.setAttribute('fill-opacity', '0.6')));
          await render(index);
          const current = elements();
          const targets = ASMTraceFrameTween.bitShiftTargets(doc, frame, event, current);
          const effect = ASMTraceFrameTween.createBitShiftEffect(event, doc, frame, current, previous);
          effect.update(260);
          const zeroFills = [...document.querySelectorAll('[data-trace-bit-shift-zero-fill]')]
            .map(node => node.getAttribute('fill'));
          const movingPaints = [...document.querySelectorAll('[data-trace-bit-shift-motion] > g > rect')]
            .map(node => ({ fill: node.getAttribute('fill'), alpha: Number(node.getAttribute('fill-opacity')) }));
          const motions = [...document.querySelectorAll('[data-trace-bit-shift-motion]')]
            .map(node => node.getAttribute('transform'));
          const counts = targets.map(target => ({ key: target.element.dataset.traceObjectKey,
            cells: target.cells.map(cell => cell.dataset.traceIndex) }));
          effect.remove();
          probes.push({ counts, motions, zeroFills, movingPaints, cleanup: document.querySelectorAll('[data-trace-bit-shift]').length });
        }
        // Exercise the actual event scheduler, including mixed scalar/bits views.
        await render(0);
        window.asmGetAnimationPlaybackRate = () => 4;
        let done = false, shiftSeen = false, scalarSeen = false;
        const positions = new Set();
        const play = ASMTraceRenderers.renderFrame(doc, doc.frames[1], doc.frames[0],
          { direction: 1, animatePositions: true, animateEvents: true }).finally(() => { done = true; });
        for (let tick = 0; tick < 900 && !done; tick++) {
          await new Promise(requestAnimationFrame);
          const motion = document.querySelector('[data-trace-bit-shift-motion]');
          if (motion) { shiftSeen = true; positions.add(motion.getAttribute('transform')); }
          scalarSeen ||= Boolean(document.querySelector('.asm-trace-assign-transfer-value, .asm-trace-assign-falling-value'));
        }
        await play;
        const fresh = JSON.parse(JSON.stringify(doc));
        fresh.studio = { ...fresh.studio, eventSettings: { autoFixedEnabled: false } };
        const old = JSON.parse(JSON.stringify(fresh));
        old.frames.forEach(frame => frame.events.forEach(event => { delete event.bitShift; }));
        old.skins[Object.keys(old.variables)[0]].options.customValue = 0;
        for (const saved of [fresh, old]) {
          await asmApplyTraceDocument(saved);
          await ASMTracePlayer.renderStable(1);
          const reopened = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
          await asmApplyTraceDocument(reopened);
          await ASMTracePlayer.renderStable(1);
        }
        const reopened = ASMTracePlayer.getDocument();
        const oldFrame = reopened.frames[1], oldEvent = oldFrame.events.find(event => event.compound);
        const oldTargets = ASMTraceFrameTween.bitShiftTargets(reopened, oldFrame, oldEvent, elements());
        return { probes, shiftSeen, scalarSeen, positions: positions.size, oldTargets: oldTargets.length,
          plainZeroTargets, explicitlyOffTargets,
          custom: reopened.skins[Object.keys(old.variables)[0]].options.customValue,
          explicitFalse: reopened.studio.eventSettings.autoFixedEnabled,
          cleanup: document.querySelectorAll('[data-trace-bit-shift]').length };
      });
      assert.deepEqual(result.probes.map(probe => probe.counts.map(target => target.key)),
        [['binary'], ['bitset_view'], ['matrix'], ['native_matrix'], ['bitset_view']]);
      assert.ok(result.probes[0].motions[0].includes('-20'));
      assert.ok(result.probes[1].motions[0].includes('40'));
      assert.deepEqual(result.probes[2].counts[0].cells, ['1,0', '1,1', '1,2', '1,3']);
      assert.deepEqual(result.probes[3].counts[0].cells, ['0,0', '0,1', '0,2', '0,3']);
      assert.ok(result.probes.every(probe => probe.cleanup === 0));
      assert.ok(result.probes.every(probe => probe.zeroFills.length > 0
        && probe.zeroFills.every(fill => fill === '#ffffff')),
        'incoming zero bits reveal opaque white, never the canvas or outerframe background');
      assert.deepEqual(result.probes[0].movingPaints, [
        { fill: 'rgb(239,154,154)', alpha: 0.6 }, { fill: 'rgb(255,255,255)', alpha: 1 },
        { fill: 'rgb(255,255,255)', alpha: 1 }, { fill: 'rgb(239,154,154)', alpha: 0.6 }
      ], 'red alpha is 0.6, not 0.6 multiplied by inherited 0.6; zero bits remain opaque white');
      assert.equal(result.shiftSeen, true);
      assert.equal(result.scalarSeen, true);
      assert.ok(result.positions > 1);
      assert.equal(result.oldTargets, 0);
      assert.equal(result.plainZeroTargets, 0);
      assert.equal(result.explicitlyOffTargets, 0);
      assert.equal(result.custom, 0);
      assert.equal(result.explicitFalse, false);
      assert.equal(result.cleanup, 0);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });

test('shifted paint matches the stationary cell on the actual canvas', { timeout: 30000 }, async () => {
  const { trace } = await compile(code);
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    await page.waitForFunction(() => window.asmApplyTraceDocument);
    await page.evaluate(trace => asmApplyTraceDocument(trace), trace);
    await page.evaluate(() => ASMTracePlayer.renderStable(0));
    const point = selector => page.evaluate(selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { x: Math.floor(box.left + box.width * .75), y: Math.floor(box.top + box.height * .2), width: 1, height: 1 };
    }, selector);
    const pixel = async selector => {
      const bytes = [...await page.screenshot({ clip: await point(selector) })];
      return page.evaluate(async bytes => {
        const image = await createImageBitmap(new Blob([Uint8Array.from(bytes)], { type: 'image/png' }));
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
        return [...context.getImageData(0, 0, 1, 1).data];
      }, bytes);
    };
    const before = await pixel('[data-trace-object-key="binary"] [data-trace-index="0,0"] > rect');
    await page.evaluate(async () => {
      const doc = ASMTracePlayer.getDocument(), frame = doc.frames[1];
      const elements = () => new Map([...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
        .map(node => [node.dataset.traceObjectKey, node]));
      const previous = new Map([...elements()].map(([key, node]) => [key, node.cloneNode(true)]));
      await ASMTracePlayer.renderStable(1);
      const event = frame.events.find(event => event.bitShift);
      window.pixelShift = ASMTraceFrameTween.createBitShiftEffect(event, doc, frame, elements(), previous);
      pixelShift.update(260);
    });
    const during = await pixel('[data-trace-object-key="binary"] [data-trace-bit-shift-motion] > g:first-child > rect');
    assert.deepEqual(during, before, 'the moving red bit must preserve its compositing backdrop');
    assert.deepEqual(await pixel('[data-trace-object-key="binary"] [data-trace-bit-shift-zero-fill]'),
      [255, 255, 255, 255], 'only the incoming zero-bit region is backed by opaque white');
    await page.evaluate(() => pixelShift.remove());
  } finally { await browser.close(); }
});
