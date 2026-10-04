const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('empty text is removed only after deselection, including old objects and save/reopen',
  { timeout: 60000 }, async () => {
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
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', widgets: [], canvas: { objects: [
        { type: 'textbox', text: '', left: 180, top: 180, width: 300, fontSize: 40 },
        { type: 'textbox', text: '保留文字', left: 180, top: 350, width: 300, fontSize: 32,
          fill: '#123456', scaleX: 1.2, scaleY: 0.8, asmInlineScripts: false }
      ] } }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
        sessionStorage.setItem('fixture', '1');
      }, deck);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      // Legacy blank text remains on load, then is removed when the user leaves it.
      await page.evaluate(() => fixtureCanvas.setActiveObject(fixtureCanvas.getObjects()[0]));
      await page.waitForTimeout(30);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects().length), 2);
      await page.evaluate(() => fixtureCanvas.setActiveObject(fixtureCanvas.getObjects()[1]));
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 1);
      // New blank text stays while selected, including during an internal serialization.
      await page.evaluate(() => {
        const blank = new fabric.Textbox('', {left:100, top:100, width:200});
        fixtureCanvas.add(blank); fixtureCanvas.setActiveObject(blank); blank.enterEditing();
      });
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects().length), 2);
      await page.keyboard.type('   ');
      await page.evaluate(() => fixtureCanvas.getActiveObject().exitEditing());
      await page.waitForTimeout(30);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects().length), 2, 'exiting editing alone does not delete selected text');
      await page.evaluate(() => fixtureCanvas.discardActiveObject());
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 1);
      // Deleting all text through the real editor also removes it on deselection.
      await page.evaluate(() => {
        const o = new fabric.Textbox('刪掉我', {left:100, top:100, width:200});
        fixtureCanvas.add(o); fixtureCanvas.setActiveObject(o); o.enterEditing();
        o.selectAll(); o._updateTextarea(); o.hiddenTextarea.focus();
      });
      await page.keyboard.press('Backspace');
      const host = await page.locator('.fabric-host').boundingBox();
      await page.mouse.click(host.x + host.width * .9, host.y + host.height * .9);
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 1);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.keyboard.press('Control+z');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 2);
      await page.keyboard.press('Control+y');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 1);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload();
      await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 1 && Reveal.isReady());
      const kept = await page.evaluate(() => {
        const o = fixtureCanvas.getObjects()[0];
        return {text:o.text, fill:o.fill, scaleX:o.scaleX, scaleY:o.scaleY, inline:o.asmInlineScripts};
      });
      assert.deepEqual(kept, {text:'保留文字', fill:'#123456', scaleX:1.2, scaleY:0.8, inline:false});
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
