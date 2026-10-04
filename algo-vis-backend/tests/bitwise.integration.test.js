const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

const code = `#include <bits/stdc++.h>
using namespace std;
// @preset view
// @object bits(x, 4) as X with labels(none), display("\${value}")
// @object bits(y, 4) as Y with labels(none), display("\${value}")
// @object bits(z, 4) as Z with labels(none), display("\${value}")
// @object b, c with labels(none), display("\${value}")
// @object rows render matrix with labels(none), display("\${value}")
// @object u, v
// @style x, y, z, b, c, rows background AV_red when value == 1
// @endpreset
int main() {
  int x = 9, y = 6, z = 0;
  bitset<4> b{9};
  bitset<4> c{6};
  vector<bitset<4>> rows = {bitset<4>(9), bitset<4>(6)};
  int u = 9, v = 6;
  // @frame use view
  x |= (y);
  // @frame use view
  x &= y;
  // @frame use view
  x ^= y;
  // @frame use view
  z = x | y;
  // @frame use view
  z = x & y;
  // @frame use view
  z = (x) ^ (y);
  // @frame use view
  z = x | y | z;
  // @frame use view
  b |= c;
  // @frame use view
  rows[1] ^= rows[0];
  // @frame use view
  int born = x | y;
  // @frame use view
  // @object bits(born, 4) as Born with labels(none), display("\${value}")
  u |= v;
  // @frame use view
  z = x | y;
  z ^= y;
  // @frame use view
  x |= y;
  // @frame
  // @object bits(x, 4) as X with labels(none), display("\${value}")
  return 0;
}`;

test('bitwise captures six operators, intermediate values and row indices without changing computation',
  { timeout: 30000 }, async () => {
    const { trace } = await compile(code);
    const events = trace.frames.flatMap(frame => frame.events).filter(event => event.bitwise);
    assert.deepEqual(Array.from(events.slice(0, 7), e => [e.bitwise.operator, e.payload.left.value, e.payload.right.value, e.payload.after.value]), [
      ['|', 9, 6, 15], ['&', 15, 6, 6], ['^', 6, 6, 0],
      ['|', 0, 6, 6], ['&', 0, 6, 0], ['^', 0, 6, 6], ['|', 0, 6, 6]
    ]);
    assert.equal(events[7].bitwise.leftIntermediate, true);
    assert.equal(events[7].payload.left.value, 6);
    assert.equal(events[9].targets[0].resolvedIndex, 1);
    assert.equal(events[9].targets[2].resolvedIndex, 0);
    assert.deepEqual(Array.from(events[9].payload.after.items, item => item.value), [1, 1, 1, 1]);
    const double = trace.frames.find(frame => frame.events.filter(e => e.bitwise).length === 2
      && frame.events.some(e => e.bitwise?.operator === '^'));
    assert.deepEqual(Array.from(double.events.filter(e => e.bitwise), e => [e.payload.left.value, e.payload.after.value]), [[0, 6], [6, 0]]);
    const id = name => Object.keys(trace.variables).find(id => trace.variables[id].name === name);
    assert.equal(trace.frames.at(-1).state[id('x')].data.value, 6);
    assert.equal(trace.frames.at(-2).state[id('u')].data.value, 15);
  });

