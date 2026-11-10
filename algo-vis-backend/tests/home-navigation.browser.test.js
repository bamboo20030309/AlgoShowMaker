/**
 * 測試模組：home-navigation.browser.test
 *
 * 驗證重點：home navigation.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
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

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
// 2026-11-11 規格變更：頂部只留「投影片／程式碼」兩種模式；範例改為登入後工作區的分頁，
// 訪客首頁與訪客的 /?examples=1 維持原樣。
test('home offers two modes and signed-in users switch between their decks and examples',
  { timeout: 90000 }, async () => {
    const { server, base } = await startServer();
    let browser;
    try {
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      });

      // Guest: two modes only; the login panel stays beside the gallery.
      const guest = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await guest.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [] } }));
      await guest.goto(base);
      const modes = guest.locator('.mode-nav .nav-link');
      assert.deepEqual(await modes.allTextContents(), ['投影片', '程式碼']);
      assert.deepEqual(await modes.evaluateAll(links => links.map(link => link.getAttribute('href'))),
        ['/', '/algorithm.html']);
      assert.equal(await modes.first().getAttribute('aria-current'), 'page');
      assert.equal(await guest.locator('.auth-panel').isVisible(), true);
      assert.equal(await guest.locator('#headerLoginBtn').isVisible(), true);

      // Clicking the mode you are already in does not reload the page.
      await guest.evaluate(() => { window.__homeMarker = true; });
      await modes.first().click();
      await guest.waitForTimeout(300);
      assert.equal(await guest.evaluate(() => window.__homeMarker === true), true);

      // On wide screens the gallery scrolls in its own column, left of the login panel.
      const columns = await guest.evaluate(() => {
        const gallery = document.querySelector('.guest-view > .guest-gallery');
        return { overflowY: getComputedStyle(gallery).overflowY,
          galleryRight: gallery.getBoundingClientRect().right,
          authLeft: document.querySelector('.auth-panel').getBoundingClientRect().left,
          pageScrolls: document.documentElement.scrollHeight > innerHeight };
      });
      assert.equal(columns.overflowY, 'auto');
      assert.ok(columns.galleryRight <= columns.authLeft + 1, JSON.stringify(columns));
      assert.equal(columns.pageScrolls, false);

      // Guest /?examples=1 keeps the full-page gallery; the header login returns to the login panel.
      await guest.goto(`${base}/?examples=1`);
      assert.equal(await guest.locator('.auth-panel').isVisible(), false);
      await guest.locator('#headerLoginBtn').click();
      await guest.waitForURL(`${base}/`);
      assert.equal(await guest.locator('.auth-panel').isVisible(), true);

      // Signed in (API stubbed, no database writes): "my decks" is the default entry.
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture-token'));
      await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [] } }));
      await page.route('**/api/auth/me', route => route.fulfill({
        json: { user: { id: 'fixture', username: 'fixture@example.test' } }
      }));
      await page.route('**/api/slides', route => route.fulfill({ json: { slides: [], layout: null } }));
      await page.goto(base);
      await page.waitForSelector('#dashboardView:not([hidden])');
      const mineTab = page.locator('#workspaceMineTab');
      const examplesTab = page.locator('#workspaceExamplesTab');
      assert.equal(await mineTab.getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#workspaceMinePanel').isVisible(), true);
      assert.equal(await page.locator('#workspaceExamplesPanel').isVisible(), false);
      assert.equal(await page.locator('#createDeckBtn').isVisible(), true);
      assert.equal(await page.locator('#headerLoginBtn').isVisible(), false);

      await examplesTab.click();
      await page.waitForURL(`${base}/?examples=1`);
      assert.equal(await examplesTab.getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#workspaceExamplesPanel .guest-gallery').count(), 1);
      assert.equal(await page.locator('#workspaceExamplesPanel').isVisible(), true);
      assert.equal(await page.locator('#createDeckBtn').isVisible(), false);
      assert.equal(await page.locator('.workspace-sidebar').count(), 0, 'tabs replace the old left sidebar');

      // The URL keeps the tab on reload; signed-in /?examples=1 opens the tab directly.
      await page.reload();
      await page.waitForSelector('#dashboardView:not([hidden])');
      assert.equal(await examplesTab.getAttribute('aria-selected'), 'true');

      // The 投影片 mode link returns to "my decks" in place, without a reload.
      await page.evaluate(() => { window.__dashboardMarker = true; });
      await page.locator('.mode-nav .nav-link').first().click();
      await page.waitForURL(`${base}/`);
      assert.equal(await page.evaluate(() => window.__dashboardMarker === true), true);
      assert.equal(await mineTab.getAttribute('aria-selected'), 'true');

      // The folder action is an icon button with an accessible name.
      assert.equal(await page.locator('#createFolderBtn').getAttribute('aria-label'), '新增資料夾');
      assert.equal((await page.locator('#createFolderBtn').innerText()).trim(), '');
      await mineTab.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await examplesTab.getAttribute('aria-selected'), 'true');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'workspaceExamplesTab');

      // On the code page, clicking 程式碼 keeps the page (and any unsaved code) instead of reloading.
      const code = await browser.newPage({ viewport: { width: 1280, height: 800 } });
      await code.goto(`${base}/algorithm.html`);
      await code.evaluate(() => { window.__codeMarker = true; });
      await code.locator('.mode-nav .nav-link.is-active').click();
      await code.waitForTimeout(300);
      assert.equal(await code.evaluate(() => window.__codeMarker === true), true);
    } finally {
      await browser?.close();
      server.kill();
    }
  });
