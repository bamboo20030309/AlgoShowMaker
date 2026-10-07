/**
 * 驗證首頁刪除投影片使用站內確認視窗，並且只有確認後才送出刪除請求。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

function availablePort() {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

test('homepage asks for deck deletion in an in-page dialog', { timeout: 60000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await availablePort();
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

    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage();
    const nativeDialogs = [];
    let deleteRequests = 0;
    page.on('dialog', async dialog => {
      nativeDialogs.push(dialog.type());
      await dialog.dismiss();
    });
    await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }));
    await page.route('**/api/slides', route => route.fulfill({ json: { slides: [{ deck_uid: 'deck-1', title: '快速排序', updated_at: '2026-09-28', slide_count: 8 }] } }));
    await page.route('**/api/slides/deck-1', route => {
      if (route.request().method() === 'DELETE') deleteRequests += 1;
      return route.fulfill({ json: { ok: true } });
    });
    await page.route('**/api/slide-library', route => route.fulfill({ json: { layout: { folders: [], unfiled: ['deck-1'] } } }));

    await page.goto(base);
    await page.getByRole('button', { name: '快速排序 設定' }).click();
    await page.locator('#deleteDeckBtn').click();

    assert.equal(await page.locator('#deleteDeckDialog').evaluate(dialog => dialog.open), true);
    assert.equal(await page.locator('#deleteDeckName').textContent(), '快速排序');
    const deleteButton = await page.locator('#confirmDeleteDeckBtn').boundingBox();
    const cancelButton = await page.locator('#cancelDeleteDeckBtn').boundingBox();
    assert.ok(deleteButton.x + deleteButton.width <= cancelButton.x, 'delete is left of cancel');
    assert.equal(await page.locator('#cancelDeleteDeckBtn').evaluate(button => button === document.activeElement), true);
    assert.deepEqual(nativeDialogs, []);

    await page.locator('#cancelDeleteDeckBtn').click();
    assert.equal(deleteRequests, 0);
    assert.equal(await page.locator('#deckDialog').evaluate(dialog => dialog.open), true);

    await page.locator('#deleteDeckBtn').click();
    await page.locator('#confirmDeleteDeckBtn').click();
    await page.waitForFunction(() => !document.querySelector('#deleteDeckDialog').open);
    assert.equal(deleteRequests, 1);
    assert.equal(await page.locator('#deckGrid .deck-card').count(), 0);
    assert.deepEqual(nativeDialogs, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
