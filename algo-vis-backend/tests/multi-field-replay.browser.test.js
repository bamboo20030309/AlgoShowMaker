'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('segment tree frame 24 to 25 commits each displayed field independently', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace, reset;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile(fs.readFileSync('tests/fixtures/segment-recursive-parameter-pointer.cpp', 'utf8'),
      '10 5\n1 2 3 4 5 6 7 8 9 10\n3 2 9\n1 2 8 3\n3 2 9\n2 4 7 5\n3 2 9'));
    ({ trace: reset } = await compile('#include <vector>\n#include <climits>\nusing namespace std;\n'
      + 'int main(){int n=1;vector<int>tree={0,2},sets={INT_MAX,INT_MAX},lazy={0,0};\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + 'tree[1]=9;lazy[1]=3;sets[1]=7;lazy[1]=0;sets[1]=INT_MAX;\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n}'));
  } finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const body = readPackage(fs.readFileSync('public/guest-decks/segment-tree-teaching.asmdeck')).body;
  const animation = body.deck.groups.flatMap(group => group.slides).find(slide =>
    slide.animation?.code.includes('render segment_tree') && slide.animation.code.includes('operation_pointer_view')).animation;
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime'); await page.waitForFunction(() => window.ASMTracePlayer);
  for (const [kind, source, from, index] of [['fresh', trace, 23, 17], ['saved', savedTrace(body, animation), 23, 17], ['reset', reset, 0, 1]]) {
    for (const speed of [1, 4]) {
      const report = await page.evaluate(async ({ trace, from, index, speed }) => {
        const doc = ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
        window.asmGetAnimationPlaybackRate = () => speed;
        await ASMTracePlayer.render(from, { stable: true });
        const read = () => {
          const tree = [...document.querySelectorAll('#asm-trace-root [data-trace-variable]')].find(node => doc.variables[node.dataset.traceVariable]?.name === 'tree');
          const cell = document.querySelector(`#asm-trace-root g[data-trace-object-key="${CSS.escape(tree.dataset.traceObjectKey + '#' + index)}"]`);
          const fields = [...cell.querySelectorAll('tspan[data-trace-field-variable]')];
          const values = {};
          for (const field of fields) values[doc.variables[field.dataset.traceFieldVariable].name] = field.getAttribute('display') === 'none' ? '' : field.textContent;
          const text = [...fields[0].parentElement.children].filter(node => node.getAttribute('display') !== 'none').map(node => node.textContent).join('');
          return { values, text, invalidFields: fields.filter(field => !field.parentElement.matches('text')).length };
        };
        const before = read(), native = { raf: requestAnimationFrame, cancel: cancelAnimationFrame, now: Object.getOwnPropertyDescriptor(performance, 'now') };
        let clock = performance.now(), elapsed = 0, id = 0;
        const callbacks = new Map(), samples = [];
        window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
        window.cancelAnimationFrame = id => callbacks.delete(id);
        Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
        const restore = () => { window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.cancel;
          if (native.now) Object.defineProperty(performance, 'now', native.now); else delete performance.now; };
        try {
          const pending = ASMTracePlayer.render(from + 1, { fromIndex: from, forceTransition: true }), plan = ASMTracePlayer.getLastPlaybackPlan();
          while (elapsed < plan.totalDurationMs / speed + 100) {
            elapsed += 16; clock += 16; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(clock));
            for (let i = 0; i < 12; i++) await Promise.resolve();
            samples.push({ at: elapsed, ...read() });
          }
          restore(); await pending;
          const final = read(), saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
          ASMTracePlayer.apply(saved); await ASMTracePlayer.render(from + 1, { stable: true });
          return { before, samples, final, reopened: read(), plan };
        } finally { restore(); ASMTraceFrameTween.cancel(); }
      }, { trace: source, from, index, speed });
      fs.mkdirSync('test-results/multi-field-replay', { recursive: true });
      fs.writeFileSync(`test-results/multi-field-replay/${kind}-${speed}.json`, JSON.stringify(report));
      const states = report.samples.filter((sample, index, samples) => !index
        || JSON.stringify(sample.values) !== JSON.stringify(samples[index - 1].values)).map(sample => sample.values);
      const expected = kind === 'reset'
        ? [{ tree: '2', sets: '', lazy: '' }, { tree: '9', sets: '', lazy: '' }, { tree: '9', sets: '', lazy: '+3' },
          { tree: '9', sets: '=7', lazy: '+3' }, { tree: '9', sets: '=7', lazy: '' }, { tree: '9', sets: '', lazy: '' }]
        : [{ tree: '2', sets: '', lazy: '' }, { tree: '5', sets: '', lazy: '' }, { tree: '5', sets: '', lazy: '+3' }];
      assert.deepEqual(states, expected, 'every field must commit in runtime order without overwriting siblings');
      assert.deepEqual(report.final.values, expected.at(-1)); assert.deepEqual(report.reopened.values, expected.at(-1));
      assert.ok(report.samples.every(sample => !sample.text.startsWith(',') && !sample.text.endsWith(',') && !sample.text.includes(',,')),
        'hidden fields cannot leave dangling separators');
      assert.ok(report.samples.every(sample => sample.invalidFields === 0), 'field tspans must remain inside their text parent');
    }
  }
  assert.deepEqual(errors, []);
});
