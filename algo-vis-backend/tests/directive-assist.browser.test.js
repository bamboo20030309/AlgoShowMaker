const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('Ace suggestions separate root directives from suffixes and accept Tab with native scrolling', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/algorithm.html');
  await page.waitForFunction(() => window.ASMDirectiveAssist && document.body.dataset.defaultAnimationState === 'ready');
  const set = async value => {
    await page.evaluate(value => { const ed = ace.edit('editor'); ed.setValue(value, 1); ed.focus(); }, value);
  };
  const labels = () => page.evaluate(() => ace.edit('editor').completer.popup.data.map(item => item.caption));
  const open = () => page.waitForFunction(() => ace.edit('editor').completer?.activated && ace.edit('editor').completer.popup?.data?.length);
  await set(''); await page.keyboard.type('@'); await open();
  const roots = await labels();
  assert.ok(roots.includes('@frame') && roots.includes('@object'));
  assert.ok(roots.every(label => label.startsWith('@')));
  assert.ok(!roots.includes('with') && !roots.includes('at'));
  await page.keyboard.type('fr'); await open();
  await page.waitForFunction(() => ace.edit('editor').completer.popup.data.length === 1);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => ace.edit('editor').getValue()), '// @frame ');
  await page.keyboard.type('arr '); await open();
  const suffixes = await labels();
  assert.ok(suffixes.includes('with') && suffixes.includes('at'));
  assert.ok(!suffixes.some(label => label.startsWith('@')));
  await page.keyboard.type('wi'); await open(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => ace.edit('editor').getValue()), '// @frame arr with ');
  await open(); assert.ok((await labels()).includes('range'));
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => ace.edit('editor').completer.activated), false);
  await page.keyboard.press('Tab'); await open();
  await page.keyboard.press('Escape');
  await set('// @'); await open();
  for (let i=0; i<18; i++) await page.keyboard.press('ArrowDown');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const visible = await page.evaluate(() => {
    const popup = ace.edit('editor').completer.popup;
    const row = popup.getRow();
    return row >= popup.renderer.layerConfig.firstRow && row <= popup.renderer.layerConfig.lastRow;
  });
  assert.equal(visible, true);
  if (process.env.ASM_CAPTURE_DIRECTIVE_GUIDE === '1') {
    const directory = path.resolve(__dirname, '../../docs/images/directive-autocomplete');
    fs.mkdirSync(directory, { recursive: true });
    await set('// @'); await open();
    await page.screenshot({ path: path.join(directory, 'root.png') });
    await set('// @frame arr '); await open();
    await page.screenshot({ path: path.join(directory, 'suffix.png') });
  }
  await set('// @object arr with '); await open();
  assert.ok((await labels()).includes('labels(value,index)'));
  await set('// @text "hello" at arr.bottom');
  await page.keyboard.press('Escape');
  await set('int '); await page.keyboard.press('Tab');
  assert.ok(!await page.evaluate(() => ace.edit('editor').completer?.activated));
  await set('// @text "with ');
  assert.equal(await page.evaluate(() => ASMDirectiveAssist.choices().length), 0);
  await set('const char* s = "a@b.com";');
  assert.ok(!await page.evaluate(() => ace.edit('editor').completer?.activated));
  // Keep the existing right-click examples available beside Ace's native completion popup.
  await set('// @frame arr'); await page.keyboard.press('Escape');
  const point = await page.evaluate(() => ace.edit('editor').renderer.textToScreenCoordinates(0, 5));
  await page.mouse.click(point.pageX, point.pageY + 5, { button: 'right' });
  await page.waitForFunction(() => !document.getElementById('asmDirectiveAssist').hidden);
  assert.ok((await page.locator('#asmDirectiveAssist').innerText()).includes('範例與常用寫法'));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#asmDirectiveAssist').isVisible(), false);
  assert.deepEqual(errors, []);
});
