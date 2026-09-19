const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('marquee selection includes LaTeX and code widgets', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
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
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const widgets = [
      { id: 'latex', type: 'latex', content: String.raw`\(a^2+b^2=c^2\)`, x: 200, y: 180, w: 250, h: 100 },
      { id: 'code', type: 'code', content: 'return 0;', language: 'cpp', x: 550, y: 220, w: 360, h: 200 },
      { id: 'outside', type: 'latex', content: String.raw`\(x\)`, x: 1050, y: 560, w: 120, h: 80 }
    ];
    const deck = { groups: [{ id: 'g1', slides: [{
      id: 's1',
      canvas: { objects: [{ type: 'textbox', text: 'Fabric object', left: 320, top: 360, width: 180, fontSize: 28 }] },
      widgets
    }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    if (!(await page.locator('body').evaluate(body => body.classList.contains('asm-edit-mode')))) await page.locator('#modeToggleBtn').click();
    await page.locator('[data-widget-id="outside"]').click();
    assert.equal(await page.locator('[data-widget-id="outside"]').evaluate(el => el.classList.contains('is-selected')), true);

    const host = page.locator('.fabric-host[data-slide-id="s1"]');
    const box = await host.boundingBox();
    const point = (x, y) => ({ x: box.x + box.width * x / 1280, y: box.y + box.height * y / 720 });
    const start = point(100, 100);
    const end = point(950, 500);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();

    await page.waitForFunction(() => document.querySelectorAll('.slide-widget.is-selected').length === 2);
    assert.equal(await page.locator('[data-widget-id="latex"]').evaluate(el => el.classList.contains('is-selected')), true);
    assert.equal(await page.locator('[data-widget-id="code"]').evaluate(el => el.classList.contains('is-selected')), true);
    assert.equal(await page.locator('[data-widget-id="outside"]').evaluate(el => el.classList.contains('is-selected')), false);
    assert.equal(await page.locator('#alignmentToolbar').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
