const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('slide deletion requires the custom confirmation dialog', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); });
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
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const deck = { groups: [
      { id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [] }] },
      { id: 'g2', slides: [{ id: 's2', canvas: { objects: [] }, widgets: [] }] }
    ] };
    await page.addInitScript(deckData => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deckData)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.slideCount === '2');
    if (!(await page.locator('body').evaluate(body => body.classList.contains('asm-edit-mode')))) {
      await page.locator('#modeToggleBtn').click();
    }
    await page.locator('#slideOrderToggleBtn').click();
    await page.waitForFunction(() => document.querySelector('.custom-overview')?.hidden === false);
    assert.equal(await page.locator('.custom-overview-thumb').count(), 2);

    await page.keyboard.press('Delete');
    assert.equal(await page.locator('#slideDeleteDialog').evaluate(dialog => dialog.open), true);
    assert.match(await page.locator('#slideDeleteMessage').textContent(), /刪除/);
    await page.locator('#cancelSlideDeleteBtn').click();
    assert.equal(await page.locator('.custom-overview-thumb').count(), 2);

    await page.keyboard.press('Delete');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#slideDeleteDialog').evaluate(dialog => dialog.open), false);
    assert.equal(await page.locator('.custom-overview-thumb').count(), 2);

    await page.keyboard.press('Delete');
    await page.locator('#confirmSlideDeleteBtn').click();
    await page.waitForFunction(() => document.querySelectorAll('.custom-overview-thumb').length === 1);
    assert.equal(await page.locator('.custom-overview-thumb').count(), 1);
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelectorAll('.custom-overview-thumb').length === 2);
  } finally {
    await browser?.close();
    server.kill();
  }
});
