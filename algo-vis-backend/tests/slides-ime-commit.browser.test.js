const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('IME confirmation clears composition pixels immediately while preserving text, caret and saved styles', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{
      id: 's', canvas: { objects: [{ type: 'textbox', text: '中文確認', left: 240, top: 180, width: 400,
        fontSize: 40, lineHeight: 1.8, scaleX: 1.2, scaleY: .9, angle: 8, fill: '#123456', underline: true }] },
      widgets: [{ id: 'code', type: 'code', content: 'return 0;', x: 800, y: 400, w: 300, h: 140 }]
    }] }] }));
    sessionStorage.setItem('seeded', '1');
  });
  await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `
    const load = fabric.Canvas.prototype.loadFromJSON;
    fabric.Canvas.prototype.loadFromJSON = function(...args) {
      window.fixtureCanvas = this; return load.apply(this, args);
    };
  ` + fs.readFileSync(path.join(__dirname, '../public/slides.js'), 'utf8') }));
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 1 && Reveal.isReady());
  await page.waitForTimeout(600);
  const original = await page.evaluate(() => {
    const o = fixtureCanvas.getObjects()[0];
    return { scaleX: o.scaleX, scaleY: o.scaleY, angle: o.angle, underline: o.underline, fill: o.fill };
  });
  async function commit(index, { trailingInput = false, cancel = false } = {}) {
    return page.evaluate(({ index, trailingInput, cancel }) => {
      const o = fixtureCanvas.getObjects()[index];
      fixtureCanvas.setActiveObject(o); o.enterEditing();
      o.compositionColor = '#ff00ff';
      const input = o.hiddenTextarea;
      const count = element => {
        if (!element) return 0;
        const data = element.getContext('2d').getImageData(0, 0, element.width, element.height).data;
        let result = 0;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 180 && data[i + 1] < 100 && data[i + 2] > 180 && data[i + 3] > 20) result++;
        return result;
      };
      input.setSelectionRange(0, 2);
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      input.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true, data: '中文' }));
      o.renderCursorOrSelection();
      const before = count(fixtureCanvas.upperCanvasEl);
      input.setSelectionRange(2, 2);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 229, isComposing: true, bubbles: true }));
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: cancel ? '' : '中文' }));
      const after = count(fixtureCanvas.upperCanvasEl);
      const mirror = count(document.querySelector('.asm-fabric-editing-layer'));
      if (trailingInput) input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '中文' }));
      return { before, after, mirror, composing: o.inCompositionMode, text: o.text,
        start: o.selectionStart, end: o.selectionEnd, focused: document.activeElement === input };
    }, { index, trailingInput, cancel });
  }
  for (const options of [{}, { trailingInput: true }, { cancel: true }]) {
    const result = await commit(0, options);
    assert.ok(result.before > 5, 'fixture must draw a real composition underline');
    assert.equal(result.after, 0, 'compositionend must erase the dashed underline before any next input/frame');
    assert.equal(result.mirror, 0, 'the editor overlay must not keep a copy of composition pixels');
    assert.equal(result.composing, false);
    assert.equal(result.text, '中文確認');
    assert.equal(result.start, 2); assert.equal(result.end, 2);
    assert.equal(result.focused, true);
  }
  await page.keyboard.type('!');
  assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[0].text), '中文!確認');
  await page.evaluate(() => {
    fixtureCanvas.getObjects()[0].exitEditing();
    fixtureCanvas.add(new fabric.Textbox('中文新物件', { left: 500, top: 420, width: 300, fontSize: 32, fill: '#234567' }));
    fixtureCanvas.fire('object:modified', { target: fixtureCanvas.getObjects()[1] });
  });
  const fresh = await commit(1);
  assert.ok(fresh.before > 5); assert.equal(fresh.after, 0); assert.equal(fresh.mirror, 0);
  await page.evaluate(() => fixtureCanvas.getObjects()[1].exitEditing());
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await page.reload();
  await page.waitForFunction(() => window.fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
  assert.deepEqual(await page.evaluate(() => {
    const o = fixtureCanvas.getObjects()[0];
    return { scaleX: o.scaleX, scaleY: o.scaleY, angle: o.angle, underline: o.underline, fill: o.fill };
  }), original);
  const reopened = await commit(0);
  assert.ok(reopened.before > 5); assert.equal(reopened.after, 0); assert.equal(reopened.mirror, 0);
  assert.deepEqual(errors, []);
});
