const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('structure outerframe names are editable and preserve defaults, custom values, and blanks', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
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
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const widget = (id, x, structureName) => ({
      id,
      type: 'structure',
      structureMode: 'normal',
      content: '1, 2, 3',
      x,
      y: 100,
      w: 200,
      h: 110,
      manualSize: true,
      structureFrameVersion: 4,
      ...(structureName === undefined ? {} : { structureName })
    });
    const deck = {
      groups: [{ id: 'g1', slides: [{
        id: 's1',
        canvas: { objects: [] },
        widgets: [
          widget('legacy', 70),
          widget('default-switch', 350),
          widget('custom', 630, '我的陣列'),
          widget('blank', 910, '')
        ]
      }] }]
    };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.addInitScript(value => {
      if (sessionStorage.getItem('structure-name-fixture-installed')) return;
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
      sessionStorage.setItem('structure-name-fixture-installed', '1');
    }, deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());

    const labelText = id => page.locator(`[data-widget-id="${id}"] .outerframe-label`).textContent();
    assert.equal(await labelText('legacy'), 'Array', 'an old object without the field did not receive its mode default');
    assert.equal(await labelText('custom'), '我的陣列', 'a saved custom name was overwritten');
    assert.equal(await labelText('blank'), '', 'an explicitly blank name was replaced with the default');

    await page.locator('[data-widget-id="default-switch"]').click();
    await page.locator('#structureModeSelect').selectOption('queue');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="default-switch"] .outerframe-label')?.textContent === 'Queue');
    assert.equal(await page.locator('#structureNameInput').inputValue(), 'Queue', 'the mode default name did not follow the selected mode');

    await page.locator('[data-widget-id="legacy"]').click();
    const nameInput = page.locator('#structureNameInput');
    assert.equal(await nameInput.inputValue(), 'Array');
    await nameInput.fill('資料陣列');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="legacy"] .outerframe-label')?.textContent === '資料陣列');
    await page.locator('#structureModeSelect').selectOption('heap');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="legacy"] .outerframe-label')?.textContent === '資料陣列');
    assert.equal(await nameInput.inputValue(), '資料陣列', 'switching modes replaced a custom name');

    await page.locator('[data-widget-id="custom"]').click();
    await nameInput.fill('');
    await page.waitForFunction(() => document.querySelector('[data-widget-id="custom"] .outerframe-label')?.textContent === '');

    await page.locator('[data-widget-id="blank"]').click();
    await page.locator('#structureModeSelect').selectOption('queue');
    assert.equal(await nameInput.inputValue(), '', 'switching modes replaced an explicitly blank name');

    await page.locator('[data-widget-id="custom"]').click();
    await nameInput.fill('自訂名稱');
    await page.waitForFunction(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].widgets.find(item => item.id === 'custom')?.structureName === '自訂名稱';
    });
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    assert.equal(await labelText('custom'), '自訂名稱', 'the custom name did not survive save and reload');
    assert.equal(await labelText('blank'), '', 'the blank name did not survive save and reload');

    await page.locator('[data-widget-id="custom"]').click();
    await page.locator('#exitStructureEditorBtn').click();
    const priorCount = await page.locator('.structure-widget').count();
    await page.locator('#structureMenuBtn').click();
    await page.locator('[data-tool="structure"][data-structure-mode="normal"]').click();
    await page.waitForFunction(count => document.querySelectorAll('.structure-widget').length === count + 1, priorCount);
    assert.equal(await page.locator('.structure-widget').last().locator('.outerframe-label').textContent(), 'Array');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
