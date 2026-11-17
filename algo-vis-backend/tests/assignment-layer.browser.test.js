'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('falling digits remain painted above a cell promoted after the transfer starts', async t => {
  const source = fs.readFileSync(process.env.ASM_TWEEN_LAYER_SOURCE || 'public/trace-frame-tween.js', 'utf8');
  const start = source.indexOf('  function createAnimationEffectLayer(root) {');
  const end = source.indexOf('  function elementBoundsInRoot(', start);
  assert.ok(start >= 0 && end > start);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const result = await page.evaluate(factorySource => {
    const createSvg = (name, attributes) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', name);
      Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, value));
      return node;
    };
    const variableOwnerId = () => null;
    const factory = eval('(' + factorySource.trim() + ')');
    const root = createSvg('svg', { width: 200, height: 200 });
    document.body.append(root);
    const container = createSvg('g'); root.append(container);
    const cell = createSvg('g', { 'data-trace-index': '17' }); container.append(cell);
    const rectangle = createSvg('rect', { x: 0, y: 0, width: 100, height: 100, fill: 'white' }); cell.append(rectangle);
    const controller = factory(root);
    const transfer = createSvg('g', { class: 'asm-trace-assign-transfer' });
    const digit = createSvg('text', { x: 50, y: 50, 'font-size': 20 }); digit.textContent = '3'; transfer.append(digit); root.append(transfer);
    controller.sync([]);
    // The falling digit exists first; an event later promotes its destination.
    controller.sync([cell]);
    const stages = [];
    for (const y of [25, 40, 50]) {
      digit.setAttribute('y', y); controller.sync([cell]);
      stages.push(Boolean(rectangle.compareDocumentPosition(digit) & Node.DOCUMENT_POSITION_FOLLOWING));
    }
    controller.clear();
    return { stages, restored: cell.parentNode === container, transferRestored: transfer.parentNode === root };
  }, source.slice(start, end));
  assert.deepEqual(result.stages, [true, true, true], 'the falling digit must paint after the opaque destination throughout descent');
  assert.equal(result.restored, true);
  assert.equal(result.transferRestored, true);
});
