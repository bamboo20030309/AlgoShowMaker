'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('segment tree frame 24 to 25 commits each displayed field independently', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace, reset, left;
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
    ({ trace: left } = await compile('#include <vector>\n#include <climits>\nusing namespace std;\n'
      + 'int main(){int n=1;vector<int>tree={0,2},sets={INT_MAX,INT_MAX},lazy={0,3};\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + 'tree[1]=9;\n'
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
  for (const [kind, source, from, index] of [['fresh', trace, 23, 17], ['saved', savedTrace(body, animation), 23, 17], ['reset', reset, 0, 1], ['left', left, 0, 1]]) {
    for (const speed of [1, 4]) {
      const report = await page.evaluate(async ({ trace, from, index, speed }) => {
        const doc = ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
        window.asmGetAnimationPlaybackRate = () => speed;
        await ASMTracePlayer.render(from, { stable: true });
        const read = () => {
          const tree = [...document.querySelectorAll('#asm-trace-root [data-trace-variable]')].find(node => doc.variables[node.dataset.traceVariable]?.name === 'tree');
          const cell = document.querySelector(`#asm-trace-root g[data-trace-object-key="${CSS.escape(tree.dataset.traceObjectKey + '#' + index)}"]`);
          const fields = [...cell.querySelectorAll('tspan[data-trace-field-variable]')];
          const root = document.getElementById('asm-trace-root'), inverse = root.getScreenCTM().inverse();
          const metric = (node, bounds = node.getBoundingClientRect()) => {
            const point = new DOMPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2).matrixTransform(inverse);
            return { x: point.x, y: point.y, font: getComputedStyle(node).fontSize };
          };
          const values = {};
          const positions = {};
          for (const field of fields) values[doc.variables[field.dataset.traceFieldVariable].name] = field.getAttribute('display') === 'none' ? '' : field.textContent;
          for (const field of fields) if (field.getAttribute('display') !== 'none') {
            const value = metric(field), text = field.firstChild;
            if (text?.nodeType === Node.TEXT_NODE && /^[=+]/.test(field.textContent) && field.textContent.length > 1) {
              const range = document.createRange(); range.setStart(text, 1); range.setEnd(text, text.length);
              const digits = metric(field, range.getBoundingClientRect());
              value.digitX = digits.x; value.digitY = digits.y;
            } else { value.digitX = value.x; value.digitY = value.y; }
            let opacity = 1; for (let node = field; node?.nodeType === 1; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
            value.visible = opacity > .01;
            positions[doc.variables[field.dataset.traceFieldVariable].name] = value;
          }
          const text = [...fields[0].parentElement.children].filter(node => node.getAttribute('display') !== 'none').map(node => node.textContent).join('');
          const flightNodes = [...root.querySelectorAll('.asm-trace-assign-falling-value, .asm-trace-assign-transfer text')];
          const flying = flightNodes.filter(node => {
            let opacity = 1; for (let parent = node; parent?.nodeType === 1; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
            return opacity > .01;
          }).map(node => ({ ...metric(node), text: node.textContent,
            aboveCell: Boolean(cell.querySelector('rect').compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) }));
          const adornments = [...cell.querySelectorAll('[data-trace-field-adornment]')]
            .filter(node => node.getAttribute('display') !== 'none').map(node => node.textContent);
          return { values, positions, flying, travel: flightNodes.map(node => metric(node)), adornments, eventId: root.dataset.traceActiveEventId, text, center: metric(cell.querySelector('rect')).x,
            invalidFields: fields.filter(field => !field.parentElement.matches('text')).length };
        };
        await ASMTracePlayer.render(from + 1, { stable: true });
        const destination = read();
        await ASMTracePlayer.render(from, { stable: true });
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
          return { before, destination, samples, final, reopened: read(), plan };
        } finally { restore(); ASMTraceFrameTween.cancel(); }
      }, { trace: source, from, index, speed });
      fs.mkdirSync('test-results/multi-field-replay', { recursive: true });
      fs.writeFileSync(`test-results/multi-field-replay/${kind}-${speed}.json`, JSON.stringify(report));
      const states = report.samples.filter((sample, index, samples) => !index
        || JSON.stringify(sample.values) !== JSON.stringify(samples[index - 1].values)).map(sample => sample.values);
      const expected = kind === 'reset'
        ? [{ tree: '2', sets: '', lazy: '' }, { tree: '9', sets: '', lazy: '' }, { tree: '9', sets: '', lazy: '+3' },
          { tree: '9', sets: '=7', lazy: '+3' }, { tree: '9', sets: '=7', lazy: '' }, { tree: '9', sets: '', lazy: '' }]
        : kind === 'left' ? [{ tree: '2', sets: '', lazy: '+3' }, { tree: '9', sets: '', lazy: '+3' }]
          : [{ tree: '2', sets: '', lazy: '' }, { tree: '5', sets: '', lazy: '' }, { tree: '5', sets: '', lazy: '+3' }];
      assert.deepEqual(states, expected, 'every field must commit in runtime order without overwriting siblings');
      assert.deepEqual(report.final.values, expected.at(-1)); assert.deepEqual(report.reopened.values, expected.at(-1));
      assert.deepEqual(report.final.adornments, [], 'temporary punctuation must be removed at commit');
      assert.deepEqual(report.reopened.adornments, []);
      assert.ok(report.samples.every(sample => !sample.text.startsWith(',') && !sample.text.endsWith(',') && !sample.text.includes(',,')),
        'hidden fields cannot leave dangling separators');
      assert.ok(report.samples.every(sample => sample.invalidFields === 0), 'field tspans must remain inside their text parent');
      assert.ok(report.samples.every(sample => sample.flying.every(number => number.aboveCell)),
        'falling field digits must remain above the opaque cell until the formal value takes over');
      if (kind === 'fresh' || kind === 'saved') {
        const writes = source.frames[from + 1].events.filter(event => event.type === 'write');
        for (const name of ['tree', 'lazy']) {
          const event = writes.find(event => event.targets?.some(target => target.role === 'target' && source.variables[target.variableId]?.name === name));
          const commit = report.plan.forwardReplay.checkpoints.find(checkpoint => checkpoint.eventId === event.id).commitMs;
          const travelling = report.samples.filter(sample => sample.at * speed > commit - 300 && sample.at * speed < commit - 40);
          const target = name === 'tree' ? report.before.positions.tree : report.destination.positions.lazy;
          assert.ok(travelling.length > 1);
          assert.ok(travelling.some(sample => sample.flying.length), 'must observe the numeric effect in ' + name);
          for (const sample of travelling) {
            for (const number of sample.flying) {
              assert.ok(Math.abs(number.x - target.digitX) < .5, 'numeric effect must align with its field digits, not the cell center: ' + JSON.stringify({ name, number, target }));
              assert.ok(number.y <= target.digitY + .5 && number.y >= target.digitY - 24.5, 'numeric effect descends toward the field baseline without overshooting');
              assert.equal(number.font, target.font, 'field effects must inherit the actual font');
            }
            const expectedTree = name === 'tree' ? report.before.positions.tree : report.destination.positions.tree;
            assert.ok(Math.abs(sample.positions.tree.x - expectedTree.x) < .5, 'surviving field cannot re-center during assignment');
          }
          const descent = report.samples.filter(sample => sample.eventId === event.id).flatMap(sample => sample.travel);
          assert.ok(Math.max(...descent.map(number => number.y)) - Math.min(...descent.map(number => number.y)) > 20,
            'constant or hidden-source digits must actually fall from above');
          assert.ok(Math.abs(descent.at(-1).y - target.digitY) < .5, 'falling number reaches the correct field baseline before commit');
          if (name === 'tree') assert.ok(travelling.filter(sample => sample.flying.length).every(sample => !sample.positions.tree.visible),
            'an in-place result cannot overlap the old tree value');
          if (name === 'lazy') {
            const active = report.samples.filter(sample => sample.eventId === event.id);
            assert.ok(active.some(sample => sample.adornments.includes(',') && sample.adornments.includes('+') && !sample.flying.length),
              'comma and plus sign appear before the new lazy digit');
            assert.ok(active.filter(sample => sample.flying.length).every(sample => sample.adornments.includes(',') && sample.adornments.includes('+')),
              'comma and plus remain visible while the lazy digit is presented');
          }
        }
      }
      if (kind === 'left') {
        assert.ok(report.before.positions.tree.x < report.before.center - 5, 'the assigned field is visibly left of cell center');
        assert.ok(report.samples.every(sample => Math.abs(sample.positions.tree.x - report.before.positions.tree.x) < .5),
          'existing comma-separated fields must never jump back to the cell center');
        const visibleNumbers = report.samples.flatMap(sample => sample.flying);
        assert.ok(visibleNumbers.length > 2);
        assert.ok(visibleNumbers.every(number => Math.abs(number.x - report.before.positions.tree.x) < .5),
          'assignment lands on the left field rather than the cell center');
      }
    }
  }
  assert.deepEqual(errors, []);
});
