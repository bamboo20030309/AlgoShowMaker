const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('frame 11 to 12 marks belong to their cells, not same-alias kept leaves', { timeout: 120000 }, async () => {
  let code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8')
    .replace(/as res\b/g, 'as merged')
    .replace('int i = L;\n    int j = mid + 1;', 'int i = L, j = mid + 1;')
    .replace('merged.push_back(num[i++]);', 'merged.push_back(num[i]);\n            i++;')
    .replace('merged.push_back(num[j++]);', 'merged.push_back(num[j]);\n            j++;')
    .replace('// @style num[L:R] background AV_green!', '// @style num[L] mark')
    .replace('// @style num[L:R] background AV_green!', '// @style num[L:R] mark')
    .replace('in merge_scene color AV_green! width 2', 'in merge_scene')
    .replace('// @text "補上左側剩餘元素"', '// @style merged[0:merged.size()-2] mark\n        // @text "補上左側剩餘元素"')
    .replace('// @text "補上右側剩餘元素"', '// @style merged[0:merged.size()-2] mark\n        // @text "補上右側剩餘元素"');
  code += '\n/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}\n@asm-view */';
  const { trace } = await compile(code, '10\n38 27 43 3 9 82 10 19 84 60\n');
  assert.equal(trace.frames[11].styles[0].styleType, 'mark');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      const visible = node => {
        for (let p = node; p && p.id !== 'asm-trace-root'; p = p.parentElement) {
          const style = getComputedStyle(p);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        }
        return true;
      };
      const marks = () => [...document.querySelectorAll('[data-trace-attachment-kind="mark"]')]
        .filter(v => v.dataset.traceAttachedTo?.startsWith('merged#'))
        .map(v => ({ live: !v.closest('.asm-trace-style-decoration')?._asmStyleCell?.closest('[data-trace-snapshot]'), visible: visible(v), color: v.getAttribute('stroke') }));
      const reports = [];
      for (const speed of [1, 4]) for (const autoplay of [false, true]) {
        const copy = JSON.parse(JSON.stringify(trace));
        if (autoplay) {
          copy.frames = copy.frames.slice(10, 12);
          copy.frames.forEach(f => { f.texts = []; });
        }
        ASMTracePlayer.apply(copy);
        window.asmGetAnimationPlaybackRate = () => speed;
        const index = autoplay ? 1 : 11;
        await ASMTracePlayer.render(index, { stable: true });
        const stable = marks();
        await ASMTracePlayer.render(index - 1, { stable: true });
        if (autoplay) {
          document.querySelector('#playToggleBtn').click();
          const deadline = performance.now() + 20000;
          do {
            await new Promise(requestAnimationFrame);
            if (performance.now() > deadline) throw new Error('autoplay timeout');
          } while (document.querySelector('#playToggleBtn').getAttribute('aria-pressed') === 'true');
        } else await ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true });
        reports.push({ speed, autoplay, stable, after: marks() });
      }
      // Load/save/reopen uses no new trace fields. Explicit disabled settings
      // survive; DOM attachment ownership is reconstructed by the renderer.
      const saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved);
      await ASMTracePlayer.render(1, { stable: true });
      const root = document.querySelector('#asm-trace-root');
      const cell = [...root.querySelectorAll('[data-trace-index]')]
        .find(c => !c.closest('[data-trace-snapshot]') && c.dataset.traceObjectKey === 'merged#0');
      const kept = [...root.querySelectorAll('[data-trace-attachment-kind="mark"]')]
        .filter(v => v.closest('.asm-trace-style-decoration')?._asmStyleCell?.closest('[data-trace-snapshot]'));
      const before = kept.map(v => v.outerHTML);
      ASMTraceRenderers.updatePresentedHints(cell, { styleTypes: { mark: '#123456', point: '#345678', highlight: '#567890' } }, 'merged#0');
      const custom = [...root.querySelectorAll('[data-trace-attached-to="merged#0"]')]
        .filter(v => v.closest('.asm-trace-style-decoration')?._asmStyleCell === cell)
        .map(v => ({ kind: v.dataset.traceAttachmentKind, color: v.getAttribute(v.dataset.traceAttachmentKind === 'point' ? 'fill' : 'stroke'), visible: visible(v) }));
      ASMTraceRenderers.updatePresentedHints(cell, {}, 'merged#0');
      return { reports, custom, keptUnchanged: kept.every((v, i) => v.outerHTML === before[i]), disabled: ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled === false };
    }, trace);
    for (const report of result.reports) for (const phase of ['stable', 'after']) {
      const marks = report[phase];
      assert.equal(marks.filter(m => m.live).length, 2, JSON.stringify(report));
      assert.ok(marks.every(m => m.visible), JSON.stringify(report));
    }
    assert.equal(result.keptUnchanged, true);
    assert.equal(result.disabled, true);
    assert.deepEqual(result.custom.sort((a, b) => a.kind.localeCompare(b.kind)), [
      { kind: 'highlight', color: '#567890', visible: true },
      { kind: 'mark', color: '#123456', visible: true },
      { kind: 'point', color: '#345678', visible: true }
    ]);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
