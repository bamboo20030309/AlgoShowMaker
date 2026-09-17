const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { chromium } = require('playwright');

test('Fabric text undo preserves editing, selections, styles and saved history', { timeout: 90000 }, async () => {
  let server, browser;
  let base = process.env.ASM_TEST_BASE_URL;
  try {
    if (!base) {
      const port = await new Promise((resolve, reject) => {
        const probe = require('node:net').createServer();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
          const value = probe.address().port;
          probe.close(() => resolve(value));
        });
      });
      server = spawn(process.execPath, ['server.js'], {
        cwd: require('node:path').resolve(__dirname, '..'),
        env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
      });
      base = await new Promise((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => reject(new Error('Server did not start: ' + output)), 15000);
        server.stdout.on('data', data => {
          output += data;
          const match = output.match(/localhost:(\d+)/);
          if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
        });
        server.stderr.on('data', data => { output += data; });
        server.on('error', error => { clearTimeout(timer); reject(error); });
      });
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('console', message => console.log('Browser:', message.text()));
    page.on('pageerror', error => errors.push(error.stack || error.message));
    // This fixture has no math. Keep its browser independent of the optional CDN.
    await page.route('https://cdn.jsdelivr.net/npm/katex@latest/dist/**', route => route.fulfill({
      contentType: route.request().url().endsWith('.css') ? 'text/css' : 'application/javascript',
      body: route.request().url().endsWith('.css') ? '' : 'window.renderMathInElement = function() {};'
    }));
    await page.goto(base + '/slides.html');
    await page.waitForFunction(() => document.body.dataset.slideCount);
    if (process.env.ASM_TEXT_UNDO_BASELINE) {
      await page.route('**/slides.js?*', route => route.fulfill({ path: process.env.ASM_TEXT_UNDO_BASELINE, contentType: 'application/javascript' }));
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.slideCount);
    }
    await page.evaluate(() => {
      const original = fabric.Canvas.prototype.loadFromJSON;
      fabric.Canvas.prototype.loadFromJSON = function(...args) { window.testCanvas = this; return original.apply(this, args); };
    });
    const payload = { format: 'AlgoShowMaker.slides', version: 'AV_V4.3', deck: {
      groups: [{ id: 'text-group', slides: [{ id: 'text-slide', canvas: { version: '5.3.0', objects: [
        { type: 'textbox', left: 150, top: 200, width: 650, text: 'Alpha beta', fontSize: 48, fontFamily: 'Arial',
          fill: '#111111', styles: { 0: { 6: { fill: '#ff0000', fontWeight: 'bold' }, 7: { fill: '#ff0000', fontWeight: 'bold' } } } }
      ] }, widgets: [], ttsScript: '', ttsOrder: [] }] }], ttsSettings: { rate: 1, volume: .3 }
    } };
    await page.locator('#importDeckInput').setInputFiles({ name: 'text.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
    await page.waitForFunction(() => window.testCanvas?.getObjects()[0]?.text === 'Alpha beta');
    async function beginEditing() {
      const position = await page.evaluate(() => {
        const c = testCanvas, o = c.getObjects()[0], r = c.upperCanvasEl.getBoundingClientRect();
        const point = fabric.util.transformPoint(new fabric.Point(o.left + 30, o.top + 25), c.viewportTransform);
        return { x: r.left + point.x * r.width / c.width, y: r.top + point.y * r.height / c.height };
      });
      await page.mouse.dblclick(position.x, position.y);
      await page.waitForFunction(() => testCanvas.getActiveObject()?.isEditing);
      await page.evaluate(() => { window.originalTextObject = testCanvas.getActiveObject(); window.originalTextarea = originalTextObject.hiddenTextarea; });
    }
    async function select(start, end) {
      await page.evaluate(({ start, end }) => {
        const object = testCanvas.getActiveObject();
        object.selectionStart = start; object.selectionEnd = end; object._updateTextarea();
        object.hiddenTextarea.focus();
      }, { start, end });
    }
    async function state(text, start, end = start) {
      await page.waitForFunction(text => testCanvas.getActiveObject()?.text === text, text, { timeout: 3000 });
      const actual = await page.evaluate(() => {
        const o = testCanvas.getActiveObject();
        return { text: o.text, start: o.selectionStart, end: o.selectionEnd, editing: o.isEditing,
          sameObject: o === originalTextObject, sameTextarea: o.hiddenTextarea === originalTextarea,
          focused: document.activeElement === o.hiddenTextarea, textarea: o.hiddenTextarea.value, styles: o.styles };
      });
      assert.equal(actual.text, text); assert.equal(actual.textarea, text);
      assert.equal(actual.start, start); assert.equal(actual.end, end);
      assert.equal(actual.editing, true); assert.equal(actual.sameObject, true);
      assert.equal(actual.sameTextarea, true); assert.equal(actual.focused, true);
      return actual;
    }
    await beginEditing();
    await select(6, 10);
    const originalStyles = await page.evaluate(() => JSON.parse(JSON.stringify(testCanvas.getActiveObject().styles)));
    await page.keyboard.insertText('gamma');
    await state('Alpha gamma', 11);
    const changedStyles = await page.evaluate(() => JSON.parse(JSON.stringify(testCanvas.getActiveObject().styles)));
    const replacementHistory = Number(await page.locator('body').getAttribute('data-history-index'));
    await page.keyboard.press('Control+z');
    assert.equal(Number(await page.locator('body').getAttribute('data-history-index')), replacementHistory - 1);
    assert.deepEqual((await state('Alpha beta', 6, 10)).styles, originalStyles);
    await page.keyboard.press('Control+Shift+z');
    assert.deepEqual((await state('Alpha gamma', 11)).styles, changedStyles);
    await page.keyboard.press('Backspace');
    await state('Alpha gamm', 10);
    await page.keyboard.press('Control+z');
    await state('Alpha gamma', 11);
    await page.keyboard.press('Control+z');
    await state('Alpha beta', 6, 10);
    await page.keyboard.press('Control+y');
    await state('Alpha gamma', 11);
    await page.keyboard.press('Control+y');
    await state('Alpha gamm', 10);
    await page.keyboard.press('Control+z');
    await page.keyboard.insertText('!');
    await state('Alpha gamma!', 12);
    await page.keyboard.press('Control+y');
    await state('Alpha gamma!', 12); // Typing after undo discards the redo branch.
    await select(12, 12);
    await page.keyboard.insertText('😀');
    await state('Alpha gamma!😀', 13); // Fabric selections use graphemes, not UTF-16 offsets.
    await page.keyboard.press('Control+z');
    await state('Alpha gamma!', 12);
    await page.keyboard.press('Control+Shift+z');
    await state('Alpha gamma!😀', 13);

    // Browser-level IME event contract. This deliberately does not claim an OS IME test.
    const beforeComposition = Number(await page.locator('body').getAttribute('data-history-index'));
    await page.evaluate(() => {
      const t = originalTextarea;
      window.compositionEvents = [];
      for (const name of ['compositionstart', 'beforeinput', 'input', 'compositionend']) t.addEventListener(name, e => compositionEvents.push(e.type));
      t.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      window.composingUndo = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, isComposing: true, bubbles: true, cancelable: true });
      t.dispatchEvent(composingUndo);
      for (const text of ['中', '中文']) {
        t.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertCompositionText', data: text, isComposing: true }));
        t.value = 'Alpha gamma!😀' + text;
        t.setSelectionRange(t.value.length, t.value.length);
        t.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: text, isComposing: true }));
      }
    });
    assert.equal(await page.evaluate(() => composingUndo.defaultPrevented), false);
    assert.equal(Number(await page.locator('body').getAttribute('data-history-index')), beforeComposition);
    await page.evaluate(() => originalTextarea.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' })));
    await state('Alpha gamma!😀中文', 15);
    assert.equal(Number(await page.locator('body').getAttribute('data-history-index')), beforeComposition + 1);
    assert.deepEqual(await page.evaluate(() => compositionEvents), ['compositionstart', 'beforeinput', 'input', 'beforeinput', 'input', 'compositionend']);
    await page.keyboard.press('Control+z');
    await state('Alpha gamma!😀', 13);
    await page.keyboard.press('Control+Shift+z');
    await state('Alpha gamma!😀中文', 15);

    await select(6, 11);
    await page.evaluate(() => {
      const t = originalTextarea;
      t.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      t.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertCompositionText', data: '測試', isComposing: true }));
      t.value = 'Alpha 測試!😀中文';
      t.setSelectionRange(8, 8);
      t.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: '測試', isComposing: true }));
      t.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '測試' }));
      // A trailing final input carrying identical committed text adds no duplicate history.
      t.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '測試' }));
    });
    await state('Alpha 測試!😀中文', 8);
    await page.keyboard.press('Control+z');
    await state('Alpha gamma!😀中文', 6, 11);

    // Unrelated DOM controls retain native undo and never change deck history.
    await page.evaluate(() => {
      const t = document.createElement('textarea'); t.id = 'nativeUndoControl'; document.body.appendChild(t); t.focus();
    });
    const nativeHistory = await page.locator('body').getAttribute('data-history-index');
    await page.keyboard.type('native typing');
    await page.keyboard.press('Control+z');
    assert.equal(await page.locator('#nativeUndoControl').inputValue(), '');
    assert.equal(await page.locator('body').getAttribute('data-history-index'), nativeHistory);
    await page.evaluate(() => document.querySelector('#nativeUndoControl').remove());
    await page.evaluate(() => {
      for (const [tag, className] of [['input', ''], ['textarea', 'ace_text-input']]) {
        const control = document.createElement(tag);
        control.className = className;
        document.body.appendChild(control);
        control.focus();
        const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
        control.dispatchEvent(event);
        if (event.defaultPrevented) throw new Error(`${tag} ${className} native undo was intercepted`);
        control.remove();
      }
    });

    // Ordinary deck undo rebuilds objects; subsequent text edits must save the current slide.
    await page.evaluate(() => { testCanvas.getActiveObject().exitEditing(); document.activeElement.blur(); });
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => testCanvas.getObjects()[0]?.text === 'Alpha gamma!😀');
    await beginEditing();
    await select(13, 13);
    await page.keyboard.insertText(' persisted');
    await state('Alpha gamma!😀 persisted', 23);
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricObjectCount === '1');
    await page.evaluate(() => {
      const original = fabric.Canvas.prototype.loadFromJSON;
      fabric.Canvas.prototype.loadFromJSON = function(...args) { window.testCanvas = this; return original.apply(this, args); };
    });
    // Export the persisted deck through the real download control after reload.
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportDeckBtn').click()]);
    const bytes = [...require('node:fs').readFileSync(await download.path())];
    const exported = await page.evaluate(bytes => ASMDeck.decode(new Blob([new Uint8Array(bytes)])), bytes);
    assert.equal(exported.deck.groups[0].slides[0].canvas.objects[0].text, 'Alpha gamma!😀 persisted');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server?.kill();
  }
});
