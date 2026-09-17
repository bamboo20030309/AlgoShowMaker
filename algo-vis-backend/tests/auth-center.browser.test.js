const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('auth panel centers in the visible viewport independently of the sample list', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [] } }));
    await page.goto(base); await page.waitForSelector('.gallery-folder');
    await page.locator('.guest-gallery').evaluate(el => el.style.minHeight = '5000px');
    async function bounds() {
      return page.locator('.auth-panel').evaluate(el => {
        const rect = el.getBoundingClientRect(), first = el.firstElementChild.getBoundingClientRect(), last = el.querySelector('#forgotPasswordBtn').getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, center: (first.top + last.bottom) / 2, height: innerHeight };
      });
    }
    const initial = await bounds(); assert.equal(initial.top, 52); assert.equal(initial.bottom, 1000);
    assert.ok(Math.abs(initial.center - 526) < 2);
    await page.evaluate(() => window.scrollTo(0, 1200));
    const scrolled = await bounds(); assert.equal(scrolled.top, 52); assert.equal(scrolled.bottom, 1000); assert.ok(Math.abs(scrolled.center - 526) < 2);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/auth-center-desktop.png') });
    await page.setViewportSize({ width: 1440, height: 450 }); await page.locator('#registerTab').click();
    const overflow = await page.locator('.auth-panel').evaluate(el => ({ overflowing: el.scrollHeight > el.clientHeight, heading: el.firstElementChild.getBoundingClientRect().top, top: el.getBoundingClientRect().top }));
    assert.equal(overflow.overflowing, true); assert.ok(overflow.heading >= overflow.top);
    await page.locator('.auth-panel').evaluate(el => el.scrollTop = el.scrollHeight);
    const submit = await page.locator('#authSubmitBtn').boundingBox(); assert.ok(submit.y >= 52 && submit.y + submit.height <= 450);
    await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0)); await page.locator('#loginTab').click();
    const mobile = await bounds(); assert.equal(mobile.top, 52); assert.equal(mobile.bottom, 844); assert.ok(Math.abs(mobile.center - 448) < 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(root, 'test-results/auth-center-mobile.png') });
    await page.goto(base + '/?examples=1');
    assert.equal(await page.locator('.auth-panel').isVisible(), false);
    assert.equal(await page.locator('.guest-gallery').evaluate(el => el.getBoundingClientRect().top), 52);
    const workspaceReturn = page.getByRole('link', { name: '返回投影片工作區' });
    assert.equal(await workspaceReturn.getAttribute('href'), '/');
    assert.equal(await workspaceReturn.locator('svg').count(), 1);
    assert.equal(await workspaceReturn.evaluate(el => getComputedStyle(el).display), 'inline-flex');
    assert.ok((await workspaceReturn.boundingBox()).height >= 36);
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
