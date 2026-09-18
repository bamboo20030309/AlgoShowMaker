const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('automatic fixed marks survive styled frame tween and match the Studio redraw', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const code = fs.readFileSync(path.join(__dirname, 'fixtures/auto-fixed-playback.cpp'), 'utf8');
    await page.evaluate(code => ace.edit('editor').setValue(code, -1), code);
    await page.click('#runBtn');
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code, code, { timeout: 30000 });
    const result = await page.evaluate(async () => {
      const player = window.ASMTracePlayer, source = JSON.parse(JSON.stringify(player.getDocument()));
      const read = () => [...document.querySelectorAll('#asm-trace-root .asm-trace-style-decoration')]
        .filter(wrapper => {
          const visual = wrapper.firstElementChild;
          if (!visual || visual.getAttribute('stroke') !== '#4caf50') return false;
          for (let node = visual; node && node.id !== 'asm-trace-root'; node = node.parentElement) {
            if (getComputedStyle(node).display === 'none' || Number(getComputedStyle(node).opacity) === 0) return false;
          }
          return true;
        }).map(wrapper => Number(wrapper._asmStyleCell?.dataset.traceIndex)).sort((a,b) => a-b);
      const expected = [];
      for (let index = 0; index < source.frames.length; index++) {
        await player.render(index, { animatePositions: false, animateEvents: false });
        expected.push(read());
      }
      await player.render(0, { animatePositions: false, animateEvents: false });
      const forward = [], entering = [];
      for (let index = 1; index < source.frames.length; index++) {
        const transition = player.render(index);
        entering.push(read());
        await transition;
        forward.push(read());
      }
      const beforeStudio = read();
      await window.ASMTraceStudio.open();
      const studio = read();
      await window.ASMTraceStudio.close();
      const backward = [];
      for (let index = source.frames.length - 2; index >= 0; index--) {
        await player.render(index);
        backward.push(read());
      }
      player.apply(JSON.parse(JSON.stringify(source)));
      await player.render(0, { animatePositions: false, animateEvents: false });
      await player.render(source.frames.length - 1);
      const reload = read();
      const disabledSource = JSON.parse(JSON.stringify(source));
      disabledSource.studio.eventSettings.autoFixedEnabled = false;
      disabledSource.frames.forEach(frame => frame.styles.push({
        ...frame.styles[0], id: 'manual-blue-mark', styleType: 'mark', color: 'blue',
        selector: { type: 'index', indexExpression: '0' }, when: null
      }));
      player.apply(disabledSource);
      await player.render(0, { animatePositions: false, animateEvents: false });
      await player.render(source.frames.length - 1);
      const disabled = read();
      const manual = [...document.querySelectorAll('#asm-trace-root .asm-trace-style-decoration')]
        .filter(wrapper => wrapper.firstElementChild?.getAttribute('stroke') === 'blue'
          && getComputedStyle(wrapper.firstElementChild).display !== 'none'
          && getComputedStyle(wrapper).display !== 'none')
        .map(wrapper => Number(wrapper._asmStyleCell?.dataset.traceIndex));
      return { expected, forward, entering, beforeStudio, studio, backward, reload, disabled, manual };
    });
    console.log('Auto fixed SVG:', JSON.stringify(result));
    assert.ok(result.expected.at(-1).length >= 2, 'the fixture generates and renders completed cell marks');
    assert.deepEqual(result.forward, result.expected.slice(1), 'forward tween must retain persistent marks');
    assert.deepEqual(result.entering, result.expected.slice(0,-1), 'new fixed marks wait for completion and old marks remain visible');
    assert.deepEqual(result.beforeStudio, result.studio, 'opening Studio cannot restore missing marks');
    assert.deepEqual(result.backward, result.expected.slice(0,-1).reverse(), 'reverse tween uses destination fixed state');
    assert.deepEqual(result.reload, result.expected.at(-1), 'JSON reload preserves fixed state on animated seek');
    assert.deepEqual(result.disabled, [], 'turning automatic fixed off hides all automatic marks');
    assert.deepEqual(result.manual, [0], 'manual marks remain visible while automatic fixed is off');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
