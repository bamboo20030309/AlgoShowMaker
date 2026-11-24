const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('mixed object clipboard survives another tab, reload and a plain-text bridge; stale tokens warn', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const source = await context.newPage(), target = await context.newPage();
  await source.goto(base);
  const originalClipboard = await source.evaluate(async () => { try { return await Promise.all((await navigator.clipboard.read()).map(async item => ({
    types: await Promise.all(item.types.map(async type => ({ type, bytes: [...new Uint8Array(await (await item.getType(type)).arrayBuffer())] })))
  }))); } catch { return []; } });
  t.after(async () => {
    try {
      await target.bringToFront();
      await target.evaluate(async entries => {
        entries = entries.filter(entry => entry.types.length > 0);
        if (!entries.length) return navigator.clipboard.writeText('');
        await navigator.clipboard.write(entries.map(entry => new ClipboardItem(Object.fromEntries(entry.types.map(({type, bytes}) => [type, new Blob([new Uint8Array(bytes)], {type})])))));
      }, originalClipboard);
    } finally { await browser.close(); }
  });
  const js = await fs.readFile(path.join(__dirname, '../public/slides.js'), 'utf8');
  await context.route('**/slides.js*', route => route.fulfill({ contentType: 'application/javascript', body:
    `const load=fabric.Canvas.prototype.loadFromJSON;fabric.Canvas.prototype.loadFromJSON=function(...args){window.fixtureCanvas=this;return load.apply(this,args)};\n` + js }));
  await context.addInitScript(() => {
    if (sessionStorage.getItem('crossTabFixture')) return;
    sessionStorage.setItem('crossTabFixture', '1');
    localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [
      { type: 'textbox', text: 'Styled text', left: 100, top: 90, width: 220, fontSize: 28, fill: '#123456',
        scaleX: 1.2, scaleY: 0.8, asmInlineScripts: false, layerIndex: 4000, styles: {0: {0: {underline: true}}} },
      { type: 'rect', left: 110, top: 220, width: 180, height: 70, fill: '#abcdef', strokeWidth: 0, layerIndex: 2500 }
    ] }, widgets: [
      { id: 'array', type: 'structure', content: '1,2,3', structureMode: 'normal', x: 500, y: 100, w: 250, h: 140,
        frameBackgroundEnabled: false, structureFrameVersion: 4, cellStyles: {1: {highlight: '#aa22cc'}}, layerIndex: 2000 },
      { id: 'code', type: 'code', content: 'int n = 42;', language: 'cpp', x: 850, y: 350, w: 300, h: 200,
        fontSize: 23, showLineNumbers: false, layerIndex: 3000 }
    ] }] }] }));
  });
  const ready = async page => {
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    if (!await page.locator('body').evaluate(e => e.classList.contains('asm-edit-mode'))) await page.locator('#modeToggleBtn').click();
    await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
  };
  await source.goto(base + '/slides.html'); await ready(source);
  await target.goto(base + '/slides.html'); await ready(target);
  await source.bringToFront(); await source.keyboard.press('Control+a'); await source.keyboard.press('Control+c');
  const plain = await source.evaluate(() => navigator.clipboard.readText());
  const payload = JSON.parse(plain.slice('AlgoShowMaker objects:'.length));
  assert.equal(payload.format, 'AlgoShowMaker.objects');
  assert.equal(payload.fabric.length, 2); assert.equal(payload.widgets.length, 2);
  await source.close(); // No surviving source-tab memory can resolve the copy.
  await target.bringToFront(); await target.keyboard.press('Control+v');
  await target.waitForFunction(() => fixtureCanvas.getObjects().length === 4 && document.querySelectorAll('.slide-widget').length === 4);
  await target.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await target.reload(); await ready(target);
  // Only the plain-text envelope remains, and all tab-local clipboard state is gone.
  await target.evaluate(text => navigator.clipboard.writeText(text), plain);
  await target.keyboard.press('Control+v');
  await target.waitForFunction(() => fixtureCanvas.getObjects().length === 6 && document.querySelectorAll('.slide-widget').length === 6);
  await target.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  await target.reload(); await ready(target);
  const saved = await target.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0]);
  for (let round = 1; round <= 2; round++) {
    for (let i = 0; i < 2; i++) {
      const original = saved.canvas.objects[i], pasted = saved.canvas.objects[round * 2 + i];
      for (const field of ['type','text','left','top','width','height','scaleX','scaleY','fill','strokeWidth','styles','asmInlineScripts'])
        assert.deepEqual(pasted[field], original[field], `round ${round}, object ${i}, ${field}`);
      const widget = saved.widgets[round * 2 + i], old = saved.widgets[i];
      assert.notEqual(widget.id, old.id);
      for (const field of ['type','content','x','y','w','h','fontSize','showLineNumbers','frameBackgroundEnabled','cellStyles'])
        assert.deepEqual(widget[field], old[field], `round ${round}, widget ${i}, ${field}`);
    }
    const [array, code] = saved.widgets.slice(round * 2, round * 2 + 2), [text, rect] = saved.canvas.objects.slice(round * 2, round * 2 + 2);
    assert.ok(array.layerIndex < rect.layerIndex && rect.layerIndex < code.layerIndex && code.layerIndex < text.layerIndex);
  }
  // Custom MIME alone must also work without an in-memory token lookup.
  await target.evaluate(payload => {
    const data = new DataTransfer(); data.setData('application/x-algoshowmaker-objects', JSON.stringify(payload));
    document.body.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
  }, payload);
  await target.waitForFunction(() => fixtureCanvas.getObjects().length === 8 && document.querySelectorAll('.slide-widget').length === 8);
  await target.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  // A still-open old tab can provide a token whose data remains in memory.
  await target.evaluate(token => {
    const data = new DataTransfer(); data.setData('text/plain', `AlgoShowMaker objects:${token}`);
    document.body.dispatchEvent(new ClipboardEvent('paste', {clipboardData: data, bubbles: true, cancelable: true}));
  }, payload.token);
  await target.waitForFunction(() => fixtureCanvas.getObjects().length === 10 && document.querySelectorAll('.slide-widget').length === 10);
  await target.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  for (const bad of ['AlgoShowMaker objects:missing-old-token', 'AlgoShowMaker objects:{bad json',
    'AlgoShowMaker objects:{"format":"AlgoShowMaker.objects","version":1,"fabric":[null],"widgets":[]}']) {
    await target.evaluate(text => navigator.clipboard.writeText(text), bad);
    await target.keyboard.press('Control+v');
    await target.waitForFunction(() => document.querySelector('#cloudSaveStatus')?.dataset.state === 'error');
    assert.match(await target.locator('#cloudSaveStatus').innerText(), /剪貼簿資料已失效或不完整/);
    assert.equal(await target.evaluate(() => fixtureCanvas.getObjects().length), 10);
    assert.equal(await target.locator('.slide-widget').count(), 10);
  }
});
