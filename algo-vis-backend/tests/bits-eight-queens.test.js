const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const {
  findFrameDirectives, findKeepDirectives, findLayoutDirectives, instrumentSource
} = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const samplePath = path.join(
  __dirname, '../algorithm_sample/Backtracking/8queen_recursion.cpp'
);
const inputPath = path.join(
  __dirname, '../algorithm_sample/Backtracking/8queen_recursion-sample_input.txt'
);

test('bits(source, width) is a frame data transform with hidden labels and symbols', () => {
  const code = fs.readFileSync(samplePath, 'utf8');
  const frames = findFrameDirectives(code);
  const [frame] = frames;
  const [keep] = findKeepDirectives(code);
  const [layout] = findLayoutDirectives(code);
  const [object] = frame.objects;

  assert.equal(object.objectId, 'chess_board');
  assert.equal(object.renderer, 'original-matrix');
  assert.equal(object.dataTransform.type, 'bits');
  assert.equal(object.dataTransform.sourceName, 'board');
  assert.equal(object.dataTransform.widthExpression, 'N');
  assert.deepEqual(object.rendererOptions.labels, { showValue: false, indexFormat: 'none' });
  assert.equal(object.rendererOptions.display.template, "${queen}${value == 1 ? '' : row == attack_row ? ((directions >= 1 && q_left) || (directions >= 2 && q_down) || (directions >= 3 && q_right) ? 1 : 0) : '　'}");
  assert.ok(frame.styles.some(style => style.when.expression === 'value == 1'));
  assert.equal(layout.mode, 'compact');
  assert.equal(layout.showEdges, true);
  assert.equal(layout.showBranchPreviews, false);
  assert.deepEqual(keep.presetNames, ['queen_board_base_view']);
  assert.equal(keep.viewFrame?.silentKeepView, true);
  assert.equal(keep.viewFrame?.styles?.length, 1);
  assert.equal(frames.length, 11, 'includes the explicit P == 0 dead-end frame');
  assert.deepEqual([frames[4], frames[6], frames[7]].map(item => (
    item.lets.find(binding => binding.name === 'directions').expression
  )), ['1', '2', '3']);
  assert.doesNotMatch(code, /@style board symbol/);
  assert.doesNotMatch(code, /cell_text/);
  assert.equal((code.match(/@let bit = 1 << \(N - 1 - column\)/g) || []).length, 1);
  assert.ok(frames.slice(0, -1).every(item => item.lets.some(binding => binding.name === 'bit')));
  assert.ok(frames.some(item => item.styles?.some(style => (
    style.color === 'AV_red' && style.when?.expression.includes('q_left')
  ))));
  assert.ok(frames.some(item => item.styles?.some(style => (
    style.color === 'AV_green' && style.when?.expression.includes('P &')
  ))));
  const lowbit = frames.find(item => item.styles?.some(style => style.styleType === 'highlight'));
  assert.deepEqual(lowbit.styles.find(style => style.styleType === 'highlight')?.selector, {
    type: 'matrix-cell', rowExpression: 'n', columnExpression: 'selected_column'
  });
  assert.doesNotMatch(code, /@layout queen_tree (?:direction|mode|sibling-gap|level-gap|degree|flow)/);
  assert.doesNotMatch(code, /vector<pair<int, int>> queens|vector<int> attacked|is_attacked/);
  assert.match(code, /int selected_column = N - 1 - __builtin_ctz\(p\)/);
  assert.match(code, /@keep board as "Q" in queen_tree use queen_board_base_view/);
});

