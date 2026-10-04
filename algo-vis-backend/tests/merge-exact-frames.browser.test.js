const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('exact merge frames preserve preview geometry, empty declaration and insertion source',
  { timeout: 120000 }, async () => {
    const code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8').replace(/\r\n/g, '\n').replace(/    \/\/ @frame num\n    \/\/ @place num.top-left at split_tree.root.top-left\n    \/\/ @text [^\n]*\n/, '').replace('void merge_sort(vector<int>& num, int L, int R) {', 'void merge_sort(vector<int>& num, int L, int R) {\n    vector<int> part(num.begin()+L,num.begin()+R+1);').replaceAll('@frame num with range(L,R)', '@frame part').replaceAll('@frame num as merged with range(L,R)', '@frame part');
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
      for (const preview of ['on', 'off']) {
        const { trace } = await compile(code.replace('branch-previews off', `branch-previews ${preview}`),
          '10\n38 27 43 3 9 82 10 19 84 60\n');
        const reports = await page.evaluate(async ({ trace, preview }) => {
          window.ASMTracePlayer.apply(trace);
          const visible = element => {
            for (let p = element; p && p !== document.body; p = p.parentElement) {
              if (Number(getComputedStyle(p).opacity) === 0 || getComputedStyle(p).display === 'none') return false;
            }
            return true;
          };
          const reports = [];
          for (const speed of [1, 4]) {
            window.asmGetAnimationPlaybackRate = () => speed;
            const mergeFrames = trace.frames.map((frame, index) => ({frame,index})).filter(({frame}) =>
              frame.source.recursionActivationId === 'activation-3' && frame.events.some(event =>
                event.operation === 'push_back' || event.type === 'declare' && event.name === 'merged'));
            for (const index of preview === 'on' ? [1, 2, 3] : mergeFrames.slice(0, 3).map(item => item.index)) {
              await window.ASMTracePlayer.render(index - 1, { stable: true });
              let done = false;
              const samples = [];
              const transition = window.ASMTracePlayer.render(index, {
                fromIndex: index - 1, forceTransition: true
              }).finally(() => { done = true; });
              while (!done) {
                await new Promise(resolve => requestAnimationFrame(resolve));
                const root = document.querySelector('#asm-trace-root');
                const primary = trace.frames[index].source.objectId || trace.frames[index].source.primaryVariableId;
                const owner = [...root.querySelectorAll(`[data-trace-object-key="${primary}"]`)]
                  .find(el => !el.closest('.asm-trace-snapshot'));
                samples.push({
                  event: root.dataset.traceActiveEventId || '',
                  nodes: [...root.querySelectorAll('[data-trace-layout-node]')]
                    .filter(el => el.dataset.traceSnapshot || !el.closest('.asm-trace-snapshot'))
                    .map(el => ({ activation: el.dataset.traceLayoutActivation,
                      snapshot: el.dataset.traceSnapshot,
                      bounds: window.ASMArrowModel.presentedBounds(el, root, true) })),
                  name: owner?.querySelector('.outerframe-label')?.textContent,
                  cells: [...owner?.querySelectorAll('[data-trace-index], [data-trace-index-label]') || []]
                    .map(el => ({ key: el.dataset.traceObjectKey, text: el.textContent,
                      visible: visible(el), transform: el.getAttribute('transform') })),
                  clones: [...root.querySelectorAll('.asm-trace-assign-transfer,[data-trace-transfer-source-snapshot]')]
                    .map(el => ({ text: el.textContent, source: el.dataset.traceTransferSourceSnapshot }))
                });
              }
              await transition;
              reports.push({ index, speed, samples });
            }
          }
          return reports;
        }, { trace, preview });
        const center = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
        for (const report of reports) {
          const frame = trace.frames[report.index];
          if (preview === 'on') {
            if (report.index < 3) {
              const first = report.samples[0];
              const parent = first.nodes.find(n => n.activation === 'activation-1');
              const child = first.nodes.find(n => n.activation === frame.source.recursionActivationId);
              assert.ok(parent?.bounds && child?.bounds, `preview parent and new child are actually drawn: ${JSON.stringify({index:report.index,speed:report.speed,frame:frame.source,first})}`);
              const a = center(parent.bounds), current = center(child.bounds);
              const target = report.samples.at(-1).nodes.find(n => n.activation === child.activation).bounds;
              const end = center(target);
              // The first rAF may already be a few milliseconds into growth.
              // Recover the start center from the actual scale/progress; do
              // not loosen the one-pixel geometry contract for frame timing.
              const progress = (child.bounds.width / target.width - 0.72) / 0.28;
              const b = { x: (current.x - progress * end.x) / (1 - progress),
                y: (current.y - progress * end.y) / (1 - progress) };
              assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1,
                `frame ${report.index + 1} grows from the common parent center: ${JSON.stringify({a,b})}`);
              assert.equal(first.clones.length, 0, 'preview growth does not also clone a live part');
            } else {
              const settled = report.samples.at(-1).nodes;
              for (const sample of report.samples) {
                assert.equal(sample.nodes.length, 3, 'root plus exactly two preview children');
                assert.equal(sample.clones.length, 0, 'entering the actual left call does not reenter a preview');
                for (const node of sample.nodes) {
                  const target = settled.find(n => n.activation === node.activation);
                  for (const key of ['x', 'y', 'width', 'height']) {
                    assert.ok(Math.abs(node.bounds[key] - target.bounds[key]) < 1,
                      `frame 4 ${node.activation} ${key} is stable at speed ${report.speed}`);
                  }
                }
              }
            }
          } else {
            const push = frame.events.find(e => e.operation === 'push_back');
            const declaration = frame.events.find(e => e.type === 'declare' && e.name === 'merged');
            if (declaration) {
              const samples = report.samples.filter(s => s.event === declaration.id);
              assert.ok(samples.length, 'merged declaration is observed, not skipped');
              for (const sample of samples) {
                assert.equal(sample.name, 'merged');
                assert.ok(sample.cells.every(c => !c.visible), 'empty merged shows no data/index cells');
              }
            }
            if (!push) continue; // The empty declaration precedes the first insertion.
            const flying = report.samples.filter(s => s.clones.length);
            assert.ok(flying.length, `push at frame ${report.index + 1} has a source-cell transfer`);
            for (const sample of flying) {
              assert.equal(sample.clones.length, 1, 'one insertion has one flying cell');
              assert.equal(sample.clones[0].text, String(push.payload.insertedValue.value));
              const source = trace.snapshots.find(s => s.id === sample.clones[0].source);
              assert.equal(source.layoutId, 'merge_tree');
              assert.equal(source.recursionParentActivationId, frame.source.recursionActivationId, 'source is a completed child of the current merge, never its top part');
              const inserted = sample.cells.filter(c => c.key.endsWith(`#${push.payload.beforeSize}`)
                || c.key.endsWith(`#${push.payload.beforeSize}:index`));
              assert.equal(inserted.length, 2);
              assert.ok(inserted.every(c => !c.visible && (!c.transform || c.transform === 'translate(0, 0)')),
                'destination/index remain stationary and hidden until the single clone lands');
            }
          }
        }
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
