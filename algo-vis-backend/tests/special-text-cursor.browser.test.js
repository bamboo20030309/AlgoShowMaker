const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('special text uses visual graphemes for cursor placement and preserved styles', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
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
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    await page.evaluate(() => {
      const original = fabric.Canvas.prototype.loadFromJSON;
      fabric.Canvas.prototype.loadFromJSON = function (...args) {
        window.specialTextCanvas = this;
        return original.apply(this, args);
      };
    });

    const text = 'A②B 👨‍👩‍👧‍👦 e\u0301 A_2';
    const payload = { deck: { groups: [{ id: 'g', slides: [{ id: 's', canvas: { version: '5.3.0', objects: [{
      type: 'textbox', left: 180, top: 180, width: 900, text, fontFamily: 'Arial', fontSize: 72,
      fill: '#111111', styles: { 0: { 15: { fill: '#d40000' } } },
      asmInlineScripts: true,
      asmInlineScriptBaseStyles: { 0: { 15: { fill: '#d40000' } } }
    }] }, widgets: [] }] }] } };
    await page.locator('#importDeckInput').setInputFiles({
      name: 'special-text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload))
    });
    await page.waitForFunction(() => window.specialTextCanvas?.getObjects()[0]?.text?.includes('②'));

    const initial = await page.evaluate(() => {
      const object = specialTextCanvas.getObjects()[0];
      const renderedStyles = JSON.parse(JSON.stringify(object.styles));
      specialTextCanvas.setActiveObject(object);
      object.enterEditing();
      object.hiddenTextarea.focus();
      object.cursorOffsetCache = {};
      const beforeCircled = object._getCursorBoundariesOffsets(1).left;
      object.cursorOffsetCache = {};
      const afterCircled = object._getCursorBoundariesOffsets(2).left;
      return {
        graphemes: object._text.slice(),
        beforeCircled,
        afterCircled,
        circledBounds: { ...object.__charBounds[0][1] },
        renderedStyles,
        baseStyles: object.asmInlineScriptBaseStyles,
        version: object.asmGraphemeVersion
      };
    });
    assert.deepEqual(initial.graphemes, ['A', '②', 'B', ' ', '👨‍👩‍👧‍👦', ' ', 'é', ' ', 'A', '_', '2']);
    assert.equal(initial.beforeCircled, initial.circledBounds.left);
    assert.equal(initial.afterCircled, initial.circledBounds.left + initial.circledBounds.width);
    assert.equal(initial.baseStyles[0][8].fill, '#d40000');
    assert.equal(initial.renderedStyles[0][8].fill, '#d40000');
    assert.ok(initial.renderedStyles[0][10].deltaY > 0);
    assert.equal(initial.version, 2);

    async function clickCircled(fraction) {
      const point = await page.evaluate(fraction => {
        const canvas = specialTextCanvas;
        const object = canvas.getObjects()[0];
        const bounds = object.__charBounds[0][1];
        const canvasPoint = fabric.util.transformPoint(new fabric.Point(
          object.left + bounds.left + bounds.width * fraction,
          object.top + object.getHeightOfLine(0) / 2
        ), canvas.viewportTransform);
        const rect = canvas.upperCanvasEl.getBoundingClientRect();
        return {
          x: rect.left + canvasPoint.x * rect.width / canvas.width,
          y: rect.top + canvasPoint.y * rect.height / canvas.height
        };
      }, fraction);
      await page.mouse.click(point.x, point.y);
      return page.evaluate(() => specialTextCanvas.getObjects()[0].selectionStart);
    }
    assert.equal(await clickCircled(0.25), 1);
    assert.equal(await clickCircled(0.75), 2);

    await page.keyboard.press('End');
    assert.equal(await page.evaluate(() => specialTextCanvas.getObjects()[0].selectionStart), 11);
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.evaluate(() => specialTextCanvas.getObjects()[0].selectionStart), 10);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
