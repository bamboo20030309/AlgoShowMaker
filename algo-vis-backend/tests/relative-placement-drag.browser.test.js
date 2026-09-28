/**
 * 驗證展示模式拖曳相對定位物件時，以物件目前渲染位置為基準，不會先跳回原始排列位置。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('dragging a relatively placed object preserves its rendered origin', { timeout: 90000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(__dirname, '../algorithm_sample/Backtracking/hanoi-recursion.cpp'), 'utf8')
    .replace(/\r\n?/g, '\n');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    await page.evaluate(source => {
      ace.edit('editor').setValue(source, -1);
      document.querySelector('#inputArea').value = '4\n';
    }, code);
    await page.click('#runBtn');
    await page.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source,
      code, { timeout: 30000 });
    await page.click('#editAnimationBtn');
    await page.waitForFunction(() => document.body.classList.contains('asm-trace-studio-open'));

    const objectInfo = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const traceDocument = player.getDocument();
      const variableId = Object.keys(traceDocument.variables).find(id => traceDocument.variables[id]?.name === 'ans');
      const frameIndex = traceDocument.frames.findIndex(frame => frame.state?.[variableId]);
      await player.render(frameIndex, { animatePositions: false, animateEvents: false });
      const element = document.querySelector(`#asm-trace-root [data-trace-variable="${CSS.escape(variableId)}"]`);
      const key = element?.dataset.traceObjectKey || '';
      return {
        id: element?.id || '',
        key,
        binding: window.ASMTraceStudio.getBinding(key)
      };
    });
    assert.ok(objectInfo.id, 'the ans object must be rendered');

    const object = page.locator(`#${objectInfo.id}`);
    const before = await object.boundingBox();
    const origin = await object.evaluate(element => ({
      baseOffset: element.getAttribute('data-base-offset'),
      renderPosition: element.getAttribute('data-trace-render-position'),
      transform: element.getAttribute('transform')
    }));
    const startX = before.x + before.width / 2;
    const startY = before.y + Math.min(before.height / 2, 18);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY + 20, { steps: 5 });
    const during = await object.boundingBox();
    const dragDelta = await object.evaluate(element => (
      element.getAttribute('data-translate').split(',').map(Number)
    ));
    await page.mouse.up();
    await page.waitForTimeout(100);
    const after = await object.boundingBox();
    const persisted = await page.evaluate(key => window.ASMTraceStudio.getBinding(key), objectInfo.key);

    assert.ok(Math.abs((during.x - before.x) - 40) < 5,
      `ans jumped horizontally while dragging: ${JSON.stringify({ before, during, origin })}`);
    assert.ok(Math.abs((during.y - before.y) - 20) < 5,
      `ans jumped vertically while dragging: ${JSON.stringify({ before, during, origin })}`);
    assert.ok(after.x > before.x, `ans jumped left after release: ${JSON.stringify({ before, after, origin })}`);
    assert.ok(Math.abs(persisted.dx - (objectInfo.binding.dx + dragDelta[0])) < 0.01,
      `ans stored the wrong horizontal offset: ${JSON.stringify({ before: objectInfo.binding, persisted })}`);
    assert.ok(Math.abs(persisted.dy - (objectInfo.binding.dy + dragDelta[1])) < 0.01,
      `ans stored the wrong vertical offset: ${JSON.stringify({ before: objectInfo.binding, persisted })}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
