const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('linear object keeps preserve their rows through the final merge frame', { timeout: 120000 }, async () => {
  const source = fs.readFileSync('algorithm_sample/Sorting/merge_sort_bottom_up.cpp', 'utf8')
    .replace(/(\/\/ @frame[^\n]*\n)/g, '$1    // @camera focus num\n');
  const { trace } = await compile(source, '10\n5 7 2 1 9 3 6 8 10 4\n');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    await page.waitForFunction(() => window.ASMTracePlayer);
    const result = await page.evaluate(async trace => {
      ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
      const boxes = () => {
        const root = document.querySelector('#asm-trace-root');
        return [...root.querySelectorAll(':scope > [data-trace-snapshot]')].map(node => {
          const rect = node.querySelector('.outerframe-bg');
          const box = rect.getBBox();
          const matrix = root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
          const point = new DOMPoint(box.x, box.y).matrixTransform(matrix);
          return { id: node.dataset.traceSnapshot, x: point.x, y: point.y,
            height: box.height, transform: node.getAttribute('transform') };
        });
      };
      const last = trace.frames.length - 1;
      await ASMTracePlayer.renderStable(last);
      const stable = boxes();
      const runs = [];
      for (const rate of [1, 4]) {
        await ASMTracePlayer.renderStable(last - 2);
        window.asmGetAnimationPlaybackRate = () => rate;
        await ASMTracePlayer.render(last - 1, { fromIndex: last - 2, forceTransition: true });
        await ASMTracePlayer.render(last, { fromIndex: last - 1, forceTransition: true });
        runs.push({ rate, boxes: boxes() });
      }
      const loaded = ASMTracePlayer.getDocument();
      ASMTraceStudio.open();
      await new Promise(requestAnimationFrame);
      const studio = boxes();
      const thumbnail = ASMTraceRenderers.createThumbnail(loaded, loaded.frames[last], loaded.frames[last-1]);
      // LOD may omit offscreen glyphs; its rendered cell records retain values.
      const snapshotValues = [...thumbnail.querySelectorAll('[data-trace-thumbnail-root] > [data-trace-snapshot]')]
        .map(node => [...node.querySelectorAll('[data-asm-lod]')]
          .flatMap(group => group._asmLod?.records || [])
          .filter(record => record.cell.hasAttribute('data-trace-index'))
          .map(record => record.value));
      document.body.append(thumbnail);
      const thumbRows = [...thumbnail.querySelectorAll('[data-trace-thumbnail-root] > [data-trace-snapshot]')]
        .map(node => node.getAttribute('transform'));
      thumbnail.remove();
      ASMTraceStudio.close();
      // Persist/reopen the legacy spelling without adding new snapshot fields.
      const legacy = JSON.parse(JSON.stringify(trace));
      legacy.layouts.forEach(layout => { if (layout.type === 'linear') layout.type = 'line'; });
      ASMTracePlayer.apply(legacy);
      await ASMTracePlayer.renderStable(last);
      return { stable, runs, studio, legacy: boxes(), thumbRows, snapshotValues, frames: trace.frames.length };
    }, trace);
    console.log(JSON.stringify({ frames: result.frames, rows: result.stable.length,
      rates: result.runs.map(run => run.rate), snapshotValues: result.snapshotValues }));
    assert.ok(result.stable.length >= 4);
    for (const actual of [...result.runs.flatMap(run => run.boxes), ...result.studio, ...result.legacy]) {
      const expected = result.stable.find(box => box.id === actual.id);
      assert.ok(Math.abs(actual.x - expected.x) < 0.1, `${actual.id}: x changed`);
      assert.ok(Math.abs(actual.y - expected.y) < 0.1, `${actual.id}: row changed`);
    }
    for (let i = 1; i < result.stable.length; i++) {
      const previous = result.stable[i - 1], current = result.stable[i];
      assert.ok(current.y >= previous.y + previous.height + 69, 'kept rows overlap');
    }
    assert.equal(new Set(result.thumbRows).size, result.stable.length);
    assert.deepEqual(result.snapshotValues[0], ['5','7','2','1','9','3','6','8','10','4']);
    assert.deepEqual(result.snapshotValues.at(-1), ['1','2','3','4','5','6','7','8','9','10']);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
