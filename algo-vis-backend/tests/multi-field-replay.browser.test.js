'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');

test('segment tree frame 24 to 25 commits each displayed field independently', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace, reset, left, width;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile(fs.readFileSync('tests/fixtures/segment-recursive-parameter-pointer.cpp', 'utf8'),
      '10 5\n1 2 3 4 5 6 7 8 9 10\n3 2 9\n1 2 8 3\n3 2 9\n2 4 7 5\n3 2 9'));
    ({ trace: reset } = await compile('#include <vector>\n#include <climits>\nusing namespace std;\n'
      + 'int main(){int n=1;vector<int>tree={0,2},sets={INT_MAX,INT_MAX},lazy={0,0};\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + 'tree[1]=9;lazy[1]=3;sets[1]=7;lazy[1]=-2;lazy[1]=0;sets[1]=INT_MAX;\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n}'));
    ({ trace: left } = await compile('#include <vector>\n#include <climits>\nusing namespace std;\n'
      + 'int main(){int n=1;vector<int>tree={0,2},sets={INT_MAX,INT_MAX},lazy={0,3};\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + 'tree[1]=9;\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n}'));
    ({ trace: width } = await compile('#include <vector>\n#include <climits>\nusing namespace std;\n'
      + 'int main(){int n=1;vector<int>tree={0,2},sets={INT_MAX,INT_MAX},lazy={0,3};\n'
      + '// @frame tree render segment_tree with range(1,n), fields(tree,sets,lazy), hide(sets=LM,lazy=0), format(sets=assign,lazy=signed)\n'
      + 'tree[1]=123;tree[1]=7;\n'
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
  for (const [kind, source, from, index] of [['fresh', trace, 23, 17], ['saved', savedTrace(body, animation), 23, 17],
    ['fresh-set', trace, 59, 5], ['saved-set', savedTrace(body, animation), 59, 5],
    ['fresh-clear', trace, 63, 6], ['saved-clear', savedTrace(body, animation), 63, 6], ['reset', reset, 0, 1], ['left', left, 0, 1], ['width', width, 0, 1]]) {
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
            value.opacity = opacity;
            const separator = field.previousElementSibling;
            if (separator?.hasAttribute('data-trace-field-separator') && separator.getAttribute('display') !== 'none') {
              let separatorOpacity = 1;
              for (let node = separator; node?.nodeType === 1; node = node.parentElement) separatorOpacity *= Number(getComputedStyle(node).opacity);
              value.separatorOpacity = separatorOpacity;
            }
            positions[doc.variables[field.dataset.traceFieldVariable].name] = value;
          }
          const text = [...fields[0].parentElement.children].filter(node => node.getAttribute('display') !== 'none'
            && !node.hasAttribute('data-trace-field-adornment')).map(node => node.textContent).join('');
          const flightNodes = [...root.querySelectorAll('.asm-trace-assign-falling-value, .asm-trace-assign-transfer text')];
          const flying = flightNodes.filter(node => {
            let opacity = 1; for (let parent = node; parent?.nodeType === 1; parent = parent.parentElement) opacity *= Number(getComputedStyle(parent).opacity);
            return opacity > .01;
          }).map(node => ({ ...metric(node), text: node.textContent,
            aboveCell: Boolean(cell.querySelector('rect').compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) }));
          const adornments = [...cell.querySelectorAll('[data-trace-field-adornment]')]
            .filter(node => node.getAttribute('display') !== 'none').map(node => node.textContent);
          const adornmentOpacities = [...cell.querySelectorAll('[data-trace-field-adornment]')]
            .filter(node => node.getAttribute('display') !== 'none').map(node => Number(node.getAttribute('opacity') || 1));
          return { values, positions, flying, travel: flightNodes.map(node => metric(node)), adornments, adornmentOpacities, eventId: root.dataset.traceActiveEventId, text, center: metric(cell.querySelector('rect')).x,
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
          { tree: '9', sets: '=7', lazy: '+3' }, { tree: '9', sets: '=7', lazy: '-2' },
          { tree: '9', sets: '=7', lazy: '0' },
          { tree: '9', sets: '=7', lazy: '' },
          { tree: '9', sets: '', lazy: '' }]
        : kind.endsWith('-set') ? [{ tree: '15', sets: '', lazy: '+3' }, { tree: '10', sets: '', lazy: '+3' },
          { tree: '10', sets: '=5', lazy: '' }]
        : kind.endsWith('-clear') ? [{ tree: '30', sets: '', lazy: '+3' }, { tree: '30', sets: '', lazy: '0' },
          { tree: '30', sets: '', lazy: '' }]
        : kind === 'width' ? [{ tree: '2', sets: '', lazy: '+3' }, { tree: '123', sets: '', lazy: '+3' }, { tree: '7', sets: '', lazy: '+3' }]
        : kind === 'left' ? [{ tree: '2', sets: '', lazy: '+3' }, { tree: '9', sets: '', lazy: '+3' }]
          : [{ tree: '2', sets: '', lazy: '' }, { tree: '5', sets: '', lazy: '' }, { tree: '5', sets: '', lazy: '+3' }];
      assert.deepEqual(states, expected, 'every field must commit in runtime order without overwriting siblings');
      assert.deepEqual(report.final.values, expected.at(-1)); assert.deepEqual(report.reopened.values, expected.at(-1));
      if (kind === 'width') {
        for (const event of source.frames[1].events.filter(event => event.type === 'assign')) {
          const checkpoint = report.plan.forwardReplay.checkpoints.find(point => point.eventId === event.id);
          const active = report.samples.filter(sample => sample.eventId === event.id);
          const before = active.filter(sample => sample.at * speed < checkpoint.commitMs);
          assert.ok(before.length > 1);
          assert.ok(before.every(sample => Math.abs(sample.positions.lazy.x - before[0].positions.lazy.x) < .2),
            'following field cannot make room until the incoming number lands');
          assert.ok(before.flatMap(sample => sample.flying).every(number => Math.abs(number.x - before[0].positions.tree.x) < .5),
            'the incoming number lands at the current field position');
          const after = active.filter(sample => sample.at * speed >= checkpoint.commitMs
            && sample.at * speed < checkpoint.commitMs + 180);
          assert.ok(after.length > 1 && Math.abs(after.at(-1).positions.lazy.x - before[0].positions.lazy.x) > 1,
            'the following number smoothly moves after commit, for both widening and narrowing');
          const xs = after.map(sample => sample.positions.lazy.x), direction = Math.sign(xs.at(-1) - xs[0]);
          assert.ok(xs.every((x, i) => !i || (x - xs[i - 1]) * direction >= -.01), 'post-landing reflow must be monotonic');
        }
        assert.ok(Math.abs(report.final.positions.lazy.x - report.destination.positions.lazy.x) < .5);
      }
      if (kind.endsWith('-clear')) {
        const resetEvent = source.frames[from + 1].events.find(event => event.expression === 'lazy[now] = 0');
        const checkpoint = report.plan.forwardReplay.checkpoints.find(point => point.eventId === resetEvent.id);
        assert.equal(checkpoint.mode, 'animated', 'a previously visible lazy field must play its clear assignment');
        const active = report.samples.filter(sample => sample.eventId === resetEvent.id);
        assert.ok(active.some(sample => sample.flying.some(number => number.text === '0')), 'zero actually falls into the visible lazy field');
        assert.ok(active.filter(sample => sample.at * speed < checkpoint.commitMs).every(sample => sample.values.lazy === '+3'
          && sample.positions.lazy.visible), 'the old +3 remains visible until zero arrives');
        const zero = active.filter(sample => sample.values.lazy === '0' && sample.positions.lazy.visible);
        assert.ok(zero.length > 1 && (zero.at(-1).at - zero[0].at) * speed >= 350,
          'zero stays visible for the existing hold phase before fading out');
        assert.ok(active.filter(sample => sample.values.lazy === '0').every(sample =>
          Math.abs(sample.positions.lazy.opacity - sample.positions.lazy.separatorOpacity) < .001),
        'the lazy comma fades with zero, rather than staying visible until cleanup');
        assert.equal(report.final.text, '30', 'clearing lazy removes its separator and occupied space');
        const step = report.plan.phases.flatMap(phase => phase.steps || []).find(step => step.eventId === resetEvent.id);
        const closeEnd = step.visualStartMs + step.visualDurationMs, closeStart = closeEnd - 160;
        const closing = active.filter(sample => sample.at * speed >= closeStart && sample.at * speed < closeEnd);
        assert.ok(closing.length >= 2 && closing.every(sample => sample.values.lazy === ''),
          'close-gap owns 160ms after the field and separator have disappeared');
        const distances = closing.map(sample => Math.abs(sample.positions.tree.x - report.destination.positions.tree.x));
        assert.ok(distances[0] > distances.at(-1) + .5, 'remaining number visibly moves toward its final center');
        assert.ok(distances.every((distance, i) => !i || distance <= distances[i - 1] + .01), 'close-gap motion cannot reverse or jump away');
        assert.ok(distances.at(-1) < .5, 'the final layout cleanup cannot cause a positioning jump');
      }
      if (kind.endsWith('-set')) {
        const hiddenWrite = source.frames[from + 1].events.find(event => event.expression === 'lazy[now] = 0');
        const checkpoint = report.plan.forwardReplay.checkpoints.find(point => point.eventId === hiddenWrite.id);
        const setWrite = source.frames[from + 1].events.find(event => event.expression === 'sets[now] = value');
        const setCommit = report.plan.forwardReplay.checkpoints.find(point => point.eventId === setWrite.id).commitMs;
        assert.equal(checkpoint.mode, 'instant', 'hidden lazy=0 is a data commit, not a timed animation');
        assert.equal(checkpoint.commitMs, setCommit, 'sets appears and lazy clears in one ordered presentation commit');
        assert.ok(report.samples.every(sample => sample.eventId !== hiddenWrite.id), 'hidden reset cannot become an active animation');
        const incoming = report.samples.filter(sample => sample.eventId === setWrite.id && sample.flying.length);
        assert.ok(incoming.length > 1);
        assert.ok(incoming.every(sample => sample.flying.every(number => number.text === '=5'
          && Math.abs(number.x - report.before.positions.lazy.x) < .5)), '=5 lands in the old +3 slot without creating a third column');
        assert.ok(report.samples.filter(sample => sample.eventId === setWrite.id && sample.at * speed < setCommit)
          .every(sample => sample.values.lazy === '+3' && sample.positions.lazy.visible && sample.values.sets === ''),
        '+3 stays visible until =5 lands, then the two fields exchange visibility together');
        assert.ok(report.samples.filter(sample => sample.eventId === setWrite.id).every(sample =>
          (sample.text.match(/,/g) || []).length === 1 && sample.adornments.length === 0),
        'the replacement reuses the original separator without adding another comma');
        for (const name of ['tree', 'sets']) assert.ok(Math.abs(report.final.positions[name].x - report.destination.positions[name].x) < .5,
          'hidden lazy cannot reserve a trailing column after commit: ' + name);
        assert.equal(report.final.text, '10,=5', 'exactly one separator remains between the two visible fields');
      }
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
              assert.ok(Math.abs(number.x - target.x) < .5, 'formatted effect must align with its entire field, not the cell center: ' + JSON.stringify({ name, number, target }));
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
          if (name === 'tree') {
            assert.ok(travelling.flatMap(sample => sample.flying).every(number => number.text === '+3'),
              'tree += computed hidden RHS transfers +3, not the final result +5');
            const beforeCommit = report.samples.filter(sample => sample.eventId === event.id && sample.at * speed < commit);
            assert.ok(beforeCommit.length > 1);
            assert.ok(beforeCommit.every(sample => sample.positions.tree.visible && sample.values.tree === '2'),
              'old value 2 must stay visible until falling 5 arrives and commits');
          }
          if (name === 'lazy') {
            const active = report.samples.filter(sample => sample.eventId === event.id);
            assert.ok(active.some(sample => sample.adornments.includes(',') && !sample.flying.length),
              'the field separator appears while preparing space');
            assert.ok(active.filter(sample => sample.flying.length).every(sample => sample.adornments.includes(',')
              && !sample.adornments.includes('+') && sample.flying.every(number => number.text === '+3')),
              'the plus sign descends with the digit, never as a stationary adornment');
            assert.ok(active.some(sample => sample.adornmentOpacities.some(opacity => opacity > 0 && opacity < 1)),
              'the new separator fades into the prepared space rather than popping in');
          }
        }
      }
      if (kind === 'reset') {
        const moving = report.samples.flatMap(sample => sample.flying.map(number => number.text));
        for (const value of ['+3', '=7', '-2']) assert.ok(moving.includes(value), 'complete format travels together: ' + value);
        assert.ok(report.samples.every(sample => sample.adornments.every(text => text === ',')),
          'format prefixes must never be detached from their moving numbers');
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
