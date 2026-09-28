const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('textboxes shrink to their longest current line until their width is manually resized', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    await page.evaluate(() => {
      const original = fabric.Canvas.prototype.loadFromJSON;
      fabric.Canvas.prototype.loadFromJSON = function (...args) {
        window.testCanvas = this;
        return original.apply(this, args);
      };
    });
    const payload = { format: 'AlgoShowMaker.slides', version: 'AV_V4.3', deck: {
      groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [
        { type: 'textbox', left: 100, top: 120, width: 600, text: 'Auto', fontSize: 30, asmTextWidthMode: 'auto' },
        { type: 'textbox', left: 100, top: 280, width: 600, text: 'Fixed', fontSize: 30, asmTextWidthMode: 'fixed' },
        { type: 'textbox', left: 100, top: 440, width: 600, text: 'Legacy', fontSize: 30 },
        { type: 'textbox', left: 700, top: 440, width: 90, text: 'Legacy width constrained sentence', fontSize: 30 }
      ] }, widgets: [] }] }]
    } };
    await page.locator('#importDeckInput').setInputFiles({
      name: 'text-width.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload))
    });
    await page.waitForFunction(() => window.testCanvas?.getObjects().length === 4);
    assert.deepEqual(await page.evaluate(() => testCanvas.getObjects().map(object => object.asmTextWidthMode)),
      ['auto', 'fixed', 'auto', 'fixed']);

    async function replaceText(index, text) {
      await page.evaluate(index => {
        const object = testCanvas.getObjects()[index];
        testCanvas.setActiveObject(object);
        object.enterEditing();
        object.selectionStart = 0;
        object.selectionEnd = object.text.length;
        object._updateTextarea();
        object.hiddenTextarea.focus();
      }, index);
      await page.keyboard.insertText(text);
      await page.waitForFunction(({ index, text }) => testCanvas.getObjects()[index].text === text, { index, text });
      return page.evaluate(index => {
        const object = testCanvas.getObjects()[index];
        object.exitEditing();
        return { width: object.width, mode: object.asmTextWidthMode, lines: object.textLines.length };
      }, index);
    }

    const longAuto = await replaceText(0, 'This is the longest current line');
    const shortAuto = await replaceText(0, 'tiny\nx');
    assert.equal(longAuto.mode, 'auto');
    assert.ok(longAuto.width > shortAuto.width + 150, `${longAuto.width} should exceed ${shortAuto.width}`);
    assert.ok(shortAuto.width < 100, `auto width should shrink to the current longest line: ${shortAuto.width}`);

    const fixed = await replaceText(1, 'x');
    assert.equal(fixed.mode, 'fixed');
    assert.ok(Math.abs(fixed.width - 600) < 1, `fixed width changed to ${fixed.width}`);

    const legacy = await replaceText(2, 'old');
    assert.equal(legacy.mode, 'auto');
    assert.ok(legacy.width < 100, `legacy unwrapped text should migrate to auto width: ${legacy.width}`);
    const wrappedLegacy = await replaceText(3, 'still constrained');
    assert.equal(wrappedLegacy.mode, 'fixed');
    assert.ok(wrappedLegacy.lines > 1,
      `legacy wrapped text should retain constrained wrapping: ${JSON.stringify(wrappedLegacy)}`);

    const resized = await page.evaluate(() => {
      const object = testCanvas.getObjects()[0];
      object.set({ scaleX: 2, scaleY: 1 });
      testCanvas.fire('object:scaling', { target: object, e: {} });
      return { width: object.width, mode: object.asmTextWidthMode };
    });
    assert.equal(resized.mode, 'fixed');
    const afterManualResize = await replaceText(0, 'z');
    assert.ok(Math.abs(afterManualResize.width - resized.width) < 1,
      `manual width ${resized.width} should remain fixed, got ${afterManualResize.width}`);

    const savedCanvas = await page.evaluate(() => testCanvas.toJSON(['asmTextWidthMode']));
    assert.deepEqual(savedCanvas.objects.map(object => object.asmTextWidthMode),
      ['fixed', 'fixed', 'auto', 'fixed']);
    const savedDeck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: savedCanvas, widgets: [] }] }] };
    await page.locator('#importDeckInput').setInputFiles({
      name: 'text-width-reopen.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ format: 'AlgoShowMaker.slides', version: 'AV_V4.3', deck: savedDeck }))
    });
    await page.waitForFunction(() => window.testCanvas?.getObjects().length === 4);
    assert.deepEqual(await page.evaluate(() => testCanvas.getObjects().map(object => object.asmTextWidthMode)),
      ['fixed', 'fixed', 'auto', 'fixed']);

    await page.locator('[data-tool="text"]').click();
    await page.waitForFunction(() => testCanvas.getObjects().length === 5);
    const created = await page.evaluate(() => {
      const object = testCanvas.getObjects().at(-1);
      return { text: object.text, width: object.width, mode: object.asmTextWidthMode };
    });
    assert.equal(created.mode, 'auto');
    assert.ok(created.width < 150, `new text should start tightly fitted: ${JSON.stringify(created)}`);

    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
