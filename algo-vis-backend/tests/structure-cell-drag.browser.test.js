const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('selected array cell remains a handle for dragging its structure widget', { timeout: 120000 }, async () => {
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
    const widget = { id: 'array', type: 'structure', structureMode: 'normal', content: '0,0,0', x: 180, y: 140, w: 600, h: 260 };
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget] }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const object = page.locator('[data-widget-id="array"]');
    await object.click();
    if (!(await page.locator('#structureLengthInput').isVisible())) {
      await page.locator('#modeToggleBtn').click();
      await object.click();
    }
    const cell = object.locator('[data-structure-item-index="1"] > text');
    await cell.click();
    await page.waitForSelector('#structureContextMenu.structure-cell-style-toolbar');
    const before = await object.boundingBox();
    const point = await cell.boundingBox();
    const x = point.x + point.width / 2;
    const y = point.y + point.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 90, y + 45, { steps: 8 });
    await page.mouse.up();
    const after = await object.boundingBox();
    assert.ok(after.x > before.x + 40, `array did not move horizontally: ${before.x} -> ${after.x}`);
    assert.ok(after.y > before.y + 15, `array did not move vertically: ${before.y} -> ${after.y}`);
    await object.locator('[data-structure-item-index="1"] > text').dblclick();
    assert.equal(await page.locator('.structure-inline-value-input').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
