const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('automark limits each frame SVG and keeps manual marks through tween, Studio and reload', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const code = fs.readFileSync(path.join(__dirname, 'fixtures/automark.cpp'), 'utf8');
    await page.evaluate(code => ace.edit('editor').setValue(code, -1), code);
    await page.click('#runBtn');
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code, code, { timeout: 30000 });
    const result = await page.evaluate(async () => {
      const player = window.ASMTracePlayer, source = JSON.parse(JSON.stringify(player.getDocument()));
      const read = (color = '#4caf50') => [...document.querySelectorAll('#asm-trace-root .asm-trace-style-decoration')]
        .filter(wrapper => {
          const visual = wrapper.firstElementChild;
          if (!visual || visual.getAttribute('stroke') !== color) return false;
          for (let node = visual; node && node.id !== 'asm-trace-root'; node = node.parentElement) {
            if (getComputedStyle(node).display === 'none' || Number(getComputedStyle(node).opacity) === 0) return false;
          }
          return true;
        }).map(wrapper => {
          const cell = wrapper._asmStyleCell, id = cell.closest('[data-trace-variable]').dataset.traceVariable;
          return source.variables[id].name + '#' + cell.dataset.traceIndex;
        }).sort();
      const expected = [];
      for (let index = 0; index < source.frames.length; index++) {
        await player.render(index, { animatePositions: false, animateEvents: false });
        expected.push(read());
      }
      await player.render(0, { animatePositions: false, animateEvents: false });
      const forward = [];
      let enteringNone;
      for (let index = 1; index < source.frames.length; index++) {
        const transition = player.render(index);
        if (index === 3) enteringNone = { automatic: read(), manual: read('blue') };
        await transition;
        forward.push(read());
      }
      const backward = [];
      for (let index = source.frames.length - 2; index >= 0; index--) {
        await player.render(index); backward.push(read());
      }
      player.apply(JSON.parse(JSON.stringify(source)));
      await player.render(0, { animatePositions: false, animateEvents: false });
      await player.render(3);
      const reload = { automatic: read(), manual: read('blue') };
      await window.ASMTraceStudio.open();
      const studio = { automatic: read(), manual: read('blue') };
      await window.ASMTraceStudio.close();
      const disabledSource = JSON.parse(JSON.stringify(source));
      disabledSource.studio.eventSettings.autoFixedEnabled = false;
      player.apply(disabledSource);
      await player.render(2, { animatePositions: false, animateEvents: false });
      const disabled = read();
      return { expected, forward, backward, enteringNone, reload, studio, disabled };
    });
    console.log('Automark SVG:', JSON.stringify(result));
    assert.deepEqual(result.expected, [
      [], ['a#0'], ['a#0','a#1','b#0','b#1'], [], ['a#0','a#1','a#2','b#0','b#1','b#2']
    ]);
    assert.deepEqual(result.forward, result.expected.slice(1));
    assert.deepEqual(result.backward, result.expected.slice(0,-1).reverse());
    for (const state of [result.enteringNone, result.reload, result.studio]) {
      assert.deepEqual(state.automatic, []);
      assert.deepEqual(state.manual, ['b#0']);
    }
    assert.deepEqual(result.disabled, [], 'automark selection does not override the global off switch');

    const embeddedSource=await page.evaluate(()=>JSON.parse(JSON.stringify(ASMTracePlayer.getDocument())));
    embeddedSource.studio.eventSettings.autoFixedEnabled=true; // Restore fixture setting after the explicit global-off check.
    const slidePage=await browser.newPage({viewport:{width:1440,height:1000}});
    slidePage.on('pageerror',error=>errors.push(error.message));
    await slidePage.addInitScript(deck=>localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify(deck)),{groups:[{id:'embed-group',slides:[{id:'embed-slide',kind:'algorithm-animation',animation:{mode:'trace',code,traceDocument:embeddedSource},canvas:{objects:[]},widgets:[]}]}]});
    await slidePage.goto(base+'/slides.html');
    await slidePage.waitForFunction(()=>document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length);
    const runtime=slidePage.frames().find(frame=>frame.url().includes('asmEmbed=runtime'));
    assert.ok(runtime,'actual algorithm slide iframe loaded');
    const embedded=await runtime.evaluate(async () => {
      const player = window.ASMTracePlayer, source = JSON.parse(JSON.stringify(player.getDocument()));
      const read = (color = '#4caf50') => [...document.querySelectorAll('#asm-trace-root .asm-trace-style-decoration')]
        .filter(wrapper => {
          const visual = wrapper.firstElementChild;
          if (!visual || visual.getAttribute('stroke') !== color) return false;
          for (let node = visual; node && node.id !== 'asm-trace-root'; node = node.parentElement) {
            if (getComputedStyle(node).display === 'none' || Number(getComputedStyle(node).opacity) === 0) return false;
          }
          return true;
        }).map(wrapper => {
          const cell = wrapper._asmStyleCell, id = cell.closest('[data-trace-variable]').dataset.traceVariable;
          return source.variables[id].name + '#' + cell.dataset.traceIndex;
        }).sort();
      const expected = [];
      for (let index = 0; index < source.frames.length; index++) {
        await player.render(index, { animatePositions: false, animateEvents: false });
        expected.push(read());
      }
      await player.render(0, { animatePositions: false, animateEvents: false });
      const forward = [];
      let enteringNone;
      for (let index = 1; index < source.frames.length; index++) {
        const transition = player.render(index);
        if (index === 3) enteringNone = { automatic: read(), manual: read('blue') };
        await transition;
        forward.push(read());
      }
      const backward = [];
      for (let index = source.frames.length - 2; index >= 0; index--) {
        await player.render(index); backward.push(read());
      }
      player.apply(JSON.parse(JSON.stringify(source)));
      await player.render(0, { animatePositions: false, animateEvents: false });
      await player.render(3);
      const reload = { automatic: read(), manual: read('blue') };
      await window.ASMTraceStudio.open();
      const studio = { automatic: read(), manual: read('blue') };
      await window.ASMTraceStudio.close();
      const disabledSource = JSON.parse(JSON.stringify(source));
      disabledSource.studio.eventSettings.autoFixedEnabled = false;
      player.apply(disabledSource);
      await player.render(2, { animatePositions: false, animateEvents: false });
      const disabled = read();
      return { expected, forward, backward, enteringNone, reload, studio, disabled };
    });
    assert.deepEqual(embedded.expected,result.expected,'embedded automatic marks match each authored frame');
    assert.deepEqual(embedded.forward,result.forward,'embedded forward marks persist');
    assert.deepEqual(embedded.reload,result.reload,'embedded reload preserves manual and automatic marks');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
