/**
 * 測試模組：my-codes.browser.test
 *
 * 驗證重點：程式碼頁「我的程式碼」側欄——未登入的登入提示（?next= 帶回本頁）、
 *           儲存、載入、刪除確認、登入過期回到訪客狀態，以及與「演算法範例集」互斥。
 * 執行環境：隔離服務＋無頭瀏覽器；/api/codes 與 /api/auth/me 以 route 模擬，不寫入資料庫。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

async function startServer() {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(base)).ok) return { server, base }; } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('test server did not start');
}

test('code page saves, lists, loads and deletes my code, and asks guests to sign in', { timeout: 120000 }, async () => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });

    // ---- Guest: the panel only offers signing in, which returns to this page. ----
    const guest = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    let guestCodeRequests = 0;
    await guest.route('**/api/codes**', route => { guestCodeRequests += 1; return route.fulfill({ status: 401, json: {} }); });
    await guest.goto(`${base}/algorithm.html?sample=demo`);
    await guest.locator('#myCodesBtn').click();
    await guest.locator('#myCodesPanel.open').waitFor();
    assert.equal(await guest.locator('#myCodesBody .my-codes-hint').textContent(), '登入後可儲存程式碼');
    assert.equal(await guest.locator('#myCodesBody a.my-codes-primary').getAttribute('href'), '/?next=%2Falgorithm.html%3Fsample%3Ddemo');
    assert.equal(await guest.locator('.my-codes-add').count(), 0);
    assert.equal(guestCodeRequests, 0, 'guests do not call the code API');
    assert.equal(await guest.locator('#loginModal, #loginTriggerBtn').count(), 0, 'no separate login window on the code page');
    // Mutually exclusive with the examples panel; Escape closes.
    await guest.locator('#algoSamplesBtn').click();
    assert.equal(await guest.locator('#myCodesPanel').evaluate(el => el.classList.contains('open')), false);
    assert.equal(await guest.locator('#algoSidePanel').evaluate(el => el.classList.contains('open')), true);
    await guest.locator('#myCodesBtn').click();
    assert.equal(await guest.locator('#algoSidePanel').evaluate(el => el.classList.contains('open')), false);
    await guest.keyboard.press('Escape');
    assert.equal(await guest.locator('#myCodesPanel').evaluate(el => el.classList.contains('open')), false);
    await guest.close();

    // ---- Signed in: save, list, load and delete with an in-panel confirmation. ----
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.addInitScript(() => { localStorage.setItem('algo_jwt_token', 'fixture-token'); localStorage.setItem('algo_username', 'fixture'); });
    const store = [{ code_uid: 'old-1', title: '<b>舊程式</b>', desc: '既有資料', language: 'cpp', content: 'int old;', inputs: ['5'], created_at: '2026-01-02T00:00:00Z' }];
    const posted = [];
    let expired = false;
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }));
    await page.route('**/api/codes**', async route => {
      const request = route.request();
      assert.equal(request.headers().authorization, 'Bearer fixture-token');
      if (expired) return route.fulfill({ status: 401, json: { error: 'expired' } });
      const id = new URL(request.url()).pathname.split('/')[3];
      if (request.method() === 'POST') {
        const body = request.postDataJSON(); posted.push(body);
        store.unshift({ code_uid: `new-${posted.length}`, ...body, created_at: new Date().toISOString() });
        return route.fulfill({ json: { success: true } });
      }
      if (request.method() === 'DELETE') { store.splice(store.findIndex(code => code.code_uid === id), 1); return route.fulfill({ json: { success: true } }); }
      if (id) return route.fulfill({ json: { code: store.find(code => code.code_uid === id) } });
      return route.fulfill({ json: { codes: store } });
    });
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => typeof window.asmReplaceEditorCode === 'function');
    await page.evaluate(() => { window.asmReplaceEditorCode('int main() { return 0; }', 1); document.getElementById('inputArea').value = '3 4'; });

    await page.locator('#myCodesBtn').click();
    const items = page.locator('#myCodesBody .my-codes-item');
    await items.first().waitFor();
    assert.equal(await page.locator('#myCodesBtn').getAttribute('aria-expanded'), 'true');
    assert.equal(await items.first().locator('.my-codes-title').textContent(), '<b>舊程式</b>', 'titles are shown as text, never HTML');

    // Save: empty title is not submitted; then title + description + input.
    await page.locator('.my-codes-add').click();
    await page.locator('.my-codes-form [type="submit"]').click();
    assert.equal(posted.length, 0);
    await page.locator('.my-codes-form input[name="title"]').fill('二分搜尋');
    await page.locator('.my-codes-form textarea[name="desc"]').fill('練習用');
    await page.locator('.my-codes-form [type="submit"]').click();
    await page.waitForFunction(() => document.querySelectorAll('#myCodesBody .my-codes-item').length === 2);
    assert.deepEqual(posted[0], { title: '二分搜尋', desc: '練習用', language: 'cpp', content: 'int main() { return 0; }', inputs: ['3 4'] });
    assert.equal(await items.first().locator('.my-codes-title').textContent(), '二分搜尋');
    assert.equal(await page.locator('.my-codes-form').count(), 0, 'the form closes after saving');

    // Load the older code into the editor and input; the panel closes.
    await page.locator('.my-codes-item', { hasText: '舊程式' }).locator('.my-codes-open').click();
    await page.waitForFunction(() => aceEditor.getValue() === 'int old;');
    assert.equal(await page.locator('#inputArea').inputValue(), '5');
    assert.equal(await page.locator('#myCodesPanel').evaluate(el => el.classList.contains('open')), false);

    // Delete asks first; cancel keeps it, confirm removes it.
    await page.locator('#myCodesBtn').click();
    const target = page.locator('.my-codes-item', { hasText: '二分搜尋' });
    await target.hover(); await target.locator('.my-codes-delete').click();
    assert.match(await page.locator('.my-codes-confirm').textContent(), /刪除「二分搜尋」？/);
    await page.locator('.my-codes-item.is-confirming .my-codes-secondary').click();
    assert.equal(await items.count(), 2);
    await target.hover(); await target.locator('.my-codes-delete').click();
    await page.locator('.my-codes-item.is-confirming .my-codes-danger').click();
    await page.waitForFunction(() => document.querySelectorAll('#myCodesBody .my-codes-item').length === 1);
    assert.equal(store.length, 1);

    // An expired login falls back to the guest view in the panel and the top bar.
    expired = true;
    await page.locator('.my-codes-add').click();
    await page.locator('.my-codes-form input[name="title"]').fill('過期');
    await page.locator('.my-codes-form [type="submit"]').click();
    await page.locator('#myCodesBody .my-codes-hint').waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('algo_jwt_token')), null);
    assert.equal(await page.locator('#topLoginLink').isVisible(), true);
    assert.equal(await page.locator('#topLogoutBtn').isVisible(), false);
  } finally {
    await browser?.close();
    server.kill();
  }
});
