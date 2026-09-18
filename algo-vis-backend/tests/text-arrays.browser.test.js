const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('array text interpolation renders in SVG, TTS, Studio and after snapshot replay', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const source = fs.readFileSync(path.join(__dirname, 'fixtures/text-arrays.cpp'), 'utf8');
    await page.evaluate(code => ace.edit('editor').setValue(code, -1), source);
    await page.click('#runBtn');
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code, source, { timeout: 30000 });
    const result = await page.evaluate(async () => {
      const player = window.ASMTracePlayer, original = JSON.parse(JSON.stringify(player.getDocument()));
      const read = () => Object.fromEntries([...document.querySelectorAll('#asm-trace-root [data-trace-text-id]')]
        .filter(node => !node.closest('.asm-trace-transition-ghost-motion'))
        .map(node => [node.dataset.traceTextId, {
          text: [...node.querySelectorAll('.asm-trace-text-segment-value')].map(segment => segment.textContent).join(''),
          speech: JSON.parse(node.getAttribute('data-tts-lines') || '[]').join(''),
          fonts: [...node.querySelectorAll('.asm-trace-text-segment-value')].map(segment => segment.getAttribute('font-size'))
        }]));
      const render = async index => { await player.render(index, { animatePositions: false, animateEvents: false }); return read(); };
      const first = await render(0);
      const last = await render(original.frames.length - 1);
      const back = await render(0);
      const indices = original.frames.map((frame, index) => frame.texts.some(text => text.id === 'completed') ? index : -1).filter(index => index >= 0);
      const completed = [];
      for (const index of indices) completed.push(await render(index));
      player.apply(JSON.parse(JSON.stringify(original)));
      const reload = await render(indices[1]);
      await window.ASMTraceStudio.open();
      await player.render(0, { animatePositions: false, animateEvents: false });
      const studio = read();
      return { first, last, back, completed, reload, studio };
    });
    const expected = {
      full: '11*[2,3,5,7]', slice: '[3,5]', c_array: '[10,20,30,40]',
      nested: '[[2,3],[5,7]]', strings: '["a","b"]', empty_array: '[]',
      json_text: '範圍：[3,5]', spoken: '11*[2,3,5,7]'
    };
    for (const state of [result.first, result.back, result.studio])
      for (const [id, text] of Object.entries(expected)) assert.equal(state[id]?.text, text, id);
    assert.ok(result.first.json_text.fonts.every(font => font === '18'));
    assert.equal(result.first.spoken.speech, '質數清單 [3,5]');
    assert.equal(result.last.full.text, '11*[2,3,5,7,11]');
    assert.deepEqual(result.completed.map(state => state.completed.text), ['[2,3]', '[2,3,5]']);
    assert.equal(result.reload.completed.text, '[2,3,5]');
    const rowTexts = Object.entries(result.reload).filter(([id]) => id.startsWith('row')).map(([, value]) => value.text);
    assert.deepEqual(rowTexts.sort(), ['[2,3]', '[5,7]']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
