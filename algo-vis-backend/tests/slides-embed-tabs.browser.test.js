/**
 * Algorithm-slide embeds retain the result tabs that belong to the animation.
 * The focused browser check covers the runtime surface used inside slides and
 * the full editor iframe without compiling or rebuilding an animation.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

function freePort() {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

async function waitForServer(base) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      if ((await fetch(`${base}/algorithm.html?asmEmbed=runtime`)).ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('test server did not start');
}

test('algorithm slide embeds expose and switch the original result tabs',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
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
      await waitForServer(base);
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      });

      for (const mode of ['runtime', 'editor']) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
        await page.goto(`${base}/algorithm.html?asmEmbed=${mode}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(expected => document.body.classList.contains(`asm-embed-${expected}`), mode);

        assert.equal(await page.locator('#subTabs').isVisible(), true,
          `${mode} embed displays the result tab frame`);
        await page.locator('.tab-btn[data-tab="tab-input"]').click();
        assert.equal(await page.locator('#tab-input').evaluate(element => element.classList.contains('active')), true,
          `${mode} embed can select input`);
        await page.locator('.tab-btn[data-tab="tab-output"]').click();
        assert.equal(await page.locator('#tab-output').evaluate(element => element.classList.contains('active')), true,
          `${mode} embed can select output`);
        await page.locator('.tab-btn[data-tab="tab-canvas"]').click();
        assert.equal(await page.locator('#tab-canvas').evaluate(element => element.classList.contains('active')), true,
          `${mode} embed can return to the canvas`);
        await page.close();
      }
    } finally {
      if (browser) await browser.close();
      server.kill();
    }
  });
