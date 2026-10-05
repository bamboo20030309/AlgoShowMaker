const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('text on the final empty merge frame resolves the kept root and survives reopening', { timeout: 60000 }, async () => {
  let code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8').replace(/\r\n?/g, '\n')
    .replace(/\/\/ @defaults[\s\S]*?\/\/ @enddefaults\r?\n/, '')
    .replace(/as res\b/g, 'as merged')
    .replace('int i = L;\n    int j = mid + 1;', 'int i = L, j = mid + 1;')
    .replace('merged.push_back(num[i++]);', 'merged.push_back(num[i]);\n            i++;')
    .replace('merged.push_back(num[j++]);', 'merged.push_back(num[j]);\n            j++;')
    .replace('// @style num[L:R] background AV_green!', '// @style num[L] mark')
    .replace('// @style num[L:R] background AV_green!', '// @style num[L:R] mark')
    .replace('in merge_scene color AV_green! width 2', 'in merge_scene')
    .replace('// @text "補上左側剩餘元素"', '// @style merged[0:merged.size()-2] mark\n        // @text "補上左側剩餘元素"')
    .replace('// @text "補上右側剩餘元素"', '// @style merged[0:merged.size()-2] mark\n        // @text "補上右側剩餘元素"')
    .replace(/\/\/ @frame num in merge_scene[\s\S]*?return 0;/, '// @frame\n    // @text "Merge Sort 完成" at merge_tree.root.bottom\n    return 0;');
  code = '// @defaults\n// @camera auto\n// @enddefaults\n' + code;
  code += '\n/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"eventInstructionStates":{"return:main:return 0;":false},"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}\n@asm-view */';
  const { trace } = await compile(code, '10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const result = await page.evaluate(async trace => {
      const inspect = () => {
        const root = document.querySelector('#asm-trace-root');
        const rootActivation = trace.frames.find(f => f.source.layoutId === 'split_tree').source.recursionActivationId;
        const node = [...root.querySelectorAll('[data-trace-layout-id="merge_tree"]')]
          .find(e => e.dataset.traceLayoutActivation === rootActivation);
        const rect = node?.querySelector('.outerframe-bg');
        const text = [...root.querySelectorAll('.asm-trace-text-object')].find(e => e.textContent.includes('Merge Sort 完成'));
        if (!rect || !text) throw new Error('missing kept root or final text');
        const box = element => {
          const r = element.getBBox();
          const m = root.getScreenCTM().inverse().multiply(element.getScreenCTM());
          const a = new DOMPoint(r.x, r.y).matrixTransform(m);
          const b = new DOMPoint(r.x + r.width, r.y + r.height).matrixTransform(m);
          return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
        };
        return { node: box(rect), text: box(text), visible: getComputedStyle(text).display !== 'none', unavailable: text.dataset.traceBindingUnavailable || '' };
      };
      const reports = [];
      for (const speed of [1, 4]) for (const autoplay of [false, true]) {
        const copy = JSON.parse(JSON.stringify(trace));
        if (autoplay) { copy.frames = copy.frames.slice(-2); copy.frames.forEach(f => f.texts.forEach(t => t.segments.forEach(s => { s.speech = ''; }))); }
        ASMTracePlayer.apply(copy);
        window.asmGetAnimationPlaybackRate = () => speed;
        const index = copy.frames.length - 1;
        await ASMTracePlayer.render(index - 1, { stable: true });
        if (autoplay) {
          document.querySelector('#playToggleBtn').click();
          const deadline = performance.now() + 15000;
          do { await new Promise(requestAnimationFrame); if (performance.now() > deadline) throw new Error('autoplay timeout'); }
          while (document.querySelector('#playToggleBtn').getAttribute('aria-pressed') === 'true');
        } else await ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true });
        reports.push({ speed, autoplay, ...inspect() });
      }
      // Existing traces already store the dotted object key, with no extra
      // node-selector fields. Reopen that legacy representation directly.
      const saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved);
      await ASMTracePlayer.render(saved.frames.length - 1, { stable: true });
      reports.push({ reopened: true, ...inspect() });
      const indexed = JSON.parse(JSON.stringify(saved));
      const binding = indexed.frames.at(-1).texts[0].binding;
      binding.targetObjectKey = 'merge_tree.nodes'; binding.targetName = 'merge_tree.nodes'; binding.indexExpressions = ['0'];
      ASMTracePlayer.apply(indexed);
      await ASMTracePlayer.render(indexed.frames.length - 1, { stable: true });
      reports.push({ indexed: true, ...inspect() });
      return { reports, disabled: ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled === false };
    }, trace);
    for (const report of result.reports) {
      assert.equal(report.visible, true, JSON.stringify(report));
      assert.equal(report.unavailable, '');
      assert.ok(Math.abs(report.text.y - report.node.y - report.node.height - 8) < .1, JSON.stringify(report));
      assert.ok(Math.abs(report.text.x + report.text.width / 2 - report.node.x - report.node.width / 2) < .1, JSON.stringify(report));
    }
    assert.equal(result.disabled, true);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
