'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('saved Merge Sort frame 26 joins each initialized declaration and preserves exact gaps', async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.goto(base + '/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(() => window.ASMTracePlayer);
  const body = readPackage(fs.readFileSync(path.join(__dirname, '../public/guest-decks/merge-sort.asmdeck'))).body;
  const animation = body.deck.groups.flatMap(group => group.slides || []).find(slide => slide.animation).animation;
  for (const settings of [{ gap: 500, rate: 1 }, { gap: 0, rate: 1 }, { gap: 500, rate: 2 }, { gap: 500, rate: 1, disabled: true }]) {
    const result = await page.evaluate(async ({ trace, settings }) => {
      trace.studio.eventSettings.gapMs = settings.gap;
      const doc = ASMTracePlayer.apply(trace);
      const frame = doc.frames[25];
      const selected = frame.events.filter(event => ['i', 'j'].includes(event.name)
        || ['i = L', 'j = mid + 1'].includes(event.expression));
      if (settings.disabled) selected.filter(event => event.type === 'assign').forEach(event => { event.enabled = false; });
      window.asmGetAnimationPlaybackRate = () => settings.rate;
      window.ASMTraceCamera = { ...ASMTraceCamera, apply() {}, transitionDuration: () => 0 };
      await ASMTracePlayer.render(24, { stable: true });
      const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
      let clock = performance.now(), elapsed = 0, serial = 0;
      const callbacks = new Map(), events = [];
      window.requestAnimationFrame = callback => { callbacks.set(++serial, callback); return serial; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      const listener = e => {
        if (e.detail.phase !== 'start' || !selected.includes(e.detail.event)) return;
        events.push({ type: e.detail.event.type, name: e.detail.event.name, expression: e.detail.event.expression,
          at: elapsed, start: e.detail.slot.start, end: e.detail.slot.end, duration: e.detail.slot.duration,
          text: [...document.querySelectorAll('#traceCodePanel .is-active')].map(node => node.textContent).join('').replace(/\s+/g, '') });
      };
      window.addEventListener('asm:trace-active-event', listener);
      const restore = () => {
        window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
        if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now;
      };
      try {
        const pending = ASMTracePlayer.render(25, { fromIndex: 24, forceTransition: true });
        const total = ASMTracePlayer.getLastPlaybackPlan().totalDurationMs;
        while (elapsed < total + 100) {
          elapsed += 10; clock += 10;
          const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
          for (let n = 0; n < 10; n++) await Promise.resolve();
        }
        document.querySelectorAll('#asm-trace-root *').forEach(node => node.getAnimations?.().forEach(a => { if (a.transitionProperty) a.finish(); }));
        restore(); await pending;
        return { events };
      } finally { restore(); window.removeEventListener('asm:trace-active-event', listener); ASMTraceFrameTween.cancel(); }
    }, { trace: savedTrace(body, animation), settings });
    const events = result.events;
    assert.deepEqual(events.map(event => event.text), settings.disabled ? ['inti', 'intj'] : ['inti=L', 'intj=mid+1']);
    assert.deepEqual(events.map(event => event.duration), [220, 220]);
    for (let i = 1; i < events.length; i++) {
      assert.equal(events[i].start - events[i - 1].end, settings.gap);
      assert.ok(Math.abs(events[i].at - events[i - 1].at
        - (events[i - 1].duration + settings.gap) / settings.rate) <= 10,
      'wall-clock playback follows speed while logical event clocks stay unchanged');
    }
  }
});
