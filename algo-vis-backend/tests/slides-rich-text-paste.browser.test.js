const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startStaticUiServer } = require('./helpers/static-ui-server');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('rich text fragments preserve base and per-character styles in new and existing text objects',
  { timeout: 60000 }, async t => {
    const root = path.resolve(__dirname, '..');
    const { base } = await startStaticUiServer(t);
    let browser;
    try {
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
        type: 'textbox', text: 'A🙂B\nC', left: 180, top: 180, width: 500, fontSize: 32,
        fontFamily: 'Georgia', fontWeight: 'bold', fill: '#ff0000', asmInlineScripts: false,
        styles: { 0: { 2: { fill: '#0000ff', underline: true } }, 1: { 0: { fontStyle: 'italic' } } }
      }, { type: 'textbox', text: 'X', left: 750, top: 180, width: 300,
        fontSize: 18, fill: '#000000', asmInlineScripts: false }] } }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      const ready = () => page.waitForFunction(() => fixtureCanvas?.getObjects().length >= 2 && Reveal.isReady());
      await page.goto(base + '/slides.html'); await ready();
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[0]; fixtureCanvas.setActiveObject(object); object.enterEditing();
        object.selectionStart = 0; object.selectionEnd = object._text.length; object._updateTextarea(); object.hiddenTextarea.focus();
      });
      await page.keyboard.press('Control+c');
      await page.evaluate(() => {
        fixtureCanvas.getActiveObject().exitEditing(); fixtureCanvas.discardActiveObject();
        document.body.tabIndex = -1; document.body.focus();
      });
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 3);
      const inspect = index => page.evaluate(index => {
        const object = fixtureCanvas.getObjects()[index];
        return { text: object.text, inline: object.asmInlineScripts,
          styles: object.getSelectionStyles(0, object._text.length, true) };
      }, index);
      const source = await inspect(0); const pasted = await inspect(2);
      assert.equal(pasted.text, source.text); assert.equal(pasted.inline, false);
      for (const index of [0,1,2,4]) for (const field of ['fill','fontFamily','fontSize','fontWeight','fontStyle','underline'])
        assert.equal(pasted.styles[index][field], source.styles[index][field], `new object ${index} ${field}`);
      await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[1]; fixtureCanvas.setActiveObject(object); object.enterEditing();
        object.selectionStart = object.selectionEnd = 1; object._updateTextarea(); object.hiddenTextarea.focus();
      });
      await page.keyboard.press('Control+v');
      assert.equal((await inspect(1)).text, 'XA🙂B\nC');
      const appended = await inspect(1);
      for (const index of [0,1,2,4]) for (const field of ['fill','fontFamily','fontSize','fontWeight','fontStyle','underline'])
        assert.equal(appended.styles[index + 1][field], source.styles[index][field], `existing object ${index} ${field}`);
      const cursor = await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[1];
        return { text: object.hiddenTextarea.value, start: object.selectionStart,
          end: object.selectionEnd, length: object._text.length,
          nativeStart: object.hiddenTextarea.selectionStart, nativeEnd: object.hiddenTextarea.selectionEnd };
      });
      assert.equal(cursor.text, appended.text, 'native input must contain the pasted text before further typing');
      assert.equal(cursor.start, cursor.length);
      assert.equal(cursor.end, cursor.length);
      assert.equal(cursor.nativeStart, appended.text.length);
      assert.equal(cursor.nativeEnd, appended.text.length);
      await page.keyboard.type('!');
      assert.equal((await inspect(1)).text, appended.text + '!', 'typing after paste appends instead of replacing the fragment');
      await page.evaluate(() => fixtureCanvas.getActiveObject().exitEditing());
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload(); await ready();
      assert.equal((await inspect(1)).styles[3].fill, '#0000ff');
      assert.equal((await inspect(2)).styles[2].underline, true);
      assert.equal((await inspect(0)).inline, false);
      // The default inline-formatting path must also collapse a replaced range,
      // including the different UTF-16/grapheme offsets around an emoji.
      await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[1];
        object.set({ asmInlineScripts: true });
        fixtureCanvas.setActiveObject(object); object.enterEditing();
        object.selectionStart = 1; object.selectionEnd = 3;
        object._updateTextarea(); object.hiddenTextarea.focus();
      });
      await page.keyboard.press('Control+v');
      assert.equal((await inspect(1)).text, 'XA🙂B\nCB\nC!');
      const replaced = await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[1];
        return { value: object.hiddenTextarea.value, start: object.selectionStart, end: object.selectionEnd,
          nativeStart: object.hiddenTextarea.selectionStart, nativeEnd: object.hiddenTextarea.selectionEnd };
      });
      assert.deepEqual(replaced, { value: 'XA🙂B\nCB\nC!', start: 6, end: 6, nativeStart: 7, nativeEnd: 7 });
      await page.keyboard.type('Z');
      assert.equal((await inspect(1)).text, 'XA🙂B\nCZB\nC!', 'typing continues at the end of the replacement');
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); }
  });
