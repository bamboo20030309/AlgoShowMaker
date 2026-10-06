const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('recursive frame 30 to 31 retains old layout position until the cell insertion', { timeout: 120000 }, async () => {
  let code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8').replace(/\r\n/g, '\n').replace(/    \/\/ @frame num\n    \/\/ @place num.top-left at split_tree.root.top-left\n    \/\/ @text [^\n]*\n/, '')
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
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const reports = await page.evaluate(async trace => {
      const reports = [];
      const frame = trace.frames[30];
      const push = frame.events.find(e => e.operation === 'push_back');
      if (!push) throw new Error('frame 31 must contain push_back');
      const geometry = () => {
        const root = document.querySelector('#asm-trace-root');
        const owner = [...root.querySelectorAll('[data-trace-variable]')].find(e =>
          !e.closest('[data-trace-snapshot]') && e.dataset.traceVariable === frame.source.primaryVariableId);
        const rect = owner.querySelector('.outerframe-bg');
        const box = rect.getBBox();
        const matrix = root.getScreenCTM().inverse().multiply(rect.getScreenCTM());
        const a = new DOMPoint(box.x, box.y).matrixTransform(matrix);
        const b = new DOMPoint(box.x + box.width, box.y + box.height).matrixTransform(matrix);
        return { x: a.x, y: a.y, width: b.x - a.x };
      };
      for (const speed of [1, 4]) for (const autoplay of [false, true]) {
        const copy = JSON.parse(JSON.stringify(trace));
        if (autoplay) {
          copy.frames = copy.frames.slice(29, 31);
          copy.frames.forEach(f => { f.texts = []; });
        }
        ASMTracePlayer.apply(copy);
        window.asmGetAnimationPlaybackRate = () => speed;
        const index = autoplay ? 1 : 30;
        await ASMTracePlayer.render(index, { stable: true });
        const after = geometry();
        await ASMTracePlayer.render(index - 1, { stable: true });
        const before = geometry();
        const samples = [];
        let done = false, pending, pushSeen = false;
        if (autoplay) document.querySelector('#playToggleBtn').click();
        else pending = ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true }).finally(() => { done = true; });
        const deadline = performance.now() + 20000;
        do {
          await new Promise(requestAnimationFrame);
          if (performance.now() > deadline) throw new Error('transition timed out');
          const event = document.querySelector('#asm-trace-root').dataset.traceActiveEventId;
          if (event === push.id) pushSeen = true;
          samples.push({ ...geometry(), phase: event === push.id ? 'push' : pushSeen ? 'after' : 'before' });
          if (autoplay) done = document.querySelector('#playToggleBtn').getAttribute('aria-pressed') !== 'true';
        } while (!done);
        if (pending) await pending;
        reports.push({ speed, autoplay, before, after, final: geometry(), samples });
      }
      return reports;
    }, trace);
    for (const report of reports) {
      assert.ok(report.after.width > report.before.width, JSON.stringify(report));
      assert.ok(Math.abs(report.after.x - report.before.x) > .1, 'fixture must exercise size-driven layout movement');
      const before = report.samples.filter(s => s.phase === 'before');
      assert.ok(before.length, 'must observe events before push');
      for (const sample of before) for (const key of ['x', 'y', 'width']) assert.ok(Math.abs(sample[key] - report.before[key]) < .1, JSON.stringify({ report, sample, key }));
      const growing = report.samples.filter(s => s.phase === 'push' && s.width > report.before.width + .1 && s.width < report.after.width - .1);
      assert.ok(growing.length, 'must observe insertion growth');
      for (const sample of growing) {
        const ratio = (sample.width - report.before.width) / (report.after.width - report.before.width);
        const expectedX = report.before.x + (report.after.x - report.before.x) * ratio;
        assert.ok(Math.abs(sample.x - expectedX) < .1, JSON.stringify({ sample, expectedX, report }));
      }
      for (const key of ['x', 'y', 'width']) assert.ok(Math.abs(report.final[key] - report.after[key]) < .1);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
