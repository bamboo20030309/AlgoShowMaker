const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('sample loading never paints editor chrome and renders math on first insertion without CDN', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const formula = String.raw`\frac{n(n+1)}{2}`;
    const deck = { groups: [{ id: 'sample-group', slides: [{ id: 'sample-slide', canvas: { objects: [] }, widgets: [{ id: 'formula', type: 'latex', content: formula, x: 160, y: 160, w: 500, h: 120, fontSize: 34 }] }] }] };
    global.ASMTraceProvenance = require('../public/trace-provenance');
    const ASMDeck = require('../public/asmdeck');
    const archive = Buffer.from(await (await ASMDeck.encode({ deck, assets: {} })).arrayBuffer());
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], external = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => { external.push(route.request().url()); return route.abort(); });
    let release;
    const gate = new Promise(resolve => release = resolve);
    await page.route('**/guest-decks.json', async route => { await gate; await route.fulfill({ json: { decks: [{ id: 'fixture', title: 'Formula sample', archive: '/guest-decks/fixture.asmdeck' }] } }); });
    await page.route('**/guest-decks/fixture.asmdeck', route => route.fulfill({ body: archive, contentType: 'application/octet-stream' }));
    await page.addInitScript(() => {
      window.editorPaints = []; window.firstMathInsertion = null;
      const frame = () => { if (document.getElementById('controlChrome') && document.body.classList.contains('asm-edit-mode')) editorPaints.push(performance.now()); requestAnimationFrame(frame); }; requestAnimationFrame(frame);
      new MutationObserver(() => { const content = document.querySelector('.latex-content'); if (content && firstMathInsertion === null) firstMathInsertion = { engine: content.dataset.latexRenderedEngine, rendered: !!content.querySelector('.katex') }; }).observe(document, { childList: true, subtree: true });
    });
    await page.goto(base + '/slides.html?sample=fixture', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('body').evaluate(el => el.classList.contains('asm-edit-mode')), false);
    assert.equal(await page.locator('#editorChrome').isVisible(), false);
    assert.equal(await page.locator('#modeToggleBtn').isVisible(), false);
    release();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    await page.waitForFunction(() => document.querySelector('.latex-content')?.dataset.latexRenderedEngine === 'katex');
    assert.deepEqual(await page.evaluate(() => firstMathInsertion), { engine: 'katex', rendered: true });
    assert.deepEqual(await page.evaluate(() => editorPaints), []);
    assert.equal(await page.locator('#editorChrome').isVisible(), false);
    assert.equal(await page.locator('.chrome-home-link').isVisible(), true);
    assert.equal(await page.evaluate(() => katex.version), '0.16.22');
    await page.evaluate(() => document.fonts.ready);
    assert.ok(await page.locator('.latex-content .katex').count());
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/sample-latex-load.png') });
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
