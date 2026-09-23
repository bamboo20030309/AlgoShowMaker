const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('slide color picker offers AV colors and saves transparent and opaque swatches', { timeout: 120000 }, async () => {
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
    const widget = { id: 'array', type: 'structure', structureMode: 'normal', content: '0, 0, 0', x: 180, y: 140, w: 500, h: 150, structureFrameVersion: 4 };
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget] }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      if (sessionStorage.getItem('av-palette-fixture-installed')) return;
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
      sessionStorage.setItem('av-palette-fixture-installed', '1');
    }, deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const object = page.locator('[data-widget-id="array"]');
    await object.click();
    if (!(await page.locator('#structureLengthInput').isVisible())) {
      await page.locator('#modeToggleBtn').click();
      await object.click();
    }
    const toolbar = page.locator('#structureContextMenu');
    const selectCellStyle = async (index, style) => {
      if (await page.locator('#iroPopup').isVisible()) {
        await page.mouse.move(10, 10);
        await page.waitForTimeout(30);
      }
      await object.locator(`[data-structure-item-index="${index}"] > text`).click();
      await page.waitForSelector('#structureContextMenu.structure-cell-style-toolbar');
      await toolbar.getByRole('button', { name: style, exact: true }).click();
      await toolbar.getByRole('button', { name: style, exact: true }).hover();
    };
    await selectCellStyle(0, 'Highlight');
    const palette = page.locator('#avColorSwatches');
    const colors = await page.evaluate(() => window.ASMArrowModel.COLORS);
    assert.deepEqual(await palette.locator('[data-av-color]').evaluateAll(buttons => buttons.map(button => button.dataset.avColor)), Object.keys(colors));
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/slides-av-color-palette.png') });
    await palette.locator('[data-av-color="AV_red"]').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    const savedWidget = () => page.evaluate(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].widgets[0];
    });
    assert.equal((await savedWidget()).cellStyles['0'].highlight, colors.AV_red);
    await selectCellStyle(1, 'Highlight');
    await palette.locator('[data-av-color="AV_node_green"]').click();
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const saved = await savedWidget();
    assert.equal(saved.cellStyles['0'].highlight, colors.AV_red);
    assert.equal(saved.cellStyles['1'].highlight, colors.AV_node_green);
    assert.equal(saved.highlightColor, '#ff0000');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
