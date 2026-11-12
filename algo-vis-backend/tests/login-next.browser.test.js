/**
 * 測試模組：login-next.browser.test
 *
 * 驗證重點：全站只有首頁一個登入框。從程式碼頁出發的登入、註冊、忘記密碼與重設密碼，
 *           完成後都回到原本的程式碼頁；站外或不合法的 next 一律忽略。
 * 執行環境：隔離服務＋無頭瀏覽器；/api/auth/* 以 route 模擬，不建立或修改任何帳號。
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

const USER = { user_uid: 'fixture', username: 'fixture@example.test' };

async function newPage(browser, requests) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [] } }));
  await page.route('**/api/auth/**', route => {
    const request = route.request();
    const name = new URL(request.url()).pathname.split('/').pop();
    requests.push({ name, body: request.method() === 'POST' ? request.postDataJSON() : null });
    if (name === 'me') return route.fulfill({ json: { user: { id: USER.user_uid, username: USER.username } } });
    if (name === 'login') return route.fulfill({ json: { token: 'fixture-token', ...USER } });
    if (name === 'register') return route.fulfill({ json: { success: true } });
    if (name === 'forgot-password') return route.fulfill({ json: { message: '重置信已寄出，請檢查您的信箱！' } });
    if (name === 'reset-password') return route.fulfill({ json: { message: '密碼已更新，請重新登入。' } });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.route('**/api/slides**', route => route.fulfill({ json: { slides: [] } }));
  await page.route('**/api/slide-library', route => route.fulfill({ json: { layout: { folders: [], unfiled: [] } } }));
  return page;
}

async function fillAndSubmit(page, { email = USER.username, password = 'password123', confirm } = {}) {
  await page.locator('#emailInput').fill(email);
  if (password !== null) await page.locator('#passwordInput').fill(password);
  if (confirm) await page.locator('#confirmPasswordInput').fill(confirm);
  await page.locator('#authSubmitBtn').click();
}

test('login, register and password reset started from the code page all return to it', { timeout: 150000 }, async () => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const codePage = '/algorithm.html?sample=demo';
    const homeWithNext = `/?next=${encodeURIComponent(codePage)}`;

    // 1. Login: the code page's 登入 goes to the home login box and comes back after signing in.
    {
      const requests = []; const page = await newPage(browser, requests);
      await page.goto(base + codePage);
      assert.equal(await page.locator('#topLoginLink').getAttribute('href'), homeWithNext);
      await page.locator('#topLoginLink').click();
      await page.waitForURL(url => url.pathname === '/');
      await fillAndSubmit(page);
      await page.waitForURL(url => url.pathname === '/algorithm.html' && url.search === '?sample=demo');
      await page.locator('#topLogoutBtn').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#topAccountName').textContent(), USER.username);
      await page.close();
    }

    // 2. Register: creating an account also returns to the code page.
    {
      const requests = []; const page = await newPage(browser, requests);
      await page.goto(base + homeWithNext);
      await page.locator('#registerTab').click();
      await fillAndSubmit(page, { confirm: 'password123' });
      await page.waitForURL(url => url.pathname === '/algorithm.html');
      assert.deepEqual(requests.filter(r => r.name !== 'me').map(r => r.name), ['register', 'login']);
      await page.close();
    }

    // 3. Forgot password: the request carries next so the emailed link can bring the user back.
    {
      const requests = []; const page = await newPage(browser, requests);
      await page.goto(base + homeWithNext);
      await page.locator('#forgotPasswordBtn').click();
      // The password field is hidden here; it must not block the form (it used to stay required).
      assert.equal(await page.locator('#passwordInput').isVisible(), false);
      await fillAndSubmit(page, { password: null });
      await page.locator('#authMessage', { hasText: '重置信已寄出' }).waitFor();
      assert.deepEqual(requests.find(r => r.name === 'forgot-password').body, { username: USER.username, next: codePage });
      await page.close();
    }

    // 4. Reset link with next: after setting the password, logging in returns to the code page.
    {
      const requests = []; const page = await newPage(browser, requests);
      await page.goto(`${base}/?reset_token=fixture-reset&next=${encodeURIComponent(codePage)}`);
      assert.equal(await page.locator('#authSubmitBtn').textContent(), '更新密碼');
      // The token identifies the account, so the reset form only asks for the new password.
      assert.equal(await page.locator('#emailInput').isVisible(), false);
      assert.equal(await page.locator('label[for="emailInput"]').isVisible(), false);
      await page.locator('#passwordInput').fill('newpassword1');
      await page.locator('#authSubmitBtn').click();
      await page.locator('#authMessage', { hasText: '密碼已更新' }).waitFor();
      assert.equal(new URL(page.url()).search, `?next=${encodeURIComponent(codePage)}`, 'the reset token leaves the URL, next stays');
      assert.equal(await page.locator('#authSubmitBtn').textContent(), '登入');
      assert.equal(await page.locator('#emailInput').isVisible(), true, 'login shows the Email field again');
      await fillAndSubmit(page, { password: 'newpassword1' });
      await page.waitForURL(url => url.pathname === '/algorithm.html');
      await page.close();
    }

    // 5. Opening one's own deck while signed out goes to the login box and back to the deck.
    {
      const requests = []; const page = await newPage(browser, requests);
      await page.goto(`${base}/slides.html?deck=fixture-deck`);
      await page.waitForURL(url => url.pathname === '/' && url.searchParams.get('next') === '/slides.html?deck=fixture-deck');
      await fillAndSubmit(page);
      await page.waitForURL(url => url.pathname === '/slides.html' && url.searchParams.get('deck') === 'fixture-deck');
      await page.close();
    }

    // 6. Unsafe next values are ignored: the user stays on the home workspace.
    for (const next of ['//evil.example', '/\\evil.example', 'https://evil.example/', 'javascript:alert(1)']) {
      const requests = []; const page = await newPage(browser, requests);
      await page.goto(`${base}/?next=${encodeURIComponent(next)}`);
      await fillAndSubmit(page);
      await page.locator('#dashboardView').waitFor({ state: 'visible' });
      assert.equal(new URL(page.url()).origin, base, next);
      assert.equal(new URL(page.url()).pathname, '/', next);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.kill();
  }
});

test('forgot-password keeps only a same-site next in the reset link', async () => {
  // The route itself needs the database and mail; check the validator it uses.
  const fs = require('node:fs');
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const fn = source.match(/function safeReturnPath\(next\) \{[\s\S]*?\n\}/)[0];
  const safeReturnPath = new Function(`${fn}; return safeReturnPath;`)();
  assert.equal(safeReturnPath('/algorithm.html?sample=demo'), '/algorithm.html?sample=demo');
  for (const bad of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/a\tb', '/' + 'x'.repeat(600), null, 42]) {
    assert.equal(safeReturnPath(bad), '', String(bad));
  }
  assert.match(source, /const resetLink = `\$\{baseUrl\}\/\?reset_token=\$\{token\}\$\{returnPath \? `&next=\$\{encodeURIComponent\(returnPath\)\}` : ''\}`;/);
});
