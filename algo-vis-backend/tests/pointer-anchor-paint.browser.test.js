const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('part(38) pointer anchors stay unpainted across frames 8 to 9 and the following merge', { timeout: 120000 }, async () => {
  const code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const { trace } = await compile(code, '10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const report = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      const source = trace.snapshots.find(snapshot => snapshot.layoutId === 'merge_tree'
        && Number(window.ASMTraceRules.resolveExpression(trace, snapshot.frame, 'L')) === 0
        && Number(window.ASMTraceRules.resolveExpression(trace, snapshot.frame, 'R')) === 0
        && JSON.stringify(snapshot.frame.state[snapshot.frame.source.primaryVariableId].data.items).includes('38'));
      if (!source) throw new Error('part(38) snapshot missing');
      const violations = [];
      let samples = 0, anchors = 0;
      let autoplayRuns = 0;
      for (const speed of [1, 4]) {
        window.asmGetAnimationPlaybackRate = () => speed;
        await window.ASMTracePlayer.render(6, { stable: true });
        await window.ASMTracePlayer.render(7, { fromIndex: 6, forceTransition: true });
        for (const index of [8, 9]) {
          let done = false;
          const sample = () => {
            const root = document.querySelector('#asm-trace-root');
            const node = [...root.querySelectorAll('[data-trace-snapshot]')]
              .find(element => element.dataset.traceSnapshot === source.id);
            // Comparison temporarily promotes the exact retained cell to
            // the event layer; its snapshot owner can legitimately be empty.
            const liftedCell = [...root.querySelectorAll('[data-trace-compare-motion="1"]')]
              .find(cell => cell.dataset.traceCompareSnapshot === source.id && cell.dataset.traceIndex === '0');
            if (!node || !(liftedCell || node).textContent.includes('38')) violations.push({ speed, index, reason: 'retained value missing' });
            for (const anchor of root.querySelectorAll('[data-trace-anchor-only="1"]')) {
              anchors++;
              const rect = anchor.querySelector('rect');
              if (rect?.getAttribute('fill') !== 'none'
                || (rect.hasAttribute('fill-opacity') && Number(rect.getAttribute('fill-opacity')) !== 0)
                || anchor.querySelector('.asm-trace-motion')
                || anchor.getAttribute('opacity') === '0') {
                violations.push({ speed, index, event: root.dataset.traceActiveEventId,
                  key: anchor.dataset.traceObjectKey, fill: rect?.getAttribute('fill') });
              }
            }
            samples++;
          };
          // Catch both synchronous projection writes and actual browser paints.
          const observer = new MutationObserver(sample);
          observer.observe(document.querySelector('#asm-trace-root'), { subtree: true, childList: true, attributes: true });
          const transition = window.ASMTracePlayer.render(index, { fromIndex: index-1, forceTransition: true })
            .finally(() => { done = true; });
          while (!done) { await new Promise(requestAnimationFrame); sample(); }
          await transition;
          observer.disconnect();
          sample();
        }
      }
      // Use the real Play control on the same short animation segment. Text
      // narration is outside this paint test and is omitted from the fixture.
      for (const speed of [1, 4]) {
        const short = JSON.parse(JSON.stringify(trace));
        short.frames = short.frames.slice(0, 10);
        short.frames.forEach(frame => { frame.texts = []; });
        short.snapshots.forEach(snapshot => { if (snapshot.frame) snapshot.frame.texts = []; });
        short.studio.eventSettings = { ...(short.studio.eventSettings || {}), gapMs: 0 };
        window.ASMTracePlayer.apply(short);
        window.asmGetAnimationPlaybackRate = () => speed;
        await window.ASMTracePlayer.render(7, { stable: true });
        const button = document.getElementById('playToggleBtn');
        button.click();
        const started = performance.now();
        while (button.getAttribute('aria-pressed') === 'true') {
          await new Promise(requestAnimationFrame);
          for (const rect of document.querySelectorAll('#asm-trace-root [data-trace-anchor-only="1"] rect')) {
            if (rect.getAttribute('fill') !== 'none') violations.push({ speed, autoplay: true, fill: rect.getAttribute('fill') });
            anchors++;
          }
          samples++;
          if (performance.now()-started > 20000) { button.click(); throw new Error('autoplay did not finish the segment'); }
        }
        if (window.ASMTracePlayer.getCurrentFrame() !== 9) throw new Error('autoplay stopped at wrong frame');
        autoplayRuns++;
      }
      return { samples, anchors, violations, autoplayRuns,
        renderer: document.documentElement.dataset.asmTraceRendererBuild,
        tween: document.documentElement.dataset.asmTraceFrameTweenBuild };
    }, trace);
    assert.ok(report.samples > 30 && report.anchors > 30, JSON.stringify(report));
    assert.deepEqual(report.violations, []);
    assert.equal(report.renderer, 'trace-258');
    assert.equal(report.tween, 'trace-291');
    assert.equal(report.autoplayRuns, 2);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