test('eight queens sample renders transformed boards in a recursive tree',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(samplePath, 'utf8');
    const input = fs.readFileSync(inputPath, 'utf8');
    const { trace, window } = await compile(code, input);
    const variable = name => Object.entries(trace.variables)
      .find(([, item]) => item.name === name)?.[0];
    const boardId = variable('board');
    const nId = variable('n');
    const widthId = variable('N');
    assert.ok(boardId && nId && widthId);
    // Independent board search: no Trace or bit-mask parser participates.
    let visits = 0, choices = 0, solutions = 0, deadEnds = 0;
    function search(columns) {
      visits++;
      if (columns.length === 4) { solutions++; return; }
      const legal = Array.from({ length: 4 }, (_, c) => c).filter(c =>
        columns.every((old, row) => old !== c && Math.abs(old - c) !== columns.length - row));
      if (!legal.length) deadEnds++;
      for (const c of legal) { choices++; search([...columns, c]); }
    }
    search([]);
    assert.deepEqual({ visits, choices, solutions, deadEnds }, { visits: 17, choices: 16, solutions: 2, deadEnds: 4 });
    assert.equal(trace.frames.length, visits + (visits - solutions) + choices * 7 + deadEnds + 1,
      'each visit, mask, seven choice stages, dead-end and final frame is present');
    assert.equal(trace.layouts.length, 1);
    assert.equal(trace.snapshots.length, 17, 'every dfs activation becomes one tree node');
    const roots = trace.snapshots.filter(snapshot => !snapshot.layoutNode?.parentSnapshotId);
    assert.equal(roots.length, 1, 'the recursion tree has one root board');
    assert.equal(trace.snapshots.filter(snapshot => (
      snapshot.layoutNode?.parentSnapshotId === roots[0].id
    )).length, 4, 'the root branches once for each legal first-row queen');
    assert.ok(trace.snapshots.filter(snapshot => snapshot !== roots[0]).every(snapshot => (
      trace.snapshots.some(parent => parent.id === snapshot.layoutNode?.parentSnapshotId)
    )), 'every non-root board is connected to its calling dfs activation');
    assert.equal(trace.codeHideRanges.length, 1);
    assert.equal(trace.frames.some(item => (item.events || []).some(event => (
      /selected_column/.test(event.source?.text || '')
    ))), false);
    const scalar = (frame, name) => {
      const id = variable(name);
      return id ? window.ASMTraceModel.scalarValue(frame.state[id]?.data) : undefined;
    };
    const alias = (frame, name) => Number(window.ASMTraceRules.resolveTextExpression(trace, frame, name));
    const styleEntries = frame => window.ASMTraceRules.evaluate(trace, frame)[boardId] || {};
    const isTeachingFrame = (item, direction) => (
      scalar(item, 'n') === 1
      && scalar(item, 'selected_column') === 1
      && alias(item, 'attack_row') === 2
      && alias(item, 'directions') === direction
    );
    const leftMask = trace.frames.find(item => isTeachingFrame(item, 1));
    const middleMask = trace.frames.find(item => isTeachingFrame(item, 2));
    const rightMask = trace.frames.find(item => isTeachingFrame(item, 3)
      && scalar(item, 'nextR') === ((scalar(item, 'R') | scalar(item, 'p')) >> 1));
    const availableMask = trace.frames.find(item => scalar(item, 'n') === 1
      && scalar(item, 'p') == null && scalar(item, 'P') != null
      && item.styles?.some(style => style.color === 'AV_green'));
    const blockedMask = availableMask;
    const selectedLowbit = trace.frames.find(item => item.styles?.some(style => (
      style.styleType === 'highlight'
    )) && scalar(item, 'n') === 1
      && scalar(item, 'selected_column') === 1);
    const nextLeftMask = trace.frames.find(item => isTeachingFrame(item, 1)
      && scalar(item, 'nextL') === ((scalar(item, 'L') | scalar(item, 'p')) << 1));
    assert.ok(leftMask && middleMask && rightMask && blockedMask && availableMask
      && selectedLowbit && nextLeftMask);
    const cellDisplay = (frame, row, column, value = 0) => frame.rendererOptions[boardId].display.template.replace(
      /\$\{([^{}]+)\}/g, (_, expression) => window.ASMTraceRules.resolveTextExpression(
        trace, frame, expression, { row, column, index: column, value }
      ) ?? ''
    ).replace(/[ \u3000]/g, '');
    assert.equal(window.ASMTraceRules.resolveTextExpression(trace, leftMask, "value == 1 ? '' : (directions >= 1 && q_left ? '↙' : '　') + (directions >= 2 && q_down ? '↓' : '　') + (directions >= 3 && q_right ? '↘' : '　')", {row: 0, column: 3, index: 3, value: 1}), '', 'queen cells have no arrow-placeholder spaces');
    assert.equal(cellDisplay(leftMask, 2, 0), '0');
    assert.equal(cellDisplay(leftMask, 2, 2), '1');
    assert.equal(cellDisplay(availableMask, 1, 0), '1');
    assert.equal(cellDisplay(middleMask, 2, 2), '0');
    assert.equal(cellDisplay(middleMask, 2, 3), '1');
    assert.equal(cellDisplay(leftMask, 0, 2), '');
    assert.equal(styleEntries(blockedMask)['1,2']?.styleTypes?.background, 'rgba(239, 154, 154, 0.6)');
    assert.equal(styleEntries(blockedMask)['1,3']?.styleTypes?.background, 'rgba(239, 154, 154, 0.6)');
    assert.equal(styleEntries(availableMask)['1,0']?.styleTypes?.background, 'rgba(165, 214, 167, 0.6)');
    assert.equal(styleEntries(availableMask)['1,1']?.styleTypes?.background, 'rgba(165, 214, 167, 0.6)');
    assert.equal(styleEntries(availableMask)['1,2']?.styleTypes?.background, 'rgba(239, 154, 154, 0.6)');
    assert.equal(styleEntries(availableMask)['1,3']?.styleTypes?.background, 'rgba(239, 154, 154, 0.6)');
    assert.equal(Number(selectedLowbit.state[boardId].data.items[1].value), scalar(selectedLowbit, 'p'),
      'the lowbit teaching frame already contains the newly placed queen');
    assert.equal(styleEntries(selectedLowbit)['1,1']?.styleTypes?.highlight, '',
      'lowbit highlight uses the renderer default color');
    const instrumentedCode = instrumentSource(code).code;
    const suppressionStart = instrumentedCode.indexOf('TraceSuppressionScope');
    const suppressionEnd = instrumentedCode.indexOf('.release();', suppressionStart);
    assert.ok(suppressionStart >= 0 && suppressionEnd > suppressionStart,
      '@code hide suppresses the lowbit-to-column drawing helper');

    const frameIndex = trace.frames.length - 1;
    const frame = trace.frames[frameIndex];
    const boardFrame = trace.frames.find(item => item.source.primaryVariableId === boardId);
    assert.ok(boardFrame);
    assert.equal(frame.snapshotIds.length, 17,
      'the overview frame retains every accumulated keep snapshot');
    const focusedSnapshot = [...trace.snapshots].reverse().find(snapshot => (
      frame.snapshotIds?.includes(snapshot.id)
      && snapshot.data?.items?.filter(item => Number(item.value) !== 0).length === 2
    ));
    assert.ok(focusedSnapshot, 'the final frame retains a two-queen recursion board');
    assert.ok(focusedSnapshot.styleFrame?.state?.[nId],
      'the keep snapshot freezes its activation-local style state');
    assert.ok(boardFrame.captureOnlyVariableIds.includes(widthId));
    assert.deepEqual(JSON.parse(JSON.stringify(boardFrame.rendererOptions[boardId])), {
      indexMode: 0,
      showValue: false,
      display: { template: "${queen}${value == 1 ? '' : row == attack_row ? ((directions >= 1 && q_left) || (directions >= 2 && q_down) || (directions >= 3 && q_right) ? 1 : 0) : '　'}", expressions: ["queen", "value == 1 ? '' : row == attack_row ? ((directions >= 1 && q_left) || (directions >= 2 && q_down) || (directions >= 3 && q_right) ? 1 : 0) : '　'"] },
      dataTransform: { type: 'bits', width: 4, order: 'msb-first' }
    });
    const highlights = window.ASMTraceRules.evaluate(trace, {
      ...focusedSnapshot.styleFrame,
      events: [],
      styles: focusedSnapshot.styles
    });
    assert.ok(Object.keys(highlights[boardId] || {}).some(key => key.includes(',')));

    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(base + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.asmApplyTraceDocument);
      await page.evaluate(document => window.asmApplyTraceDocument(document), trace);
      const leftMaskIndex = trace.frames.indexOf(leftMask);
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index), leftMaskIndex);
      await page.waitForFunction(() => !document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
      const leftMaskDom = await page.evaluate(() => ({
        objects: [...document.querySelectorAll('#asm-trace-root > .asm-trace-object')].map(object => ({
          key: object.dataset.traceObjectKey || '',
          snapshot: object.dataset.traceSnapshot || '',
          leftDown: [...object.querySelectorAll('[data-trace-index] > text')].filter(text => text.textContent.trim() === '↙').length
        })),
        leftDownTotal: [...document.querySelectorAll('#asm-trace-root [data-trace-snapshot] [data-trace-index] > text')].filter(text => text.textContent.trim() === '↙').length
      }));
      assert.equal(leftMaskDom.leftDownTotal, 0,
        'Q displays numeric bits, not attack arrows');
      assert.ok(leftMaskDom.objects.some(object => object.key === 'Q_1' && object.leftDown === 0));
      const masks = await page.evaluate(ids => {
        const root = document.getElementById('asm-trace-root');
        const info = key => {
          const object = [...root.querySelectorAll(':scope > .asm-trace-object')]
            .find(node => node.dataset.traceObjectKey === key
              || node.dataset.traceVariable === key);
          if (!object) return null;
          const cells = [...object.querySelectorAll('[data-trace-index]')]
            .filter(cell => !cell.hasAttribute('data-trace-index-label'));
          return {
            placement: window.ASMTraceRenderers.currentPlacement(object.dataset.traceObjectKey),
            glyphs: cells.map(cell => [...cell.querySelectorAll(':scope > text')]
              .map(text => text.textContent.trim()).join('').replace(/[ \u3000]/g, '')),
            red: cells.map(cell => (cell.querySelector(':scope > rect')?.getAttribute('fill') || '')
              .includes('239, 154, 154'))
          };
        };
        return { board: info('Q_1'), rows: ids.map(info) };
      }, [variable('maskL'), variable('maskM'), variable('maskR')]);
      assert.ok(masks.rows.every(Boolean), 'three attack-mask arrays exist beside the active board');
      assert.deepEqual(masks.rows.map(row => row.glyphs), [
        ['', '↙', '↙', ''], ['', '', '', '↓'], ['', '', '', '']
      ]);
      assert.deepEqual(masks.rows.map(row => row.red), [
        [false, true, true, false], [false, false, false, true],
        [false, false, false, false]
      ]);
      const [l, m, r] = masks.rows.map(row => row.placement);
      assert.ok(Math.abs(l.y - masks.board.placement.y) < 0.1);
      assert.ok(l.x >= masks.board.placement.x + masks.board.placement.width);
      for (const [previous, next] of [[l, m], [m, r]]) {
        assert.ok(Math.abs(previous.x - next.x) < 0.1, JSON.stringify({ previous, next }));
        assert.ok(next.y >= previous.y + previous.height);
      }
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index),
        trace.frames.indexOf(availableMask));
      const union = await page.evaluate(() => {
        const object = [...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
          .find(node => node.dataset.traceObjectKey === 'mask_union');
        if (!object) return null;
        const cells = [...object.querySelectorAll('[data-trace-index]')]
          .filter(cell => !cell.hasAttribute('data-trace-index-label'));
        return {
          glyphs: cells.map(cell => cell.querySelector(':scope > text')?.textContent.trim() || ''),
          placement: window.ASMTraceRenderers.currentPlacement(object.dataset.traceObjectKey)
        };
      });
      assert.ok(union, 'candidate mask appears only while P is being explained');
      assert.deepEqual(union.glyphs, ['1', '1', '0', '0']);
      assert.ok(Math.abs(r.x - union.placement.x) < 0.1);
      assert.ok(union.placement.y >= r.y + r.height);
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index),
        trace.frames.indexOf(middleMask));
      await page.waitForFunction(() => !document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
      const middleSymbols = await page.evaluate(() => (
        [...document.querySelectorAll('#asm-trace-root [data-trace-snapshot] [data-trace-index] > text')]
          .map(item => item.textContent).join('')
      ));
      assert.ok(middleSymbols.includes('0') && middleSymbols.includes('1'));
      assert.doesNotMatch(middleSymbols, /[↙↓↘]/);
      assert.equal(middleSymbols.includes('↘'), false,
        'the M frame retains L and adds M without showing R early');
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index),
        trace.frames.indexOf(rightMask));
      await page.waitForFunction(() => !document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
      const rightSymbols = await page.evaluate(() => (
        [...document.querySelectorAll('#asm-trace-root [data-trace-snapshot] [data-trace-index] > text')]
          .map(item => item.textContent).join('')
      ));
      assert.doesNotMatch(rightSymbols, /[↙↓↘]/,
        'Q remains numeric after all masks are merged');
      const unionSymbols = await page.evaluate(() => [...document.querySelectorAll(
        '#asm-trace-root [data-trace-object-key="mask_union"] [data-trace-index] > text'
      )].map(text => text.textContent.trim()));
      assert.deepEqual(unionSymbols, [],
        'P is hidden while the three next-row attack masks are being taught');
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index),
        trace.frames.indexOf(nextLeftMask));
      await page.waitForFunction(() => !document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
      const nextLeftDom = await page.evaluate(() => (
        [...document.querySelectorAll('#asm-trace-root > .asm-trace-object')].map(object => {
          const cells = [...object.querySelectorAll('[data-trace-index]')];
          return {
            grey: cells.filter(cell => {
              const fill = cell.querySelector(':scope > rect')?.getAttribute('fill') || '';
              return fill === 'grey' || fill === '#cccccc' || fill.includes('204, 204, 204');
            }).length,
            leftDown: cells.filter(cell => (
              [...cell.querySelectorAll(':scope > text')].some(text => text.textContent.trim() === '1')
            )).length
          };
        })
      ));
      assert.ok(nextLeftDom.some(board => board.grey === 2 && board.leftDown === 2),
        'board[n] and nextL update queens and next-row numeric bits together');
      const stageFrames = ['nextL', 'nextM', 'nextR'].map(name => trace.frames.find(item =>
        Number(alias(item, 'directions')) === ({ nextL: 1, nextM: 2, nextR: 3 })[name]
        && alias(item, 'attack_row') === scalar(item, 'n') + 1
        && scalar(item, 'n') === 1 && scalar(item, 'selected_column') === 1
        && (name !== 'nextL' || scalar(item, 'nextL') === ((scalar(item, 'L') | scalar(item, 'p')) << 1))
        && (name !== 'nextR' || scalar(item, 'nextR') === ((scalar(item, 'R') | scalar(item, 'p')) >> 1))));
      assert.ok(stageFrames.every(Boolean));
      for (const name of ['nextL', 'nextR']) {
        const shiftFrame = stageFrames[name === 'nextL' ? 0 : 2];
        const before = trace.frames[trace.frames.indexOf(shiftFrame) - 1];
        const parent = name === 'nextL' ? 'L' : 'R';
        assert.equal(scalar(before, name), scalar(before, parent) | scalar(before, 'p'));
        assert.equal(scalar(shiftFrame, name), name === 'nextL'
          ? scalar(before, name) << 1 : scalar(before, name) >> 1);
        assert.equal(cellDisplay(before, 1, 2).trim(), '', 'old-row attack arrows are cleared');
        assert.equal(styleEntries(before)['1,2']?.styleTypes?.background, undefined,
          'old-row red background is cleared');
        await page.evaluate(index => window.ASMTracePlayer.renderStable(index), trace.frames.indexOf(before));
        await page.waitForFunction(() => !document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
        const glyphs = await page.evaluate(key => [...document.querySelectorAll(
          `#asm-trace-root [data-trace-object-key="${key}"] [data-trace-index] > text`
        )].map(text => text.textContent.trim()), name === 'nextL' ? 'mask_L' : 'mask_R');
        assert.deepEqual(glyphs, Array.from({ length: 4 }, (_, column) =>
          scalar(before, name) & (1 << (3 - column)) ? (name === 'nextL' ? '↙' : '↘') : ''));
        const shiftProbe = await page.evaluate(async ({ index }) => {
          const doc = ASMTracePlayer.getDocument(), frame = doc.frames[index];
          const elements = () => new Map([...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
            .map(node => [node.dataset.traceObjectKey, node]));
          const previous = new Map([...elements()].map(([key, node]) => [key, node.cloneNode(true)]));
          await ASMTracePlayer.renderStable(index);
          const event = frame.events.find(event => event.bitShift);
          const targets = ASMTraceFrameTween.bitShiftTargets(doc, frame, event, elements());
          const effect = ASMTraceFrameTween.createBitShiftEffect(event, doc, frame, elements(), previous);
          effect.update(260);
          const motion = document.querySelector('[data-trace-bit-shift-motion]');
          const result = { keys: targets.map(target => target.element.dataset.traceObjectKey),
            transform: motion?.getAttribute('transform'),
            glyphs: [...motion.querySelectorAll('text')].map(text => text.textContent.trim()) };
          effect.remove();
          return result;
        }, { index: trace.frames.indexOf(shiftFrame) });
        assert.deepEqual(shiftProbe.keys, [name === 'nextL' ? 'mask_L' : 'mask_R'],
          'identity @let aliases shift, but derived union and retained boards do not');
        assert.ok(shiftProbe.transform.includes(name === 'nextL' ? '-20' : '20'));
        assert.deepEqual(shiftProbe.glyphs, glyphs, 'the moving contents use the event before-value');
      }
      for (let stage = 0; stage < stageFrames.length; stage++) {
        const item = stageFrames[stage];
        await page.evaluate(index => window.ASMTracePlayer.renderStable(index), trace.frames.indexOf(item));
        await page.waitForFunction(() => !document.querySelector('#asm-trace-root [data-asm-lod-pending]'));
        const actual = await page.evaluate(() => {
          const rows = ['mask_L', 'mask_M', 'mask_R', 'mask_union'].map(key => {
            const objects = [...document.querySelectorAll(`#asm-trace-root [data-trace-object-key="${key}"]`)];
            return {
              count: objects.length,
              cells: [...(objects[0]?.querySelectorAll('[data-trace-index]') || [])]
                .filter(cell => !cell.hasAttribute('data-trace-index-label'))
                .map(cell => ({
                  text: [...cell.querySelectorAll(':scope > text')].map(text => text.textContent.trim()).join('').replace(/[ \u3000]/g, ''),
                  red: (cell.querySelector(':scope > rect')?.getAttribute('fill') || '').includes('239, 154, 154')
                }))
            };
          });
          const board = document.querySelector('#asm-trace-root [data-trace-object-key="Q_1"]');
          const boardCells = Array.from({length: 4}, (_, column) => {
            const cell = board.querySelector(`[data-trace-index="2,${column}"]`);
            return {text: cell.querySelector(':scope > text')?.textContent,
              red: (cell.querySelector(':scope > rect')?.getAttribute('fill') || '').includes('239, 154, 154')};
          });
          return { rows, boardCells };
        });
        const values = [scalar(item, 'nextL'), scalar(item, stage >= 1 ? 'nextM' : 'M'),
          scalar(item, stage >= 2 ? 'nextR' : 'R')];
        const unionValues = ['L', 'M', 'R'].map(name => scalar(item, name));
        const arrows = ['↙', '↓', '↘'];
        assert.ok(actual.rows.slice(0, 3).every(row => row.count === 1)
          && actual.rows[3].count === 0, JSON.stringify({stage, actual}));
        assert.deepEqual(actual.rows.slice(0, 3).map(row => row.cells), values.map((value, row) =>
          Array.from({ length: 4 }, (_, column) => ({
            text: value & (1 << (3 - column)) ? arrows[row] : '',
            red: Boolean(value & (1 << (3 - column)))
          }))));
        const activeMask = values.slice(0, stage + 1).reduce((mask, value) => mask | value, 0);
        assert.deepEqual(actual.boardCells, Array.from({length: 4}, (_, column) => ({
          text: activeMask & (1 << (3 - column)) ? '1' : '0',
          red: Boolean(activeMask & (1 << (3 - column)))
        })), 'Q shows red 1 and white 0 on the teaching row');
      }
      const shiftedIndex = trace.frames.indexOf(stageFrames[2]);
      assert.equal(alias(trace.frames[shiftedIndex], 'maskP'),
        scalar(stageFrames[2], 'L') | scalar(stageFrames[2], 'M') | scalar(stageFrames[2], 'R'),
        'right-shift result frame must not update P early');
      const mergedIndex = shiftedIndex + 1;
      const mergedFrame = trace.frames[mergedIndex];
      assert.equal(alias(mergedFrame, 'maskP'), 0,
        'the recursive-call frame does not reuse P as a drawing alias');
      assert.equal(Boolean(mergedFrame.rendererOptions?.mask_union), false,
        'P stays hidden while the next-row masks are passed to recursion');
      assert.equal(alias(mergedFrame, 'maskL'), scalar(mergedFrame, 'nextL'));
      assert.equal(alias(mergedFrame, 'maskM'), scalar(mergedFrame, 'nextM'));
      assert.equal(alias(mergedFrame, 'maskR'), scalar(mergedFrame, 'nextR'));
      assert.ok(availableMask.events.some(event =>
        event.type === 'declare' && event.name === 'P' && event.enabled),
      'P declaration remains tracked on the candidate frame');
      assert.ok(availableMask.events.some(event =>
        event.type === 'assign' && event.expression === 'P = ((1 << N) - 1) & ~(L | M | R)'),
      'the complete candidate-mask initializer remains one assignment');
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index), frameIndex);
      // The last scene-only frame intentionally starts an auto-camera tween.
      // Let that bounded transition settle before issuing the manual LOD probe.
      await page.waitForTimeout(700);
      await page.evaluate(snapshotId => {
        const snapshot = document.querySelector(
          `#asm-trace-root > [data-trace-snapshot="${CSS.escape(snapshotId)}"]`
        );
        const placement = window.ASMTraceRenderers.currentPlacement(
          snapshot?.dataset.traceObjectKey
        );
        if (!placement) return;
        const point = {
          x: placement.x + placement.width / 2,
          y: placement.y + placement.height / 2
        };
        window.__queenLodCameraPoint = point;
        setCamera(point.x, point.y, 1, false);
        ASMStructureLOD.refresh();
      }, focusedSnapshot.id);
      await page.waitForFunction(snapshotId => {
        const snapshot = document.querySelector(
          `#asm-trace-root > [data-trace-snapshot="${CSS.escape(snapshotId)}"]`
        );
        return snapshot?.querySelector('[data-asm-lod]')?.dataset.asmLod === 'full'
          && !snapshot.querySelector('[data-asm-lod-pending]');
      }, focusedSnapshot.id);
      const boards = await page.evaluate(() => (
        [...document.querySelectorAll('#asm-trace-root > [data-trace-snapshot]')]
          .map(group => {
            const cells = [...group.querySelectorAll('[data-trace-index]')]
              .filter(cell => !cell.hasAttribute('data-trace-index-label'));
            return {
              cells: cells.length,
              queens: cells.filter(cell => cell.querySelector('text')?.textContent === '♕').length,
              numericLabels: cells.filter(cell => /^(?:0|1)$/.test(
                cell.querySelector('text')?.textContent?.trim() || ''
              )).length,
              red: cells.filter(cell => (
                cell.querySelector(':scope > rect')?.getAttribute('fill') || ''
              ).includes('239, 154, 154')).length,
              grey: cells.filter(cell => {
                const fill = cell.querySelector(':scope > rect')?.getAttribute('fill') || '';
                return fill === 'grey' || fill === '#cccccc' || fill.includes('204, 204, 204');
              }).length
            };
          })
      ));
      assert.ok(boards.some(board => (
        board.cells === 16 && board.queens === 2 && board.grey === 2 && board.red === 0
      )));
      assert.ok(boards.every(board => board.numericLabels === 0));
      assert.equal(await page.locator(`[data-trace-variable="${widthId}"]`).count(), 0);
      const lodCoverage = await page.evaluate(() => {
        const objects = [...document.querySelectorAll('#asm-trace-root .asm-trace-object')];
        const arrows = [...document.querySelectorAll(
          '#asm-trace-root [data-trace-arrow], #asm-trace-root .asm-trace-layout-edge, #asm-trace-root .asm-trace-keep-arrow'
        )];
        const boards = [...document.querySelectorAll('#asm-trace-root > [data-trace-snapshot]')];
        return {
          objects: objects.length,
          objectStates: objects.filter(node => node.hasAttribute('data-asm-object-lod')).length,
          arrows: arrows.length,
          arrowStates: arrows.filter(node => node.hasAttribute('data-asm-object-lod')).length,
          boards: boards.length,
          boardStructures: boards.filter(node => node.querySelector('[data-asm-lod]')).length
        };
      });
      assert.ok(lodCoverage.objects > 0 && lodCoverage.arrows > 0 && lodCoverage.boards > 0);
      assert.equal(lodCoverage.objectStates, lodCoverage.objects,
        'every canvas object participates in object-level LOD');
      assert.equal(lodCoverage.arrowStates, lodCoverage.arrows,
        'every canvas arrow participates in object-level LOD');
      assert.equal(lodCoverage.boardStructures, lodCoverage.boards,
        'every kept recursion board participates in cell-level LOD');
      await page.evaluate(() => {
        setCamera(window.__queenLodCameraPoint.x, window.__queenLodCameraPoint.y, 0.1, false);
        ASMStructureLOD.refresh();
      });
      await page.waitForFunction(() => {
        const objects = [...document.querySelectorAll(
          '#asm-trace-root .asm-trace-object, #asm-trace-root [data-trace-arrow], #asm-trace-root .asm-trace-layout-edge, #asm-trace-root .asm-trace-keep-arrow'
        )];
        const structures = [...document.querySelectorAll('#asm-trace-root [data-asm-lod]')];
        return objects.length > 0 && structures.length > 0
          && objects.every(node => node.dataset.asmObjectLod === 'overview')
          && structures.every(node => node.dataset.asmLod === 'overview');
      });
      const overviewBoards = await page.evaluate(() => (
        [...document.querySelectorAll('#asm-trace-root > [data-trace-snapshot] [data-asm-lod]')]
          .map(board => ({
            detailHosts: board.querySelectorAll('[data-asm-lod-detail]').length,
            hiddenDetails: [...board.querySelectorAll('[data-asm-lod-detail]')]
              .every(host => getComputedStyle(host).display === 'none'),
            fillPaths: board.querySelectorAll('[data-asm-lod-batch="fill"]').length,
            gridPaths: board.querySelectorAll('[data-asm-lod-grid]').length,
            gridGeometry: [...board.querySelectorAll('[data-asm-lod-grid]')]
              .every(path => Boolean(path.getAttribute('d')))
          }))
      ));
      assert.ok(overviewBoards.length > 0);
      assert.ok(overviewBoards.every(board => board.detailHosts > 0 && board.hiddenDetails),
        'overview unloads complete cell groups from the painted SVG tree');
      assert.ok(overviewBoards.every(board => board.fillPaths > 0
        && board.gridPaths > 0 && board.gridGeometry),
      'overview retains every cell background and the complete board grid as batched paths');
      const overviewEdges = await page.evaluate(() => {
        const root = document.getElementById('asm-trace-root');
        return [...document.querySelectorAll('#asm-trace-root .asm-trace-layout-edge')]
          .map(edge => {
            const target = document.querySelector(
              `[data-trace-object-key="${CSS.escape(edge.dataset.traceArrowToKey)}"]`
            );
            const box = window.ASMArrowModel.presentedBounds(target, root, true);
            return {
              lod: edge.dataset.asmObjectLod,
              markerEnd: getComputedStyle(edge).markerEnd,
              endpointError: box ? Math.hypot(
                Number(edge.dataset.traceArrowToX) - (box.x + box.width / 2),
                Number(edge.dataset.traceArrowToY) - box.y
              ) : Infinity
            };
          });
      });
      assert.ok(overviewEdges.length > 0);
      assert.ok(overviewEdges.every(edge => edge.lod === 'overview'));
      assert.ok(overviewEdges.every(edge => edge.markerEnd !== 'none'),
        'overview LOD keeps the shared arrowhead that reaches the bound outerframe');
      assert.ok(overviewEdges.every(edge => edge.endpointError < 0.1),
        'recursion edge targets stay bound to each board outerframe while zoomed out');
      assert.equal(await page.locator(
        '#asm-trace-root > [data-trace-snapshot] [data-trace-index] > text'
      ).count(), 0, 'zoomed-out recursion boards omit cell glyphs');
      await page.evaluate(() => {
        setCamera(window.__queenLodCameraPoint.x, window.__queenLodCameraPoint.y, 1, false);
        ASMStructureLOD.refresh();
      });
      await page.waitForFunction(snapshotId => {
        const snapshot = document.querySelector(
          `#asm-trace-root > [data-trace-snapshot="${CSS.escape(snapshotId)}"]`
        );
        return snapshot?.querySelector('[data-asm-lod]')?.dataset.asmLod === 'full'
          && !snapshot.querySelector('[data-asm-lod-pending]')
          && [...snapshot.querySelectorAll('[data-trace-index] > text')]
            .some(node => node.textContent === '♕');
      }, focusedSnapshot.id);
      assert.equal(await page.locator(
        '#asm-trace-root > [data-trace-snapshot] [data-asm-lod-detail]'
      ).count(), 0, 'full LOD restores cell groups from the overview detail host');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
