'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('segment tree page 23 first input lands on the destination text baseline', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const body = readPackage(fs.readFileSync('public/guest-decks/segment-tree-teaching.asmdeck')).body;
  const slide = body.deck.groups.flatMap(group => group.slides)[22];
  assert.ok(slide.animation.code.includes('void build()'));
  const previous = process.env.ASM_TEST_BASE_URL;
  let fresh;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace: fresh } = await compile(slide.animation.code, slide.animation.input));
  } finally {
    if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous;
  }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime'); await page.waitForFunction(() => window.ASMTracePlayer);
  // Fresh input events exercise the exact first leaf write. The saved fixture
  // still exercises its first ordinary computed assignment without rebuilding it.
  for (const [kind, trace] of [['fresh', fresh], ['saved', savedTrace(body, slide.animation)]]) {
    const from = kind === 'fresh' ? 0 : trace.frames.findIndex((frame, i) => i + 1 < trace.frames.length
      && trace.frames[i + 1].events.some(event => ['assign','write'].includes(event.type) && event.targets?.some(target => (target.role === 'destination' || target.role === 'target') && target.variableId.startsWith('global:tree'))));
    for (const speed of [1, 4]) {
      const report = await page.evaluate(async ({ trace, speed, from }) => {
        const doc = ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
        window.asmGetAnimationPlaybackRate = () => speed;
        await ASMTracePlayer.render(from, { stable: true });
        const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
        let clock = performance.now(), elapsed = 0, serial = 0; const callbacks = new Map(), samples = [];
        requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
        cancelAnimationFrame = id => callbacks.delete(id);
        Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
        const restore = () => { requestAnimationFrame = native.raf; cancelAnimationFrame = native.cancel;
          if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now; };
        try {
          const pending = ASMTracePlayer.render(from + 1, { fromIndex: from, forceTransition: true });
          const plan = ASMTracePlayer.getLastPlaybackPlan();
          while (elapsed < plan.totalDurationMs / speed + 100) {
            elapsed += 4; clock += 4; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
            for (let i = 0; i < 12; i++) await Promise.resolve();
            const root = document.getElementById('asm-trace-root');
            for (const group of root.querySelectorAll('.asm-trace-assign-transfer-value')) {
              const flying = group.querySelector('text'), flyingBox = flying.getBoundingClientRect();
              const event = trace.frames[from + 1].events.find(event => event.id === root.dataset.traceActiveEventId);
              const target = event?.targets.find(target => !String(target.role).startsWith('source'));
              if (!target) continue;
              const cell = root.querySelector(`[data-trace-object-key="${CSS.escape(target.variableId + '#' + target.resolvedIndex)}"]`);
              const text = cell?.querySelector('text[data-trace-content-role="value"]');
              if (!text) continue;
              const old = text.textContent; text.textContent = flying.textContent;
              const settled = text.getBoundingClientRect(); text.textContent = old;
              const rootScale = Math.hypot(root.getScreenCTM().c, root.getScreenCTM().d);
              samples.push({ event: event.id, text: flying.textContent, dy: (flyingBox.y - settled.y) / rootScale,
                heightDelta: (flyingBox.height - settled.height) / rootScale });
            }
          }
          restore(); await pending;
          return { samples, from };
        } finally { restore(); ASMTraceFrameTween.cancel(); }
      }, { trace, speed, from });
      fs.mkdirSync('test-results/assignment-baseline', { recursive: true });
      fs.writeFileSync(`test-results/assignment-baseline/${kind}-${speed}.json`, JSON.stringify(report));
      assert.ok(report.samples.length, `${kind}: must observe an actual moving value`);
      if (kind === 'fresh') {
        assert.equal(report.from, 0, 'exact first animation transition');
        assert.ok(report.samples.every(sample => sample.text === '1'), 'first input value is 1');
      }
      const events = new Set(report.samples.map(sample => sample.event));
      for (const event of events) {
        const samples = report.samples.filter(sample => sample.event === event);
        const last = samples.at(-1);
        assert.ok(Math.abs(last.dy) < .5, `${kind} ${event}: last airborne glyph must meet target, dy=${last.dy}`);
        assert.ok(samples.every(sample => Math.abs(sample.heightDelta) < .1), `${kind}: same glyph size throughout fall`);
      }
    }
  }
  assert.deepEqual(errors, []);
});

