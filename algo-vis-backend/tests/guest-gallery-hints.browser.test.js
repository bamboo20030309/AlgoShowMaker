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

test('sample cards show category and algorithm purpose hints', { timeout: 90000 }, async () => {
  const { server, base } = await startServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [
      { id: 'linear-sieve', title: '線篩', categories: ['Math'], hints: ['質數篩'], archive: '/missing-linear.asmdeck' },
      { id: 'segment-tree', title: '線段樹', categories: ['Data_Structure'], hints: ['區間修改', '區間和'], archive: '/missing-segment.asmdeck' }
    ] } }));
    await page.goto(`${base}/?examples=1`);
    await page.waitForSelector('#sample-category-Math .deck-card');

    const labels = async selector => page.locator(`${selector} .deck-hint`).allTextContents();
    assert.deepEqual(await labels('#sample-category-Math .deck-card'), ['數學', '質數篩']);
    assert.deepEqual(await labels('#sample-category-Data_Structure .deck-card'), ['資料結構', '區間修改', '區間和']);
    assert.equal(await page.locator('.deck-meta').getByText('免登入觀賞', { exact: true }).count(), 0);

    await page.locator('#gallerySearch').fill('區間修改');
    assert.equal(await page.locator('#sample-category-Data_Structure .deck-card').count(), 1);
    assert.equal(await page.locator('#sample-category-Math').count(), 0);
  } finally {
    await browser?.close();
    server.kill();
  }
});
