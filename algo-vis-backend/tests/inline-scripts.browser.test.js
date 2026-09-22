const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('ordinary text keeps editable script source and reloads rendered script styles', { timeout: 90000 }, async () => {
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
    const page = await browser.newPage({ acceptDownloads: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.slideCount);
    await page.evaluate(() => {
      const original = fabric.Canvas.prototype.loadFromJSON;
      fabric.Canvas.prototype.loadFromJSON = function (...args) {
        window.scriptTestCanvas = this;
        return original.apply(this, args);
      };
    });
    const deck = { groups: [{ id: 'group', slides: [{ id: 'slide', canvas: { version: '5.3.0', objects: [
      { type: 'textbox', left: 100, top: 100, width: 600, text: 'A_2 x^{n+1}', fontSize: 40,
        fill: '#111111', styles: {}, asmInlineScripts: true, asmInlineScriptBaseStyles: {} },
      { type: 'textbox', left: 100, top: 220, width: 600, text: 'legacy_2', fontSize: 40,
        fill: '#111111', styles: { 0: { 0: { fill: '#ff0000', fontWeight: 'bold' } } } }
    ] }, widgets: [] }] }] };
    await page.locator('#importDeckInput').setInputFiles({ name: 'scripts.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ deck })) });
    await page.waitForFunction(() => window.scriptTestCanvas?.getObjects()[0]?.text === 'A_2 x^{n+1}');
    const initial = await page.evaluate(() => scriptTestCanvas.getObjects().map(object => ({
      enabled: !!object.asmInlineScripts, text: object.text, styles: object.styles
    })));
    assert.equal(initial[0].styles[0][2].deltaY, 4.4);
    assert.equal(initial[0].styles[0][7].deltaY, -14);
    assert.equal(initial[1].enabled, false);
    assert.equal(initial[1].styles[0][0].fill, '#ff0000');
    assert.equal(initial[1].styles[0][7], undefined);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/inline-scripts.png') });

    await page.evaluate(() => {
      const object = scriptTestCanvas.getObjects()[0];
      scriptTestCanvas.setActiveObject(object);
      object.enterEditing();
      object.hiddenTextarea.focus();
    });
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[0].styles[0]?.[2]?.deltaY), undefined);
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[0].hiddenTextarea.value), 'A_2 x^{n+1}');
    await page.keyboard.press('End');
    await page.keyboard.insertText(' A^3');
    await page.waitForFunction(() => scriptTestCanvas.getObjects()[0].text === 'A_2 x^{n+1} A^3');
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => scriptTestCanvas.getObjects()[0].text === 'A_2 x^{n+1}');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => scriptTestCanvas.getObjects()[0].text === 'A_2 x^{n+1} A^3');
    await page.evaluate(() => scriptTestCanvas.getObjects()[0].exitEditing());
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[0].styles[0][2].deltaY), 4.4);
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[0].styles[0][14].deltaY), -14);

    await page.evaluate(() => scriptTestCanvas.setActiveObject(scriptTestCanvas.getObjects()[1]));
    await page.locator('#inlineScriptsBtn').evaluate(button => button.click());
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[1].asmInlineScripts), true);
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[1].styles[0][7].deltaY), 4.4);
    await page.locator('#inlineScriptsBtn').evaluate(button => button.click());
    assert.equal(await page.evaluate(() => scriptTestCanvas.getObjects()[1].asmInlineScripts), false);
    assert.deepEqual(await page.evaluate(() => scriptTestCanvas.getObjects()[1].styles), {
      0: { 0: { fill: '#ff0000', fontWeight: 'bold' } }
    });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#exportDeckBtn').click()
    ]);
    const chunks = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk);
    const exported = Buffer.concat(chunks);
    global.ASMTraceProvenance = require('../public/trace-provenance');
    const exportedDeck = await require('../public/asmdeck').decode(new Blob([exported]));
    const exportedText = exportedDeck.deck.groups[0].slides[0].canvas.objects[0];
    assert.equal(exportedText.text, 'A_2 x^{n+1} A^3');
    assert.equal(exportedText.asmInlineScripts, true);
    assert.equal(exportedText.styles[0][2].deltaY, 4.4);
    const thumbnail = await page.evaluate(async deckData => AlgoDeckThumbnail.create(deckData), exportedDeck.deck);
    assert.match(thumbnail, /^data:image\/jpeg;base64,/);
    fs.writeFileSync(path.join(root, 'test-results/inline-scripts-thumbnail.jpg'), Buffer.from(thumbnail.split(',')[1], 'base64'));
    await page.locator('#importDeckInput').setInputFiles({
      name: 'scripts.asmdeck', mimeType: 'application/octet-stream', buffer: exported
    });
    await page.waitForFunction(() => window.scriptTestCanvas?.getObjects()[0]?.text === 'A_2 x^{n+1} A^3');
    const reloaded = await page.evaluate(() => {
      const object = scriptTestCanvas.getObjects()[0];
      return { asmInlineScripts: object.asmInlineScripts, styles: object.styles };
    });
    assert.equal(reloaded.asmInlineScripts, true);
    assert.equal(reloaded.styles[0][2].deltaY, 4.4);
    assert.equal(reloaded.styles[0][14].deltaY, -14);
    const freshPage = await browser.newPage();
    await freshPage.goto(`${base}/slides.html`);
    await freshPage.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    await freshPage.evaluate(() => {
      const originalAdd = fabric.Canvas.prototype.add;
      fabric.Canvas.prototype.add = function (...objects) {
        window.createdTextObject = objects.find(object => object.type === 'textbox');
        return originalAdd.apply(this, objects);
      };
    });
    await freshPage.locator('.tool-text').click();
    assert.equal(await freshPage.evaluate(() => createdTextObject?.asmInlineScripts), true);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
