'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');
const { TWEEN_BUILD } = require('./helpers/builds');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('insertion frame 11 evaluates j+1 numerically in fresh and saved traces', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const bytes = fs.readFileSync(require('node:path').join(__dirname, '../public/guest-decks/insertion-sort.asmdeck'));
  const body = readPackage(bytes).body;
  const slide = body.deck.groups.flatMap(group => group.slides).find(item => item.animation);
  const animation = slide.animation;
  const input = '10\n1 8 7 2 6 5 3 9 10 12';
  assert.equal(animation.input.trim(), input, 'the saved example uses the reported input');
  const saved = savedTrace(body, animation);
  const oldBase = process.env.ASM_TEST_BASE_URL;
  let fresh;
  try { process.env.ASM_TEST_BASE_URL = base; fresh = (await compile(animation.code, input)).trace; }
  finally { if (oldBase === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = oldBase; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html');
  await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build, TWEEN_BUILD);
  for (const [mode, source, speed] of [
    ['fresh at 1x', fresh, 1], ['fresh at 4x', fresh, 4],
    ['saved at 1x', saved, 1], ['saved at 4x', saved, 4]
  ]) {
    const result = await page.evaluate(async ({ source, speed }) => {
      const player = ASMTracePlayer;
      player.apply(JSON.parse(JSON.stringify(source)));
      window.asmGetAnimationPlaybackRate = () => speed;
      const read = () => {
        const marker = [...document.querySelectorAll('[data-trace-pointer-instance-id]')]
          .find(node => node.querySelector('.trace-variable-marker-label-text')?.textContent === 'j+1');
        const label = marker?.querySelector('.trace-variable-marker-label-text'), rect = label?.getBoundingClientRect();
        // Compare positions in the same canvas coordinate system; camera
        // easing must not masquerade as motion outside the adjacent cells.
        const matrix = document.getElementById('asm-trace-root')?.getScreenCTM();
        const point = rect && matrix ? new DOMPoint(rect.x + rect.width / 2,
          rect.y + rect.height / 2).matrixTransform(matrix.inverse()) : null;
        return { binding: marker?.dataset.traceBindingTarget, x: point?.x ?? null };
      };
      await player.render(9, { animatePositions: false, animateEvents: false });
      const before = read();
      await player.render(10, { animatePositions: false, animateEvents: false });
      const expected = read();
      await player.render(9, { animatePositions: false, animateEvents: false });
      const samples = [];
      let settled = false;
      const transition = player.render(10).finally(() => { settled = true; });
      for (let i = 0; i < 400 && !settled; i++) { await new Promise(requestAnimationFrame); samples.push(read()); }
      await transition;
      const after = read();
      await player.render(9);
      const backward = read();
      player.apply(JSON.parse(JSON.stringify(player.getDocument())));
      await player.render(10);
      return { before, expected, after, backward, reopened: read(), samples };
    }, { source, speed });
    const { validateBehavior } = require('../scripts/trace-behavior-rules');
    for (const state of [result.after, result.reopened]) {
      const fixedRule = validateBehavior({ markers: [{ label: 'j+1', ...state }] }, { bindings: { 'j+1': 2 } });
      assert.equal(fixedRule.pass, true, mode + ': ' + JSON.stringify(fixedRule.firstViolation));
    }
    assert.ok(result.samples.length > 0, mode + ': actual animation was sampled');
    assert.match(result.expected.binding, /#2$/, mode + ': frame 11 points to index 2');
    assert.equal(result.after.binding, result.expected.binding, mode + ': forward seek keeps the arithmetic result');
    assert.equal(result.reopened.binding, result.expected.binding, mode + ': JSON save/reopen keeps it');
    assert.equal(result.backward.binding, result.before.binding, mode + ': reverse seek returns to index 3');
    const low = Math.min(result.before.x, result.expected.x), high = Math.max(result.before.x, result.expected.x);
    assert.ok(result.samples.every(sample => Number.isFinite(sample.x) && sample.x >= low - 1 && sample.x <= high + 1),
      mode + ': j+1 never flies outside the two adjacent cells: ' + JSON.stringify({ before: result.before,
        expected: result.expected, invalid: result.samples.filter(sample => sample.x < low - 1 || sample.x > high + 1).slice(0, 6) }));
  }
  assert.deepEqual(errors, []);
});
