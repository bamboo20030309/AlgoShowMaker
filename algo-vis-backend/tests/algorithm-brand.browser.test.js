const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('algorithm brand matches the home identity and links home', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selectedPort = probe.address().port;
      probe.close(() => resolve(selectedPort));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      ASM_REGRESSION: '1',
      JWT_SECRET: randomBytes(32).toString('hex')
    },
    windowsHide: true,
    stdio: 'ignore'
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        if ((await fetch(`${base}/algorithm.html`)).ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/algorithm.html`, { waitUntil: 'domcontentloaded' });

    const brand = page.getByRole('link', { name: 'AlgoShowMaker 首頁' });
    assert.equal(await brand.getAttribute('href'), '/');
    assert.equal(await brand.locator('span').textContent(), 'AlgoShowMaker');
    const appearance = await brand.evaluate(element => {
      const image = element.querySelector('img');
      const style = getComputedStyle(element);
      return {
        display: style.display,
        gap: style.gap,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        imageLoaded: image.complete && image.naturalWidth > 0,
        imageWidth: image.getBoundingClientRect().width,
        imageHeight: image.getBoundingClientRect().height
      };
    });
    assert.ok(['flex', 'inline-flex'].includes(appearance.display));
    assert.deepEqual({ ...appearance, display: undefined }, {
      display: undefined,
      gap: '9px',
      fontSize: '17px',
      fontWeight: '700',
      imageLoaded: true,
      imageWidth: 28,
      imageHeight: 28
    });

    await brand.click();
    await page.waitForURL(`${base}/`);
    assert.equal(await page.locator('.brand span').textContent(), 'AlgoShowMaker');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
