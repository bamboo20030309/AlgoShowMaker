const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('canvas culling preserves geometry and restores offscreen objects after camera movement', { timeout: 120000 }, async () => {
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
        if ((await fetch(`${base}/algorithm.html?asmEmbed=runtime`)).ok) break;
      } catch { }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${base}/algorithm.html?asmEmbed=runtime`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.asmApplyTraceDocument && window.ASMPlaybackTime);

    await page.evaluate(() => {
      const svg = document.getElementById('arraySvg');
      const ns = 'http://www.w3.org/2000/svg';
      const scene = document.createElementNS(ns, 'g');
      scene.id = 'asm-trace-root';
      for (let index = 0; index < 120; index += 1) {
        const object = document.createElementNS(ns, 'g');
        object.setAttribute('data-trace-object-key', 'fixture-' + index);
        object.setAttribute('transform', 'translate(' + (20 + index * 500) + ',80)');
        const cell = document.createElementNS(ns, 'rect');
        cell.setAttribute('width', '60');
        cell.setAttribute('height', '60');
        cell.setAttribute('fill', 'red');
        object.append(cell);
        scene.append(object);
      }
      const hidden = scene.children[1];
      hidden.style.visibility = 'hidden';
      svg.append(scene);
      window.ASMTraceViewportCulling.refresh();
    });
    const object = index => page.locator('[data-trace-object-key="fixture-' + index + '"]');
    await page.waitForFunction(() => window.ASMTraceViewportCulling.stats().culled > 100);
    const initial = await page.evaluate(() => window.ASMTraceViewportCulling.stats());
    assert.equal(initial.observed, 120);
    assert.ok(initial.culled > 100);
    assert.equal(await object(0).getAttribute('data-asm-viewport-culled'), null);
    const before = await object(119).evaluate(el => ({
      boxWidth: el.getBBox().width, transform: el.getAttribute('transform'),
      fill: el.querySelector('rect').getAttribute('fill')
    }));
    assert.equal(before.boxWidth, 60, 'culled SVG retains geometry for camera/layout');
    await page.evaluate(() => document.getElementById('asm-trace-root')
      .setAttribute('transform', 'translate(-59500,0)'));
    await page.waitForFunction(() => !document.querySelector('[data-trace-object-key="fixture-119"]')
      .hasAttribute('data-asm-viewport-culled'));
    assert.equal(await object(119).evaluate(el => getComputedStyle(el).visibility), 'visible');
    assert.deepEqual(await object(119).evaluate(el => ({
      boxWidth: el.getBBox().width, transform: el.getAttribute('transform'),
      fill: el.querySelector('rect').getAttribute('fill')
    })), before);
    await page.evaluate(() => document.getElementById('asm-trace-root').removeAttribute('transform'));
    await page.waitForFunction(() => !document.querySelector('[data-trace-object-key="fixture-0"]')
      .hasAttribute('data-asm-viewport-culled'));
    assert.equal(await object(1).evaluate(el => getComputedStyle(el).visibility), 'hidden',
      'authored visibility remains hidden when back in viewport');
    await page.evaluate(() => {
      document.getElementById('asm-trace-root').remove();
      window.ASMTraceViewportCulling.refresh();
    });
    assert.deepEqual(await page.evaluate(() => window.ASMTraceViewportCulling.stats()),
      {observed: 0, culled: 0});
  } finally {
    await browser?.close();
    server.kill();
  }
});
