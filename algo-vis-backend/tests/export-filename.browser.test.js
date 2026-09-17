const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('exported deck filename uses the workspace title', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [] }] }] };
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
    let title = '';
    await page.route('**/api/slides/filename-test', route => route.fulfill({ json: { slide: { title, deck } } }));
    for (const [source, expected] of [
      ['線性篩教學', '線性篩教學.asmdeck'],
      ['My algorithm', 'My algorithm.asmdeck'],
      ['  圖論: A/B?*  ', '圖論_ A_B__.asmdeck'],
      ['', '未命名投影片.asmdeck'],
      ['   ', '未命名投影片.asmdeck'],
      ['CON', '_CON.asmdeck'],
      ['Demo...', 'Demo.asmdeck'],
    ]) {
      title = source;
      await page.goto(base + '/slides.html?deck=filename-test');
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
      const downloaded = page.waitForEvent('download');
      await page.locator('#exportDeckBtn').click();
      assert.equal((await downloaded).suggestedFilename(), expected);
    }
  } finally { if (browser) await browser.close(); server.kill(); }
});
