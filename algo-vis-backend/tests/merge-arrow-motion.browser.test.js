const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('merge subtree arrows follow presented node anchors throughout reflow and keep handoff', { timeout: 120000 }, async () => {
  // Keep this historical frame-25/26 fixture unchanged when the interactive
  // sample gains an explicit initial pointer frame.
  const original = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8')
    .replace(/    \/\/ @frame merged in merge_tree\r?\n    \/\/ @pointer i[^\r\n]*\r?\n    \/\/ @pointer j[^\r\n]*\r?\n    \/\/ @text "合併左右子樹" at merged.bottom\r?\n/, '')
    .replace(/^\s*\/\/ @pointer[^\r\n]*\r?\n/gm, '');
  const code = original
    .replace('// @layout merge_scene align start', '')
    .replace(/\/\/ @layout split_tree reserve on\r?\n/g, '')
    .replace(/\/\/ @layout merge_tree (?:reserve on|grow-from leaves)\r?\n/g, '')
    .replace(/\/\/ @place merge_tree.top-left[^\r\n]*\r?\n/g, '')
    .replace('// @layout split_tree level-gap 60', '// @layout split_tree reserve on\n// @layout split_tree level-gap 60')
    .replace('// @layout merge_tree level-gap 60', '// @layout merge_tree grow-from leaves\n// @layout merge_tree reserve on\n// @layout merge_tree level-gap 60\n// @place merge_tree.top-left at split_tree.bottom-left offset(0,40)');
  const { trace } = await compile(process.env.ASM_TEST_MERGE_LAYOUT === 'legacy' ? original : code,
    '10\n38 27 43 3 9 82 10 19 84 60\n');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const reports = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      const reports = [];
      for (const speed of [1, 4]) {
        window.asmGetAnimationPlaybackRate = () => speed;
        for (const index of [25]) {
          await window.ASMTracePlayer.render(index - 2, { stable: true });
          await window.ASMTracePlayer.render(index - 1, { fromIndex: index - 2, forceTransition: true });
          let done = false, worst = { distance: 0 }, samples = 0, targetMotion = [];
          const transition = window.ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true })
            .finally(() => { done = true; });
          while (!done) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            const root = document.querySelector('#asm-trace-root');
            const objects = [...root.querySelectorAll('[data-trace-object-key]')];
            const target = objects.find(el => el.dataset.traceLayoutId === 'merge_tree'
              && el.dataset.traceLayoutActivation === 'activation-8');
            const targetBox = window.ASMArrowModel.presentedBounds(target, root, true);
            if (targetBox) targetMotion.push(targetBox);
            for (const arrow of root.querySelectorAll('[data-trace-arrow-from-key]')) {
              if (arrow.getAttribute('display') === 'none' || arrow.getAttribute('opacity') === '0') continue;
              const anchors = {};
              for (const role of ['From', 'To']) {
                const key = arrow.dataset[`traceArrow${role}Key`];
                const owner = objects.find(el => el.dataset.traceObjectKey === key &&
                  (key.startsWith('snapshot:') || !el.closest('.asm-trace-snapshot')));
                const preferred = owner?.dataset.traceLayoutPreferredVariable;
                const primary = preferred ? [...owner.querySelectorAll('[data-trace-variable]')]
                  .find(el => el.dataset.traceVariable === preferred) : null;
                const box = window.ASMArrowModel.presentedBounds(primary || owner, root, true);
                if (!box) continue;
                const point = window.ASMTraceRenderers.anchorPoint(box, arrow.dataset[`traceArrow${role}Anchor`]);
                point.x += Number(arrow.dataset[`traceArrow${role}Dx`] || 0);
                point.y += Number(arrow.dataset[`traceArrow${role}Dy`] || 0);
                anchors[role] = point;
                const actual = { x: Number(arrow.dataset[`traceArrow${role}X`]), y: Number(arrow.dataset[`traceArrow${role}Y`]) };
                const distance = Math.hypot(actual.x - point.x, actual.y - point.y);
                samples++;
                if (distance > worst.distance) worst = { distance, key, role, actual, expected: point,
                  arrow: arrow.dataset.traceArrow, event: root.dataset.traceActiveEventId };
              }
              if (anchors.From && anchors.To && arrow.tagName.toLowerCase() === 'line') {
                const geometry = window.ASMArrowModel.geometry(anchors.From, anchors.To,
                  { outerframe: true, anchor: arrow.dataset.traceArrowFromAnchor },
                  { outerframe: true, anchor: arrow.dataset.traceArrowToAnchor },
                  { width: Number(arrow.getAttribute('stroke-width')), headStart: arrow.dataset.traceArrowHeadStart,
                    headEnd: arrow.dataset.traceArrowHeadEnd });
                if (geometry) for (const end of [1, 2]) {
                  const point = new DOMPoint(Number(arrow.getAttribute(`x${end}`)), Number(arrow.getAttribute(`y${end}`)))
                    .matrixTransform(root.getCTM().inverse().multiply(arrow.getCTM()));
                  const distance = Math.hypot(point.x - geometry[`x${end}`], point.y - geometry[`y${end}`]);
                  if (distance > worst.distance) worst = { distance, role: `presented-end-${end}`,
                    actual: { x: point.x, y: point.y }, expected: { x: geometry[`x${end}`], y: geometry[`y${end}`] },
                    transform: arrow.getAttribute('transform'), ghost: Boolean(arrow.closest('.asm-trace-transition-ghost-motion')),
                    arrow: arrow.dataset.traceArrow, from: arrow.dataset.traceArrowFromKey, to: arrow.dataset.traceArrowToKey };
                }
              }
            }
          }
          await transition;
          // Exercise the alias-change hole directly against the actual SVG
          // arrow attached to merged(3,9). The natural fixture can already
          // contain a canonical snapshot key in the preceding frame.
          const root = document.querySelector('#asm-trace-root');
          const arrow = [...root.querySelectorAll('[data-trace-arrow-from-owner]')].find(el =>
            el.dataset.traceArrowFromOwner === JSON.stringify(['merge_tree', 'activation-8', '']));
          if (!arrow) throw new Error('merged(3,9) source arrow was not found');
          const start = { x: Number(arrow.dataset.traceArrowFromX), y: Number(arrow.dataset.traceArrowFromY) };
          const previous = arrow.cloneNode(false);
          previous.dataset.traceArrowFromKey = 'previous-live-merged-alias';
          previous.dataset.traceArrowFromX = String(start.x - 152);
          previous.dataset.traceArrowFromY = String(start.y - 152);
          arrow._asmArrowTween = { previous, progress: 0.5, targetColor: arrow.getAttribute('stroke'),
            targetWidth: Number(arrow.getAttribute('stroke-width')), color: (a,b) => b };
          window.ASMTraceRenderers.refreshArrows();
          const aliasProbe = Math.hypot(Number(arrow.dataset.traceArrowFromX) - start.x,
            Number(arrow.dataset.traceArrowFromY) - start.y);
          delete arrow._asmArrowTween;
          window.ASMTraceRenderers.refreshArrows();
          reports.push({ index, speed, samples, worst, aliasProbe, targetStart: targetMotion[0], targetEnd: targetMotion.at(-1) });
        }
      }
      return reports;
    }, trace);
    assert.ok(reports.every(report => report.samples > 0), `actual visible layout endpoints sampled: ${JSON.stringify(reports)}`);
    if (process.env.ASM_ARROW_DIAG) console.log(JSON.stringify(reports));
    for (const report of reports) assert.ok(report.worst.distance < 1, JSON.stringify(report));
    for (const report of reports) assert.ok(report.aliasProbe < 1, `same-node alias must not add another endpoint tween: ${JSON.stringify(report)}`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
