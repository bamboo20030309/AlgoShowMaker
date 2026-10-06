const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('text shrinking retains right-side room without adding a wrapped line', { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await new Promise(resolve => {
      const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
        const port = server.address().port; server.close(() => resolve(port));
      });
    });
    const server = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore',
      env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1' } });
    let browser;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      browser = await chromium.launch({ headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 },
        permissions: ['clipboard-read', 'clipboard-write'] });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript',
        body: `const fixtureLoad = fabric.Canvas.prototype.loadFromJSON;
          fabric.Canvas.prototype.loadFromJSON = function(...args) {
            window.fixtureCanvas = this; return fixtureLoad.apply(this, args);
          };\n` + fs.readFileSync(path.join(root, 'public/slides.js'), 'utf8') }));
      const plainOnly = false, tableVariant = false;
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [
        { type: 'textbox', text: 'Styled A', left: 100, top: 80, width: 250, fontSize: 32, fill: '#123456',
          fontFamily: 'Georgia', scaleX: 1.2, scaleY: 0.8, asmInlineScripts: false, layerIndex: 4000, styles: { 0: { 0: { underline: true } } } },
        { type: 'textbox', text: 'Styled B', left: 100, top: 170, width: 250, fontSize: 28,
          fill: '#654321', fontStyle: 'italic', asmInlineScripts: false, layerIndex: 2500 }
      ] }, widgets: [
        { id: 'array', type: tableVariant ? 'table' : 'structure', structureMode: 'normal', content: '1,2,3', x: 500, y: 100,
          w: 250, h: 140, structureFrameVersion: 4, frameBackgroundEnabled: false,
          tableBodyFill: '#aa22cc', highlightIndices: '1', cellStyles: { 1: { highlight: '#aa22cc' } }, layerIndex: 2000 },
        { id: 'code', type: tableVariant ? 'latex' : 'code', content: tableVariant ? String.raw`\(x^2\)` : 'int n = 42;', language: 'cpp', x: 850, y: 350,
          w: 300, h: 200, manualSize: tableVariant, fontSize: 23, showLineNumbers: false, layerIndex: 3000 }
      ] }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      const ready = () => page.waitForFunction(() => fixtureCanvas?.getObjects().length >= 2 && Reveal.isReady());
      const saved = () => page.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage)
        .loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0]);
      await page.goto(base + '/slides.html'); await ready();
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      const host = await page.locator('.fabric-host').boundingBox();
      const click = (x,y) => page.mouse.click(host.x + x * host.width / 1280, host.y + y * host.height / 720);
      await page.evaluate(() => {
        const old = fixtureCanvas.getObjects()[0];
        old.set({text: '最後一個字不能換行 ABC', scaleX: 1, scaleY: 1, width: 600, asmTextWidthMode: 'fixed'});
        old.initDimensions(); old.setCoords(); fixtureCanvas.setActiveObject(old); fixtureCanvas.renderAll();
      });
      const state = () => page.evaluate(() => {
        const o = fixtureCanvas.getObjects()[0];
        return { left:o.left, top:o.top, width:o.width, height:o.height, lines:o.textLines.length,
          lineWidth: Math.max(...o._textLines.map((_,i) => o.getLineWidth(i))) };
      });
      const initial = await state();
      assert.equal(initial.lines,1);
      const middleY = initial.top + initial.height/2;
      await page.mouse.move(host.x + (initial.left+initial.width) * host.width/1280, host.y + middleY*host.height/720);
      await page.mouse.down();
      await page.mouse.move(host.x + (initial.left+initial.lineWidth-20) * host.width/1280, host.y + middleY*host.height/720, {steps:8});
      await page.mouse.up();
      const resized = await state();
      assert.ok(resized.width < initial.width, 'the frame still shrinks');
      assert.equal(resized.lines,1, `shrinking does not wrap: ${JSON.stringify({initial,resized})}`);
      assert.ok(resized.width - resized.lineWidth >= 9.9, 'at least ten logical pixels remain on the right');
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload(); await ready();
      const reopened = await state();
      assert.equal(reopened.lines,1);
      assert.ok(reopened.width - reopened.lineWidth >= 9.9);
      await click(1200,650);
      await page.evaluate(() => navigator.clipboard.writeText('新文字最後一字 ABC'));
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 3);
      const added = await page.evaluate(() => {
        const o = fixtureCanvas.getObjects().at(-1);
        return {lines:o.textLines.length, width:o.width, lineWidth:o.getLineWidth(0), mode:o.asmTextWidthMode};
      });
      assert.equal(added.lines,1); assert.equal(added.mode,'auto');
      assert.ok(added.width - added.lineWidth >= 9.9, 'new auto-fit text keeps the same room');
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
