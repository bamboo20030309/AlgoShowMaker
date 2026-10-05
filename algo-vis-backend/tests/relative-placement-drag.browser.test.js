/**
 * 驗證動畫展示畫布拖曳相對定位物件時，保留指令指定的來源錨點，
 * 並以目前渲染位置為基準提交位移。測試使用使用者回報的完整河內塔案例，
 * 且選擇 ans 已累積多筆資料的末幀，避免空陣列掩蓋錨點方向錯誤。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const parsePair = value => String(value || '').split(',').map(Number);

test('dragging populated relative ans preserves its top-left anchor and rendered origin', { timeout: 90000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(__dirname, 'fixtures/hanoi-relative-ans-drag.cpp'), 'utf8')
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
    await page.locator('#editAnimationBtn').click();
    await page.waitForFunction(() => document.body.classList.contains('asm-trace-studio-open'));

    const objectInfo = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const traceDocument = player.getDocument();
      const variableId = Object.keys(traceDocument.variables).find(id => traceDocument.variables[id]?.name === 'ans');
      const frameIndex = traceDocument.frames.findLastIndex(frame => frame.state?.[variableId]);
      await player.render(frameIndex, { animatePositions: false, animateEvents: false });
      await new Promise(resolve => setTimeout(resolve, 700));
      const element = document.querySelector(`#asm-trace-root [data-trace-variable="${CSS.escape(variableId)}"]`);
      const box = element?.getBoundingClientRect();
      let grab = null;
      for (let y = box?.top + 1; !grab && y < box?.bottom; y += 2) {
        for (let x = box?.left + 1; x < box?.right; x += 2) {
          const hit = document.elementFromPoint(x, y)?.closest?.('.asm-trace-selectable[data-trace-object-key]');
          if (hit?.dataset.traceObjectKey === variableId) {
            grab = { x, y };
            break;
          }
        }
      }
      return {
        id: element?.id || '',
        key: variableId,
        grab,
        box: box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom } : null,
        binding: window.ASMTraceStudio.getBinding(variableId),
        renderPosition: String(element?.dataset.traceRenderPosition || '').split(',').map(Number)
      };
    });
    assert.ok(objectInfo.id, 'the ans object must be rendered');
    assert.ok(objectInfo.grab, `the populated ans outer frame must expose a drag point: ${JSON.stringify(objectInfo)}`);
    assert.equal(objectInfo.binding.sourceAnchor, 'top-left');
    assert.equal(objectInfo.binding.targetAnchor, 'top-right');
    assert.equal(objectInfo.binding.dx, 150);
    assert.equal(objectInfo.binding.dy, 0);

    const object = page.locator(`#${objectInfo.id}`);
    const before = await object.boundingBox();
    await page.mouse.move(objectInfo.grab.x, objectInfo.grab.y);
    await page.mouse.down();
    await page.mouse.move(objectInfo.grab.x + 40, objectInfo.grab.y + 20, { steps: 5 });
    const during = await object.boundingBox();
    const dragDelta = await object.evaluate(element => (
      String(element.getAttribute('data-translate') || '').split(',').map(Number)
    ));
    await page.mouse.up();
    await page.waitForFunction(id => document.getElementById(id)?.getAttribute('data-translate') === '0,0', objectInfo.id);

    const result = await page.evaluate(({ id, key }) => {
      const element = document.getElementById(id);
      return {
        binding: window.ASMTraceStudio.getBinding(key),
        renderPosition: String(element?.dataset.traceRenderPosition || '').split(',').map(Number)
      };
    }, { id: objectInfo.id, key: objectInfo.key });

    assert.ok(Math.abs((during.x - before.x) - 40) < 5,
      `ans jumped horizontally while dragging: ${JSON.stringify({ before, during })}`);
    assert.ok(Math.abs((during.y - before.y) - 20) < 5,
      `ans jumped vertically while dragging: ${JSON.stringify({ before, during })}`);
    assert.equal(result.binding.sourceAnchor, 'top-left');
    assert.ok(Math.abs(result.binding.dx - (objectInfo.binding.dx + dragDelta[0])) < 0.01);
    assert.ok(Math.abs(result.binding.dy - (objectInfo.binding.dy + dragDelta[1])) < 0.01);
    assert.ok(Math.abs(result.renderPosition[0] - (objectInfo.renderPosition[0] + dragDelta[0])) < 0.01,
      `ans resolved to the wrong horizontal position after release: ${JSON.stringify({ before: objectInfo.renderPosition, dragDelta, after: result.renderPosition })}`);
    assert.ok(Math.abs(result.renderPosition[1] - (objectInfo.renderPosition[1] + dragDelta[1])) < 0.01,
      `ans resolved to the wrong vertical position after release: ${JSON.stringify({ before: objectInfo.renderPosition, dragDelta, after: result.renderPosition })}`);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('dragging ans on frame 40 after closing the animation editor preserves its rendered origin', { timeout: 90000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(__dirname, 'fixtures/hanoi-relative-ans-drag.cpp'), 'utf8')
    .replace(/\r\n?/g, '\n');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    await page.evaluate(source => {
      ace.edit('editor').setValue(source, -1);
      document.querySelector('#inputArea').value = '4\n';
    }, code);
    await page.click('#runBtn');
    await page.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source,
      code, { timeout: 30000 });
    await page.locator('#editAnimationBtn').click();
    await page.waitForFunction(() => document.body.classList.contains('asm-trace-studio-open'));

    const objectInfo = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const traceDocument = player.getDocument();
      const variableId = Object.keys(traceDocument.variables).find(id => traceDocument.variables[id]?.name === 'ans');
      await player.render(39, { animatePositions: false, animateEvents: false });
      window.ASMTraceStudio.close();
      await new Promise(resolve => setTimeout(resolve, 700));
      const element = document.querySelector(`#asm-trace-root [data-trace-variable="${CSS.escape(variableId)}"]`);
      return {
        id: element?.id || '',
        key: variableId,
        currentFrame: player.getCurrentFrame(),
        studioOpen: document.body.classList.contains('asm-trace-studio-open'),
        binding: window.ASMTraceStudio.getBinding(variableId),
        renderPosition: String(element?.dataset.traceRenderPosition || '').split(',').map(Number),
        transform: element?.getAttribute('transform') || '',
        baseOffset: element?.getAttribute('data-base-offset') || ''
      };
    });
    assert.equal(objectInfo.currentFrame, 39, 'frame 40 is one-based, so the player index must be 39');
    assert.equal(objectInfo.studioOpen, false);
    assert.ok(objectInfo.id, 'ans must be visible on frame 40');

    const object = page.locator(`#${objectInfo.id}`);
    const before = await object.boundingBox();
    const startX = before.x + before.width / 2;
    const startY = before.y + Math.min(before.height / 2, 18);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 40, startY + 20, { steps: 5 });
    const during = await object.boundingBox();
    const selected = await page.evaluate(() => {
      const element = window._canvasInteraction?.selected;
      return element && {
        id: element.id,
        key: element.dataset.traceObjectKey || '',
        transform: element.getAttribute('transform') || '',
        translate: element.getAttribute('data-translate') || ''
      };
    });
    const dragDelta = parsePair(selected.translate);
    await page.mouse.up();
    await page.waitForFunction(id => document.getElementById(id)?.getAttribute('data-translate') === '0,0', objectInfo.id);
    const after = await page.evaluate(({ id, key }) => {
      const element = document.getElementById(id);
      return {
        studioOpen: document.body.classList.contains('asm-trace-studio-open'),
        binding: window.ASMTraceStudio.getBinding(key),
        renderPosition: String(element?.dataset.traceRenderPosition || '').split(',').map(Number)
      };
    }, { id: objectInfo.id, key: objectInfo.key });

    assert.ok(Math.abs((during.x - before.x) - 40) < 5,
      `ans jumped horizontally in display mode: ${JSON.stringify({ objectInfo, before, during, selected })}`);
    assert.ok(Math.abs((during.y - before.y) - 20) < 5,
      `ans jumped vertically in display mode: ${JSON.stringify({ objectInfo, before, during, selected })}`);
    assert.equal(after.studioOpen, false, 'dragging must not reopen the animation editor');
    assert.equal(after.binding.sourceAnchor, 'top-left');
    assert.ok(Math.abs(after.binding.dx - (objectInfo.binding.dx + dragDelta[0])) < 0.01);
    assert.ok(Math.abs(after.binding.dy - (objectInfo.binding.dy + dragDelta[1])) < 0.01);
    assert.ok(Math.abs(after.renderPosition[0] - (objectInfo.renderPosition[0] + dragDelta[0])) < 0.01,
      `ans resolved to the wrong horizontal position after display-mode release: ${JSON.stringify({ objectInfo, dragDelta, after })}`);
    assert.ok(Math.abs(after.renderPosition[1] - (objectInfo.renderPosition[1] + dragDelta[1])) < 0.01,
      `ans resolved to the wrong vertical position after display-mode release: ${JSON.stringify({ objectInfo, dragDelta, after })}`);
  } finally {
    await browser.close();
  }
});
