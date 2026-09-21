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
          fill: cell ? getComputedStyle(cell.querySelector(':scope > rect')).fill : ''
        };
      }, numId);
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index - 1), frameIndex);
      await page.evaluate(index => window.ASMTracePlayer.render(index, { fromIndex: index - 1 }), frameIndex);

      const presentation = await page.evaluate(({ numId, bitId, iId }) => {
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
        const highlight = [...root.querySelectorAll('[data-trace-attachment-kind="highlight"]')]
          .find(node => node.dataset.traceAttachedTo?.endsWith('#8')
            && getComputedStyle(node).display !== 'none');
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
          highlight: rect(highlight)
        };
      }, { numId, bitId, iId });

      assert.deepEqual([...new Set(presentation.dataObjects)].sort(), [bitId, numId].sort());
      assert.equal(presentation.numCellCount, 10, 'num displays the complete vector');
      assert.deepEqual(initialNum.labels, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
      assert.equal(initialNum.fill, 'rgb(204, 204, 204)');
      assert.equal(presentation.cells.length, 10);
      assert.deepEqual(presentation.labels.map(label => label.text),
        ['0001', '0010', '0011', '0100', '0101', '0110', '0111', '1000', '1001', '1010']);
      const widths = Object.fromEntries(presentation.cells.map(cell => [cell.index, cell.width]));
      assert.deepEqual(widths, { 1: 40, 2: 80, 3: 40, 4: 160, 5: 40,
        6: 80, 7: 40, 8: 320, 9: 40, 10: 80 });
      assert.equal(presentation.cells.find(cell => cell.index === 8).value, '54');
      const numCenter = presentation.numBounds.left + presentation.numBounds.width / 2;
      const bitCenter = presentation.bitBounds.left + presentation.bitBounds.width / 2;
      const scale = presentation.cells.find(cell => cell.index === 1).bounds.width / 40;
      assert.ok(Math.abs(numCenter - (bitCenter - 40 * scale)) <= 1,
        'num is horizontally placed at BIT.top offset(-40,-70)');
      assert.ok(Math.abs(presentation.bitBounds.top - presentation.numBounds.bottom - 78 * scale) <= 1,
        'num is vertically placed above BIT with the requested -70 offset');
      assert.equal(presentation.marker?.label, 'i');
      assert.ok(presentation.marker?.target?.endsWith('#8'));
      assert.ok(presentation.highlight?.width >= presentation.cells.find(cell => cell.index === 8).bounds.width
        && presentation.highlight.height > presentation.cells.find(cell => cell.index === 8).bounds.height,
      'highlight covers the wide value cell and its binary index label');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
