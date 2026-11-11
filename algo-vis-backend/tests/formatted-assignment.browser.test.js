'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');

test('all field formats travel with their value rather than appearing as stationary prefixes', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  const view = '// @frame base render segment_tree with range(1,n), fields(base,delta,assigned,bits,hexes,flags,decimals,ratios), format(delta=signed,assigned=assign,bits=binary,hexes=hex,flags=bool,decimals=fixed(2),ratios=percent(1))\n';
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile('#include <vector>\nusing namespace std;\nint main(){int n=1;\n'
      + 'vector<double>base={0,1},delta={0,0},assigned={0,0},bits={0,0},hexes={0,0},flags={0,0},decimals={0,0},ratios={0,0};\n'
      + view + 'delta[1]=3;assigned[1]=7;bits[1]=5;hexes[1]=10;flags[1]=1;decimals[1]=1.25;ratios[1]=0.25;delta[1]=-2;\n'
      + view + view + '}'));
  } finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage();
  await page.goto(base + '/algorithm.html?asmEmbed=runtime'); await page.waitForFunction(() => window.ASMTracePlayer);
  for (const speed of [1, 4]) {
    const report = await page.evaluate(async ({ trace, speed }) => {
      ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace))); window.asmGetAnimationPlaybackRate = () => speed;
      await ASMTracePlayer.render(0, { stable: true });
      const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
      let clock = performance.now(), elapsed = 0, serial = 0; const callbacks = new Map(), moving = new Set(); let detachedPrefix = false;
      window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      const restore = () => { window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
        if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now; };
      try {
        const pending = ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true });
        const duration = ASMTracePlayer.getLastPlaybackPlan().totalDurationMs / speed;
        while (elapsed < duration + 100) {
          elapsed += 16; clock += 16; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
          for (let i = 0; i < 12; i++) await Promise.resolve();
          for (const node of document.querySelectorAll('.asm-trace-assign-transfer text')) {
            let opacity = 1; for (let p = node; p?.nodeType === 1; p = p.parentElement) opacity *= Number(getComputedStyle(p).opacity);
            if (opacity > .01) moving.add(node.textContent);
          }
          detachedPrefix ||= Boolean(document.querySelector('[data-trace-field-adornment="prefix"]'));
        }
        restore(); await pending;
        return { moving: [...moving], detachedPrefix };
      } finally { restore(); ASMTraceFrameTween.cancel(); }
    }, { trace, speed });
    for (const value of ['+3', '=7', '0b101', '0xA', 'true', '1.25', '25.0%', '-2']) {
      assert.ok(report.moving.includes(value), 'moving text must include complete format ' + value + ': ' + report.moving.join(', '));
    }
    assert.equal(report.detachedPrefix, false, 'no stationary format prefix is created');
  }
});
