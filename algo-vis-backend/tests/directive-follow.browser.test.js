'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');

const code = '#include <vector>\nint main(){std::vector<int>a={10,20,30,40,50};std::vector<int>b={0};int i=0,k=0;\n'
  + '// @frame a,b\n// @text "index = ${i+k}" at a.bottom\n'
  + '// @arrow from b[0] to a[i+k] as "follow"\n// @style a[i+k] highlight\n// @style a[4] mark\n'
  + 'b[0]=7;i=1;b[0]=8;k=2;a[2]=9;\n// @frame a,b\n// @let idx=i+k\n'
  + '// @text "index = ${idx}" at a.bottom\n// @text "positive" at a.top when k>0\n// @text "wide ${i*1000+k}" at a.bottom offset(0,40)\n'
  + '// @arrow from b[0] to a[i+k] as "follow"\n// @style a[i+k] highlight\n// @style a[4] mark\n// @frame a,b\n}';

test('text, arrow and variable-index style follow their own events, including disabled events and pause', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try { process.env.ASM_TEST_BASE_URL = base; ({ trace } = await compile(code)); }
  finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime'); await page.waitForFunction(() => window.ASMTracePlayer);
  for (const disabled of [false, true]) for (const speed of [1, 2]) {
    const document = JSON.parse(JSON.stringify(trace));
    document.studio.objectStyles ||= {};
    document.studio.objectStyles[document.frames[1].id] ||= {};
    document.studio.objectStyles[document.frames[1].id]['text:line-13'] = { fontSize: 22 };
    if (disabled) {
      document.studio.eventInstructionStates ||= {};
      document.studio.eventInstructionStates['assign:main:i=1'] = false;
      const changed = document.frames[1].events.filter(event => event.type === 'assign' && event.expression.replace(/\s/g, '') === 'i=1');
      assert.equal(changed.length, 1);
      changed
        .forEach(event => { event.enabled = false; });
    }
    const report = await page.evaluate(async ({ trace, speed }) => {
      ASMTracePlayer.apply(trace); window.asmGetAnimationPlaybackRate = () => speed;
      await ASMTracePlayer.render(0, { stable: true });
      const a = Object.keys(trace.variables).find(id => trace.variables[id].name === 'a');
      const visible = node => { for (let n = node; n?.nodeType === 1; n = n.parentElement) {
        const style = getComputedStyle(n); if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      } return true; };
      const read = () => {
        const root = document.getElementById('asm-trace-root');
        const texts = [...root.querySelectorAll('.asm-trace-text-object')].filter(visible).map(node => node.textContent);
        const arrows = [...root.querySelectorAll('[data-trace-arrow="follow"]')].filter(visible);
        const highlights = [...root.querySelectorAll('[data-trace-attachment-kind="highlight"]')].filter(visible)
          .map(node => node.dataset.traceAttachedTo);
        const mark = [...root.querySelectorAll('[data-trace-attachment-kind="mark"]')].some(visible);
        const wide = [...root.querySelectorAll('.asm-trace-text-object')].find(node => visible(node) && node.textContent.startsWith('wide'));
        return { texts, highlights, mark, width: Number(wide?.querySelector('rect')?.getAttribute('width')),
          font: wide?.querySelector('.asm-trace-text-segment-value')?.getAttribute('font-size'),
          arrows: arrows.map(node => ({ x: Number(node.dataset.traceArrowToX), key: node.dataset.traceArrowToKey })) };
      };
      const cellX = index => {
        const root = document.getElementById('asm-trace-root'), cell = root.querySelector(`[data-trace-object-key="${CSS.escape(a + '#' + index)}"] rect`);
        const box = cell.getBoundingClientRect(); return new DOMPoint(box.x + box.width / 2, box.y + box.height / 2)
          .matrixTransform(root.getScreenCTM().inverse()).x;
      };
      const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
      let clock = performance.now(), elapsed = 0, id = 0, paused = false;
      const callbacks = new Map(), samples = [], advance = async () => {
        elapsed += 16; clock += 16; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
        for (let i = 0; i < 12; i++) await Promise.resolve();
      };
      window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
      window.cancelAnimationFrame = id => callbacks.delete(id);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      const restore = () => { window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
        if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now; };
      try {
        const pending = ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true });
        const plan = ASMTracePlayer.getLastPlaybackPlan(), xs = [0, 1, 3].map(cellX);
        while (elapsed < plan.totalDurationMs / speed + 1000) {
          await advance(); samples.push({ at: elapsed, ...read() });
          if (!paused && elapsed > 400 / speed) {
            ASMTraceFrameTween.pause(); const before = read();
            for (let i = 0; i < 6; i++) await advance();
            const after = read(); paused = { before, after }; ASMTraceFrameTween.resume();
          }
        }
        restore(); await pending;
        const final = read(); await ASMTracePlayer.render(0, { stable: true });
        await ASMTracePlayer.render(1, { stable: true });
        return { samples, final, reopened: read(), paused, xs, a, plan };
      } finally { restore(); ASMTraceFrameTween.cancel(); }
    }, { trace: document, speed });
    fs.mkdirSync('test-results/directive-follow', { recursive: true });
    fs.writeFileSync(`test-results/directive-follow/${disabled}-${speed}.json`, JSON.stringify(report));
    assert.deepEqual(report.paused.before, report.paused.after, 'pause must freeze dependent presentation');
    const textTrack = report.plan.directiveCheckpoints.find(track => track.kind === 'texts' && track.id === 'line-11');
    assert.ok(textTrack);
    for (const [ordinal, value] of [0, 1, 3].entries()) {
      const begin = ordinal ? textTrack.steps[ordinal - 1].commit : 0;
      const end = textTrack.steps[ordinal]?.commit ?? Infinity;
      const samples = report.samples.filter(sample => {
        const logical = (sample.at - (sample.at > 400 / speed + 96 ? 96 : 0)) * speed;
        return logical > begin + 32 * speed && logical < end - 32 * speed;
      });
      assert.ok(samples.length);
      assert.ok(samples.every(sample => sample.texts.includes('index = ' + value)), 'text changes only on its dependency commit');
    }
    const labels = [...new Set(report.samples.flatMap(sample => sample.texts.filter(text => text.startsWith('index ='))))];
    assert.deepEqual(labels, ['index = 0', 'index = 1', 'index = 3']);
    const first = report.samples[0]; assert.ok(first.texts.includes('index = 0'));
    assert.equal(first.arrows.length, 1, 'no duplicate final-state arrow behind the follower');
    assert.ok(Math.abs(first.arrows[0].x - report.xs[0]) < .1, 'unrelated first assignment must not move arrow');
    assert.ok(first.highlights.includes(report.a + '#0'), 'dynamic style begins at index 0');
    assert.ok(!first.highlights.includes(report.a + '#3'), 'dynamic style cannot show final index early');
    assert.ok(!first.texts.includes('positive'), 'when=false text must not show its final true state');
    for (const value of [1, 3]) {
      const stage = report.samples.filter(sample => sample.texts.includes('index = ' + value));
      assert.ok(stage.length > 2);
      assert.ok(stage.some(sample => sample.highlights.includes(report.a + '#' + value)), 'C2 style follows index ' + value);
      assert.ok(stage.some(sample => sample.arrows.some(arrow => Math.abs(arrow.x - report.xs[value === 1 ? 1 : 2]) < .1)));
    }
    assert.ok(report.samples.every(sample => sample.mark), 'fixed-index style stays present');
    assert.ok(report.final.texts.includes('positive')); assert.ok(report.reopened.texts.includes('index = 3'));
    assert.ok(report.samples.find(sample => sample.texts.includes('wide 1000')).width > first.width + 10,
      'automatic text box width must be recomputed when expression length changes');
    assert.ok(report.samples.every(sample => sample.font === '22'), 'saved custom font size survives dependency updates');
    assert.deepEqual(errors, []);
  }
  const legacy = await page.evaluate(async source => {
    const trace = JSON.parse(JSON.stringify(source));
    trace.frames[1].events.filter(event => event.type === 'assign' && event.expression.replace(/\s/g, '') === 'i=1')
      .forEach(event => { delete event.payload.before; });
    const reports = [], original = ASMCompileWarnings.report;
    ASMCompileWarnings.report = (stage, message) => reports.push({ stage, message });
    window.asmGetAnimationPlaybackRate = () => 4;
    try {
      ASMTracePlayer.apply(trace); await ASMTracePlayer.render(0, { stable: true });
      const pending = ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true });
      const records = ASMTracePlayer.getLastPlaybackPlan().directiveCheckpoints;
      await pending;
      const saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved); await ASMTracePlayer.render(1, { stable: true });
      return { reports, records, text: document.querySelector('#asm-trace-root').textContent };
    } finally { ASMCompileWarnings.report = original; }
  }, trace);
  assert.ok(legacy.reports.some(report => report.message.includes('重新 RUN')));
  assert.ok(!legacy.records.some(record => record.kind === 'texts' && record.id === 'line-11'), 'unknown middle values fall back without guessing');
  assert.ok(legacy.text.includes('index = 3'));
});

