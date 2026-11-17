'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');

test('input assignment uses ordinary assignment animation, survives reload and has an independent switch', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile('#include <iostream>\nusing namespace std;\nint main(){int x=2;\n// @frame x\ncin>>x; x=9;\n// @frame x\n}', '7'));
  } finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime'); await page.waitForFunction(() => window.ASMTracePlayer);
  for (const disabled of [false, true]) {
    const report = await page.evaluate(async ({ trace, disabled }) => {
      const saved = JSON.parse(JSON.stringify(trace)); saved.studio ||= {};
      saved.studio.eventSettings = { gapMs: 137, defaultEnabled: disabled ? { 'input-assign': false } : {} };
      const doc = ASMTracePlayer.apply(saved); window.asmGetAnimationPlaybackRate = () => 1;
      await ASMTracePlayer.render(0, { stable: true });
      const input = doc.frames[1].events.find(event => event.type === 'input-assign');
      const assignment = doc.frames[1].events.find(event => event.type === 'assign');
      const id = Object.keys(doc.variables).find(id => doc.variables[id].name === 'x');
      const read = () => ({ value: document.querySelector(`[data-trace-object-key="${CSS.escape(id + '#0')}"] text[data-trace-content-role="value"]`)?.textContent,
        active: document.getElementById('asm-trace-root').dataset.traceActiveEventId,
        flying: [...document.querySelectorAll('.asm-trace-assign-transfer text')].map(node => node.textContent) });
      const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
      let clock = performance.now(), elapsed = 0, serial = 0; const callbacks = new Map(), samples = [];
      window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      const restore = () => { window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
        if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now; };
      try {
        const pending = ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true }), plan = ASMTracePlayer.getLastPlaybackPlan();
        while (elapsed < plan.totalDurationMs + 100) {
          elapsed += 16; clock += 16; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
          for (let i = 0; i < 12; i++) await Promise.resolve(); samples.push({ at: elapsed, ...read() });
        }
        restore(); await pending;
        const exported = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
        ASMTracePlayer.apply(exported); await ASMTracePlayer.render(1, { stable: true });
        return { samples, inputId: input.id, assignmentEnabled: assignment.enabled,
          mode: plan.forwardReplay.checkpoints.find(point => point.eventId === input.id).mode,
          commit: plan.forwardReplay.checkpoints.find(point => point.eventId === input.id).commitMs,
          final: read(), gap: ASMTracePlayer.getDocument().studio.eventSettings.gapMs,
          label: ASMTraceEvents.definition('input-assign').label,
          reopenedEnabled: ASMTracePlayer.getDocument().frames[1].events.find(event => event.type === 'input-assign').enabled };
      } finally { restore(); ASMTraceFrameTween.cancel(); }
    }, { trace, disabled });
    assert.equal(report.final.value, '9'); assert.equal(report.gap, 137); assert.equal(report.label, '輸入賦值事件');
    assert.equal(report.assignmentEnabled, true, 'the ordinary assignment switch remains independent');
    assert.equal(report.reopenedEnabled, !disabled, 'explicit input switch survives export and reload');
    assert.equal(report.mode, disabled ? 'instant' : 'animated');
    if (!disabled) {
      const active = report.samples.filter(sample => sample.active === report.inputId);
      assert.ok(active.some(sample => sample.flying.includes('7')), 'input value 7 uses the ordinary falling assignment transfer');
      assert.ok(active.filter(sample => sample.at < report.commit).every(sample => sample.value === '2'), 'old value stays until input commits');
      assert.ok(active.some(sample => sample.value === '7'), 'input commits before the later ordinary assignment');
    }
  }
  assert.deepEqual(errors, []);
});