test('bitwise row overlays, missing-source yellow events, scalar fallback and saved traces',
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
      await page.evaluate(doc => asmApplyTraceDocument(doc), trace);
      const probes = await page.evaluate(async () => {
        const doc = ASMTracePlayer.getDocument();
        const elements = () => new Map([...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
          .map(node => [node.dataset.traceObjectKey, node]));
        const results = [];
        for (let index = 1; index < doc.frames.length; index++) {
          const frame = doc.frames[index], events = frame.events.filter(event => event.bitwise);
          if (!events.length) continue;
          await ASMTracePlayer.renderStable(index);
          const current = elements();
          for (const event of events) {
            const plan = ASMTraceFrameTween.bitwisePlan(doc, frame, event, current);
            const effect = ASMTraceFrameTween.createBitwiseEffect(event, doc, frame, current);
            const probe = { index, operation: event.bitwise.operator, key: plan?.target.element.dataset.traceObjectKey,
              available: event.autoAnimationDisabled !== true, missing: event.autoAnimationUnavailableReason,
              count: plan?.target.cells.length || 0, row: plan?.target.cells[0].dataset.traceIndex,
              effects: Boolean(effect) };
            if (effect) {
              effect.update(0);
              const overlay = document.querySelector('[data-trace-bitwise]');
              const texts = selector => [...overlay.querySelectorAll(selector + ' text')].map(text => text.textContent);
              probe.left = texts('[data-trace-bitwise-base]');
              probe.right = texts('[data-trace-bitwise-motion]');
              const first = overlay.querySelector('[data-trace-bitwise-motion] > g');
              probe.origin = first.getAttribute('transform');
              effect.update(260);
              probe.middle = first.getAttribute('transform');
              effect.update(520);
              probe.result = [...overlay.querySelectorAll('[data-trace-bitwise-base] > g')]
                .filter(node => node.style.opacity === '1').map(node => node.querySelector('text')?.textContent);
              effect.remove();
              probe.cleaned = !document.querySelector('[data-trace-bitwise]')
                && plan.target.cells.every(cell => cell.style.visibility !== 'hidden');
            }
            results.push(probe);
          }
        }
        // Preserve user settings and round-trip old traces without metadata.
        const custom = JSON.parse(JSON.stringify(doc));
        const configured = custom.frames.flatMap(f => f.events).find(e => e.bitwise);
        configured.enabled = false; configured.animate = false;
        await asmApplyTraceDocument(JSON.parse(JSON.stringify(custom)));
        const saved = ASMTracePlayer.getDocument().frames.flatMap(f => f.events).find(e => e.id === configured.id);
        const preserved = saved.enabled === false && saved.animate === false;
        const old = JSON.parse(JSON.stringify(custom));
        old.frames.forEach(f => f.events.forEach(e => { delete e.bitwise; }));
        await asmApplyTraceDocument(old);
        await ASMTracePlayer.renderStable(1);
        const reopened = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
        await asmApplyTraceDocument(reopened);
        await ASMTracePlayer.renderStable(1);
        return { results, preserved, oldCompatible: !document.querySelector('[data-trace-bitwise]') };
      });
      const animated = probes.results.filter(probe => probe.effects);
      assert.ok(animated.length >= 12, JSON.stringify(probes));
      assert.ok(animated.every(probe => probe.available && probe.count === 4 && probe.cleaned));
      assert.deepEqual(animated[0].left, ['1', '0', '0', '1']);
      assert.deepEqual(animated[0].right, ['0', '1', '1', '0']);
      assert.deepEqual(animated[0].result, ['1', '1', '1', '1']);
      assert.notEqual(animated[0].origin, animated[0].middle, 'source copy moves towards target');
      assert.ok(animated.some(probe => probe.row === '1,0'), 'native 2D operation affects only its row');
      const matrix = animated.find(probe => probe.row === '1,0');
      assert.notEqual(matrix.origin, matrix.middle, 'native row cells actually travel between row positions');
      assert.ok(probes.results.some(probe => !probe.effects && probe.available), 'ordinary scalar uses normal assignment');
      const missing = probes.results.at(-1);
      assert.equal(missing.effects, false);
      assert.equal(missing.available, false);
      assert.equal(missing.missing, 'missing-target');
      assert.equal(probes.preserved, true);
      assert.equal(probes.oldCompatible, true);
      await page.evaluate(doc => asmApplyTraceDocument(doc), trace);
      const playback = await page.evaluate(async () => {
        const doc = ASMTracePlayer.getDocument(), results = [];
        for (const rate of [1, 2]) {
          window.asmGetAnimationPlaybackRate = () => rate;
          for (const index of [1, 12]) {
            await ASMTracePlayer.renderStable(index - 1);
            let done = false;
            const seen = new Map();
            const play = ASMTraceRenderers.renderFrame(doc, doc.frames[index], doc.frames[index - 1],
              { direction: 1, animatePositions: true, animateEvents: true }).finally(() => { done = true; });
            for (let tick = 0; tick < 1200 && !done; tick++) {
              await new Promise(requestAnimationFrame);
              for (const overlay of document.querySelectorAll('[data-trace-bitwise]')) {
                const id = overlay.dataset.traceBitwise;
                if (!seen.has(id)) seen.set(id, [...overlay.querySelectorAll('[data-trace-bitwise-base] text')]
                  .map(text => text.textContent));
              }
            }
            await play;
            const key = index === 1 ? 'X' : 'Z';
            const cells = [...document.querySelectorAll(`#asm-trace-root [data-trace-object-key="${key}"] [data-trace-index] > text`)]
              .map(text => text.textContent);
            results.push({rate, index, starts: [...seen.values()], cells,
              clean: !document.querySelector('[data-trace-bitwise]')});
            await ASMTraceRenderers.renderFrame(doc, doc.frames[index - 1], doc.frames[index],
              { direction: -1, animatePositions: true, animateEvents: true });
            results.at(-1).backClean = !document.querySelector('[data-trace-bitwise]');
          }
        }
        return results;
      });
      for (const result of playback) {
        assert.equal(result.clean && result.backClean, true);
        assert.deepEqual(result.cells, result.index === 1 ? ['1', '1', '1', '1'] : ['0', '0', '0', '0']);
        assert.deepEqual(result.starts, result.index === 1 ? [['1', '0', '0', '1']]
          : [['0', '0', '0', '0'], ['0', '1', '1', '0']],
          'each played event starts from its own captured operands, not the next result');
      }
      for (const rate of [1, 2]) {
        await page.evaluate(async ({trace, rate}) => {
          const doc = JSON.parse(JSON.stringify(trace));
          doc.frames = doc.frames.slice(0, 3);
          doc.studio = { ...doc.studio, eventSettings: { ...doc.studio?.eventSettings, gapMs: 0 } };
          await asmApplyTraceDocument(doc);
          await ASMTracePlayer.renderStable(0);
          window.asmGetAnimationPlaybackRate = () => rate;
          window.__bitwiseAutoplayLog = [];
          if (window.__bitwiseLogStart) {
            removeEventListener('asm:trace-frame', window.__bitwiseLogStart);
            removeEventListener('asm:trace-playback-plan-complete', window.__bitwiseLogEnd);
          }
          window.__bitwiseLogStart = e => {
            if (e.detail.index > 0) __bitwiseAutoplayLog.push('start' + e.detail.index);
          };
          window.__bitwiseLogEnd = e => {
            const index = ASMTracePlayer.getDocument().frames.indexOf(e.detail.frame);
            if (index > 0) __bitwiseAutoplayLog.push('end' + index);
          };
          addEventListener('asm:trace-frame', window.__bitwiseLogStart);
          addEventListener('asm:trace-playback-plan-complete', window.__bitwiseLogEnd);
        }, { trace, rate });
        await page.locator('#playToggleBtn').click();
        await page.waitForFunction(() => ASMTracePlayer.getCurrentFrame() === 2
          && !ASMTracePlayer.getActivePlaybackPlan()
          && !document.getElementById('playToggleBtn').classList.contains('playing'), { timeout: 20000 });
        const autoplay = await page.evaluate(() => ({ log: __bitwiseAutoplayLog,
          clean: !document.querySelector('[data-trace-bitwise]'),
          cells: [...document.querySelectorAll('#asm-trace-root [data-trace-object-key="X"] [data-trace-index] > text')]
            .map(text => text.textContent) }));
        assert.deepEqual(autoplay.log, ['start1', 'end1', 'start2', 'end2'], `autoplay waits at ${rate}x`);
        assert.deepEqual(autoplay.cells, ['0', '1', '1', '0']);
        assert.equal(autoplay.clean, true);
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
