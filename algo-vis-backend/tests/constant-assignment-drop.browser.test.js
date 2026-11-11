'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright'), { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');

test('constant and invisible sources fall from above for assignment and compound assignment', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try { process.env.ASM_TEST_BASE_URL = base; ({ trace } = await compile('int main(){int result=5,hidden=7,shown=4;\n'
    + '// @frame result,shown when hidden>=0\nresult=3;result+=2;result=hidden;result+=hidden;\n'
    + '// @frame result,shown when hidden>=0\n// @frame result,shown\n}')); }
  finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage();
  await page.goto(base + '/algorithm.html?asmEmbed=runtime'); await page.waitForFunction(() => window.ASMTracePlayer);
  for (const speed of [1, 4]) {
    const report = await page.evaluate(async ({ trace, speed }) => {
      const doc = ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace))); window.asmGetAnimationPlaybackRate = () => speed;
      await ASMTracePlayer.render(0, { stable: true });
      const id = Object.keys(doc.variables).find(id => doc.variables[id].name === 'result');
      const read = () => {
        const root = document.getElementById('asm-trace-root'), inverse = root.getScreenCTM().inverse();
        const target = root.querySelector(`[data-trace-object-key="${CSS.escape(id + '#0')}"] text[data-trace-content-role="value"]`);
        const bounds = target.getBoundingClientRect(), center = new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2).matrixTransform(inverse);
        return { event: root.dataset.traceActiveEventId, value: target.textContent, targetX: center.x,
          groups: [...root.querySelectorAll('.asm-trace-assign-literal-value')].map(group => {
            const text = group.querySelector('text'), box = text.getBoundingClientRect();
            const point = new DOMPoint(box.x + box.width / 2, box.y + box.height / 2).matrixTransform(inverse);
            return { text: text.textContent, x: point.x, y: point.y, opacity: Number(group.getAttribute('opacity')) };
          }) };
      };
      const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
      let clock = performance.now(), elapsed = 0, serial = 0; const callbacks = new Map(), samples = [];
      window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      const restore = () => { window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
        if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now; };
      try {
        const pending = ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true }), plan = ASMTracePlayer.getLastPlaybackPlan();
        while (elapsed < plan.totalDurationMs / speed + 100) {
          elapsed += 16; clock += 16; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
          for (let i = 0; i < 12; i++) await Promise.resolve(); samples.push(read());
        }
        restore(); await pending; return { samples, final: read() };
      } finally { restore(); ASMTraceFrameTween.cancel(); }
    }, { trace, speed });
    fs.mkdirSync('test-results/constant-assignment-drop', { recursive: true });
    fs.writeFileSync(`test-results/constant-assignment-drop/${speed}.json`, JSON.stringify(report));
    const events = trace.frames[1].events.filter(event => ['assign', 'write'].includes(event.type));
    assert.equal(events.length, 4);
    for (const [index, event] of events.entries()) {
      const samples = report.samples.filter(sample => sample.event === event.id && sample.groups.length);
      assert.ok(samples.length > 3);
      assert.ok(samples.every(sample => sample.groups[0].text === ['3', '2', '7', '7'][index]), 'retain the actual constant/hidden operand');
      const ys = samples.map(sample => sample.groups[0].y);
      assert.ok(Math.max(...ys) - Math.min(...ys) > 20, 'number must travel down rather than stay in place');
      assert.ok(ys.every((value, i) => !i || value >= ys[i - 1] - .01), 'descent is monotonic');
      assert.ok(samples.every(sample => Math.abs(sample.groups[0].x - sample.targetX) < 1), 'falling value stays aligned with target');
    }
    assert.equal(report.final.value, '14'); assert.deepEqual(report.final.groups, []);
  }
});
