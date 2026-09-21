const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('Binary Indexed Tree renders padded binary labels and aligned wide cells',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const code = fs.readFileSync(
      path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree.cpp'), 'utf8'
    );
    const input = fs.readFileSync(
      path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree-sample_input.txt'), 'utf8'
    );
    const { trace } = await compile(code, input);
    const variable = (name, functionName = '') => Object.entries(trace.variables)
      .find(([, item]) => item.name === name && (!functionName || item.functionName === functionName))?.[0];
    const numId = variable('num');
    const bitId = variable('BIT');
    const iId = variable('i', 'build');
    assert.ok(numId && bitId && iId);
    const frameIndex = trace.frames.findLastIndex(frame => (
      frame.source?.function === 'build'
      && Number(frame.state?.[iId]?.data?.value) === 8
      && frame.events.some(event => event.type === 'write'
        && event.targets?.some(target => target.variableId === bitId && target.resolvedIndex === 8))
    ));
    assert.ok(frameIndex > 0, 'sample must contain the update frame for index 8');
    const write = trace.frames[frameIndex].events.find(event => event.type === 'write'
      && event.targets?.some(target => target.variableId === bitId && target.resolvedIndex === 8));
    const source = write.targets.find(target => target.role === 'source');
    assert.equal(source.variableId, numId);
    const sourceIndex = source.resolvedIndex;
    const sourceValue = String(trace.frames[frameIndex].state[numId].data.items[sourceIndex].value);
    const markerMoveFrameIndex = trace.frames.findIndex(frame => (
      frame.source?.function === 'build'
      && frame.events.some(event => event.expression === 'i += lb'
        && Number(event.payload?.before?.value) === 1
        && Number(event.payload?.after?.value) === 2)
    ));
    assert.ok(markerMoveFrameIndex > 0, 'sample must contain an i += lb marker move');
    const overflowMoveFrameIndex = trace.frames.findIndex(frame => (
      frame.source?.function === 'build'
      && frame.events.some(event => event.expression === 'i += lb'
        && Number(event.payload?.before?.value) === 8
        && Number(event.payload?.after?.value) === 16)
    ));
    assert.ok(overflowMoveFrameIndex > 0, 'sample must contain the terminal i: 8 -> 16 move');

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
      await page.evaluate(source => window.asmApplyTraceDocument(source), trace);
      await page.evaluate(() => window.ASMTracePlayer.renderStable(0));
      const initialNum = await page.evaluate(numId => {
        const num = document.querySelector(`[data-trace-variable="${CSS.escape(numId)}"]`);
        const cell = num?.querySelector('[data-trace-index="0"]');
        return {
          labels: [...(num?.querySelectorAll('[data-trace-index-label]') || [])]
            .map(node => node.textContent.trim()),
          value: cell?.dataset.traceDataValue || '',
          fill: cell ? getComputedStyle(cell.querySelector(':scope > rect')).fill : ''
        };
      }, numId);
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index - 1), frameIndex);
      const transfer = await page.evaluate(async index => {
        const player = window.ASMTracePlayer;
        const samples = [];
        let settled = false;
        const transition = player.render(index, { fromIndex: index - 1 }).finally(() => { settled = true; });
        for (let count = 0; count < 180 && !settled; count++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const root = document.querySelector('#asm-trace-root');
          const moving = root?.querySelector('.asm-trace-assign-transfer-value');
          const movingText = moving?.querySelector('text');
          if (moving && movingText) {
            samples.push({
              value: movingText.textContent,
              transform: moving.getAttribute('transform') || ''
            });
          }
        }
        await transition;
        return samples;
      }, frameIndex);

      const presentation = await page.evaluate(({ numId, bitId, iId, sourceIndex }) => {
        const root = document.querySelector('#asm-trace-root');
        const object = id => root.querySelector(`[data-trace-variable="${CSS.escape(id)}"]`);
        const num = object(numId);
        const bit = object(bitId);
        const rect = node => {
          const box = node?.getBoundingClientRect?.();
          return box && { left: box.left, top: box.top, width: box.width, height: box.height,
            right: box.right, bottom: box.bottom };
        };
        const cells = [...bit.querySelectorAll('[data-trace-index]')]
          .filter(node => !node.dataset.traceContentRole)
          .map(node => ({
            index: Number(node.dataset.traceIndex),
            value: node.dataset.traceDataValue,
            width: Number(node.querySelector(':scope > rect')?.getAttribute('width')),
            bounds: rect(node.querySelector(':scope > rect'))
          }));
        const labels = [...bit.querySelectorAll('[data-trace-index-label]')]
          .map(node => ({ index: Number(node.dataset.traceIndexLabel), text: node.textContent.trim() }));
        const marker = [...root.querySelectorAll('.asm-trace-bound-object')]
          .find(node => node.dataset.traceSourceVariableId === iId);
        const highlights = [...root.querySelectorAll('[data-trace-attachment-kind="highlight"]')]
          .filter(node => getComputedStyle(node).display !== 'none');
        const highlight = highlights
          .find(node => node.dataset.traceAttachedTo === `${bitId}#8`
            && getComputedStyle(node).display !== 'none');
        const numHighlight = highlights
          .find(node => node.dataset.traceAttachedTo === `${numId}#${sourceIndex}`);
        return {
          dataObjects: [...root.querySelectorAll('.asm-trace-object[data-trace-variable]')]
            .map(node => node.dataset.traceVariable),
          numBounds: rect(num), bitBounds: rect(bit),
          numCellCount: [...num.querySelectorAll('[data-trace-index]')]
            .filter(node => !node.dataset.traceContentRole).length,
          cells, labels,
          marker: marker && {
            label: marker.querySelector('.trace-variable-marker-label-text')?.textContent,
            target: marker.dataset.traceBindingTarget,
            bounds: rect(marker)
          },
          highlight: rect(highlight),
          numHighlight: rect(numHighlight)
        };
      }, { numId, bitId, iId, sourceIndex });

      assert.deepEqual([...new Set(presentation.dataObjects)].sort(), [bitId, numId].sort());
      assert.equal(presentation.numCellCount, 11, 'num displays the leading zero and all input values');
      assert.deepEqual(initialNum.labels, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
      assert.equal(initialNum.value, '0');
      assert.equal(initialNum.fill, 'rgb(204, 204, 204)');
      assert.equal(presentation.cells.length, 10);
      assert.deepEqual(presentation.labels.map(label => label.text),
        ['0001', '0010', '0011', '0100', '0101', '0110', '0111', '1000', '1001', '1010']);
      const widths = Object.fromEntries(presentation.cells.map(cell => [cell.index, cell.width]));
      assert.deepEqual(widths, { 1: 40, 2: 80, 3: 40, 4: 160, 5: 40,
        6: 80, 7: 40, 8: 320, 9: 40, 10: 80 });
      assert.equal(presentation.cells.find(cell => cell.index === 8).value, '54');
      assert.ok(transfer.some(sample => sample.value === sourceValue),
        `num[${sourceIndex}] value is copied into the assignment transfer`);
      const transferTransforms = new Set(transfer.filter(sample => sample.value === sourceValue)
        .map(sample => sample.transform));
      assert.ok(transferTransforms.size > 2,
        `num[${sourceIndex}] value visibly travels to BIT[8]`);
      const scale = presentation.cells.find(cell => cell.index === 1).bounds.width / 40;
      assert.ok(Math.abs(presentation.numBounds.left - (presentation.bitBounds.left - 40 * scale)) <= 1,
        'num.left-bottom uses BIT.left-top offset -40 on x');
      assert.ok(Math.abs(presentation.numBounds.bottom - (presentation.bitBounds.top - 70 * scale)) <= 1,
        'num.left-bottom uses BIT.left-top offset -70 on y');
      assert.equal(presentation.marker?.label, 'i');
      assert.ok(presentation.marker?.target?.endsWith('#8'));
      assert.ok(presentation.highlight?.width >= presentation.cells.find(cell => cell.index === 8).bounds.width
        && presentation.highlight.height > presentation.cells.find(cell => cell.index === 8).bounds.height,
      'highlight covers the wide value cell and its binary index label');
      assert.ok(presentation.numHighlight, `build highlights the current source cell num[${sourceIndex}]`);
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index - 1), markerMoveFrameIndex);
      const markerMotion = await page.evaluate(async ({ index, iId }) => {
        const samples = [];
        let settled = false;
        const transition = window.ASMTracePlayer.render(index, { fromIndex: index - 1 })
          .finally(() => { settled = true; });
        for (let count = 0; count < 180 && !settled; count++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const marker = [...document.querySelectorAll('#asm-trace-root .asm-trace-bound-object')]
            .find(node => node.dataset.traceSourceVariableId === iId);
          const box = marker?.getBoundingClientRect?.();
          if (box) samples.push({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
        }
        await transition;
        return samples;
      }, { index: markerMoveFrameIndex, iId });
      const markerPositions = new Set(markerMotion.map(point => (
        `${Math.round(point.x * 10) / 10},${Math.round(point.y * 10) / 10}`
      )));
      assert.ok(markerPositions.size > 2, 'i += lb visibly moves the i marker between BIT cells');
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index - 1), overflowMoveFrameIndex);
      const overflowMotion = await page.evaluate(async ({ index, iId, bitId }) => {
        const samples = [];
        let settled = false;
        const transition = window.ASMTracePlayer.render(index, { fromIndex: index - 1 })
          .finally(() => { settled = true; });
        for (let count = 0; count < 180 && !settled; count++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const root = document.querySelector('#asm-trace-root');
          const marker = [...root.querySelectorAll('.asm-trace-bound-object')]
            .find(node => node.dataset.traceSourceVariableId === iId);
          const bit = root.querySelector(`[data-trace-variable="${CSS.escape(bitId)}"]`);
          const markerBox = marker?.getBoundingClientRect?.();
          const bitBox = bit?.getBoundingClientRect?.();
          if (markerBox && bitBox) samples.push({
            x: markerBox.left + markerBox.width / 2,
            bitLeft: bitBox.left,
            bitRight: bitBox.right
          });
        }
        await transition;
        return samples;
      }, { index: overflowMoveFrameIndex, iId, bitId });
      assert.ok(overflowMotion.length > 2);
      const overflowOutside = overflowMotion.filter(sample => (
        sample.x < sample.bitLeft - 1 || sample.x > sample.bitRight + 1
      ));
      assert.ok(overflowOutside.length === 0,
        `i: 8 -> 16 stays within BIT bounds; outside=${JSON.stringify(overflowOutside.slice(0, 5))}`);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
