const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('deletion keeps the visible cursor aligned; plain clipboard text creates one editable text object',
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
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', widgets: [], canvas: { objects: [{
        type: 'textbox', text: '甲 1^nX', left: 180, top: 180, width: 500, fontSize: 40,
        fontFamily: 'Arial', asmInlineScripts: true, asmTextWidthMode: 'auto'
      }] } }] }] };
      await page.addInitScript(deck => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck));
        sessionStorage.setItem('fixture', '1');
      }, deck);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length && Reveal.isReady());
      await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[0]; fixtureCanvas.setActiveObject(object);
        object.enterEditing(); object.selectionStart = object.selectionEnd = object._text.length;
        object._updateTextarea(); object.hiddenTextarea.focus(); object.renderCursorOrSelection();
      });
      await page.keyboard.press('Backspace');
      const cursor = await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[0];
        const cached = { ...object._getCursorBoundariesOffsets(object.selectionStart) };
        object.cursorOffsetCache = {};
        const fresh = { ...object._getCursorBoundariesOffsets(object.selectionStart) };
        return { cached, fresh, text: object.text, position: object.selectionStart };
      });
      assert.equal(cursor.text, '甲 1^n');
      assert.deepEqual(cursor.cached, cursor.fresh, 'cursor must use dimensions after inline formatting and automatic resize');
      const pasted = '第一行 1^n\n第二行 👨‍👩‍👧‍👦 é';
      await page.evaluate(() => { fixtureCanvas.getActiveObject().exitEditing(); fixtureCanvas.discardActiveObject(); });
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      await page.evaluate(text => navigator.clipboard.writeText(text), pasted);
      await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
      await page.keyboard.press('Control+v');
      await page.waitForFunction(text => fixtureCanvas.getObjects().some(object => object.text === text), pasted);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects().length), 2);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload();
      await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[1].text), pasted);
      // Object copy still duplicates an object; external clipboard text must
      // take priority over that older private object clipboard.
      await page.evaluate(() => {
        fixtureCanvas.setActiveObject(fixtureCanvas.getObjects()[0]);
        document.body.tabIndex = -1; document.body.focus();
      });
      await page.keyboard.press('Control+c');
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 3);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[2].text), '甲 1^n');
      await page.evaluate(() => navigator.clipboard.writeText('外來文本'));
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 4);
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[3].text), '外來文本');
      await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[3]; fixtureCanvas.setActiveObject(object); object.enterEditing();
        object.selectionStart = object.selectionEnd = object._text.length;
        object._updateTextarea(); object.hiddenTextarea.focus();
      });
      await page.evaluate(() => navigator.clipboard.writeText('追加'));
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => fixtureCanvas.getObjects()[3].text === '外來文本追加');
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects().length), 4);
      for (const value of ['甲乙丙丁\nA m_1 é', 'ABC 1^nX\n換行文字', 'A👨‍👩‍👧‍👦B é m_1X']) {
        await page.evaluate(value => {
          const object = fixtureCanvas.getObjects()[3];
          object.set({ text: value, width: 120, asmTextWidthMode: 'fixed', asmInlineScripts: true, styles: {}, asmInlineScriptBaseStyles: {} });
          object.initDimensions();
          object.selectionStart = object.selectionEnd = object._text.length;
          object._updateTextarea(); object.hiddenTextarea.value = value; object.hiddenTextarea.focus();
        }, value);
        for (let step = 0; step < 3; step++) {
          await page.keyboard.press('Backspace');
          const actual = await page.evaluate(() => {
            const object = fixtureCanvas.getObjects()[3];
            const cached = { ...object._getCursorBoundariesOffsets(object.selectionStart) };
            object.cursorOffsetCache = {};
            const fresh = { ...object._getCursorBoundariesOffsets(object.selectionStart) };
            const selection = object.fromStringToGraphemeSelection(object.hiddenTextarea.selectionStart, object.hiddenTextarea.selectionEnd, object.hiddenTextarea.value);
            return { cached, fresh, position: object.selectionStart, native: selection.selectionStart };
          });
          assert.deepEqual(actual.cached, actual.fresh);
          assert.equal(actual.position, actual.native);
        }
      }
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