test('code panel scroll uses logical speed, freezes on pause and cancels on replacement', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(base + '/algorithm.html'); await page.waitForFunction(() => window.ASMTraceCodePresenter);
  const runs = await page.evaluate(async () => {
    const original = ASMTraceCodeModel.planFrame, originalPause = ASMTraceFrameTween.isPaused;
    ASMTraceCodeModel.planFrame = (trace, frame) => {
      const second = frame.id === 'two';
      const items = Array.from({ length: 45 }, (_, i) => ({ kind: 'line', number: i + 1, text: `int value_${i}=0;`, segments: [] }));
      return { layoutKey: second ? 'later' : 'first', focusLine: second ? 40 : 2,
        fragments: [{ functionName: 'main', subtreeKey: 'main', focusLine: second ? 40 : 2,
          items: second ? items.slice(30) : items.slice(0, 10), expandedItems: items }] };
    };
    const outcomes = [];
    try {
      for (const speed of [1, 4]) {
        const trace = { code: 'int main() {}', frames: [{ id: 'one', events: [] }, { id: 'two', events: [] }], studio: { codePanelScrollMs: 1200 } };
        window.asmGetAnimationPlaybackRate = () => speed;
        ASMTraceCodePresenter.renderFrame(trace, trace.frames[0], null, { stable: true });
        const native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
        let clock = performance.now(), elapsed = 0, id = 0, paused = false, done = false, pauseReport;
        const callbacks = new Map(), advance = async () => {
          elapsed += 16; clock += 16; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
          for (let i = 0; i < 12; i++) await Promise.resolve();
        };
        window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
        ASMTraceFrameTween.isPaused = () => paused;
        const read = () => [...document.querySelectorAll('.is-transition-expanded')].map(node => ({
          transform: getComputedStyle(node).transform, animations: node.getAnimations({ subtree: true }).map(animation => animation.currentTime) }));
        try {
          ASMTraceCodePresenter.renderFrame(trace, trace.frames[1]);
          ASMTraceCodePresenter.waitForTransition().then(() => { done = true; });
          while (!done && elapsed < 2000) {
            await advance();
            if (!pauseReport && elapsed >= 96) {
              paused = true; const before = read();
              for (let i = 0; i < 8; i++) await advance();
              pauseReport = { before, after: read(), done }; paused = false;
            }
          }
          outcomes.push({ speed, elapsed, done, pauseReport, remaining: read().length });
          ASMTraceCodePresenter.renderFrame(trace, trace.frames[0]);
          const pending = ASMTraceCodePresenter.waitForTransition();
          ASMTraceCodePresenter.renderFrame(trace, trace.frames[1], null, { stable: true });
          await pending; await advance();
          outcomes.at(-1).cancelledRemaining = read().length;
        } finally {
          window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
          if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now;
        }
      }
    } finally { ASMTraceCodeModel.planFrame = original; ASMTraceFrameTween.isPaused = originalPause; }
    return outcomes;
  });
  for (const run of runs) {
    assert.ok(run.done); assert.equal(run.pauseReport.done, false); assert.ok(run.pauseReport.before.length);
    assert.ok(run.pauseReport.before.some(page => page.animations.some(time => Number(time) > 0)), 'exercise actual CSS scroll animations');
    assert.deepEqual(run.pauseReport.before, run.pauseReport.after, 'CSS scroll geometry and animation time freeze together');
    assert.ok(Math.abs(run.elapsed - 128 - 1240 / run.speed) < 48, JSON.stringify(run));
    assert.equal(run.remaining, 0); assert.equal(run.cancelledRemaining, 0);
  }
});
