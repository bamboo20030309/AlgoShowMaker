const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('code focus realigns on slide entry using the existing animation destination', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const content = Array.from({ length: 80 }, (_, i) => `int value${i + 1} = ${i + 1};`).join('\n');
    const widget = (id, focusLines, transitionId = '') => ({ id, type: 'code', content, focusLines, transitionId, showLineNumbers: true, x: 180, y: 140, w: 650, h: 240, fontSize: 21 });
    const deck = { groups: [
      { id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget('c1', '10-12')] }] },
      { id: 'g2', slides: [{ id: 's2', canvas: { objects: [] }, widgets: [widget('c2', '55-58', 'pair')] }] },
      { id: 'g3', slides: [{ id: 's3', canvas: { objects: [] }, widgets: [widget('c3', '30-33', 'pair')] }] },
      { id: 'g4', slides: [{ id: 's4', canvas: { objects: [] }, widgets: [widget('c4', '')] }] }
    ] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), deck);
    await page.goto(base + '/slides.html');
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    await page.waitForTimeout(1600);
    async function centered(id, first, last) {
      const result = await page.locator(`[data-widget-id="${id}"]`).evaluate((el, { first, last }) => {
        const pre = el.querySelector('pre'), rows = el.querySelectorAll('.hljs-ln tr');
        const bounds = pre.getBoundingClientRect(), scale = bounds.height / pre.clientHeight;
        const start = rows[first - 1].getBoundingClientRect(), end = rows[last - 1].getBoundingClientRect();
        return { scroll: pre.scrollTop, error: Math.abs((start.top + end.bottom - 1 * scale) / 2 - (bounds.top + bounds.bottom) / 2) / scale };
      }, { first, last });
      assert.ok(result.scroll > 0, `${id} should scroll to focused rows`);
      assert.ok(result.error < 2, `${id} focus center offset ${result.error}`);
    }
    await centered('c1', 10, 12);
    await page.locator('[data-widget-id="c2"] pre').evaluate(pre => pre.scrollTop = 0);
    await page.evaluate(() => Reveal.slide(1)); await page.waitForTimeout(650);
    await centered('c2', 55, 58);
    await page.locator('[data-widget-id="c2"] pre').evaluate(pre => pre.scrollTop = 0);
    await page.evaluate(() => Reveal.slide(0)); await page.waitForTimeout(650);
    await page.evaluate(() => Reveal.slide(1)); await page.waitForTimeout(650);
    await centered('c2', 55, 58);
    await page.locator('#modeToggleBtn').click();
    await page.evaluate(() => {
      Reveal.on('autoanimate', event => {
        if (event.toSlide.dataset.slideId !== 's3') return;
        window.codeAnimationEntry = {
          source: event.fromSlide.querySelector('pre').scrollTop,
          target: event.toSlide.querySelector('pre').scrollTop,
          claimed: Boolean(event.toSlide.querySelector('.code-widget').dataset.codeAutoAnimating)
        };
      });
      Reveal.slide(2);
    });
    await page.waitForFunction(() => document.body.dataset.codeAutoAnimateCount === '1');
    const entry = await page.evaluate(() => window.codeAnimationEntry);
    assert.equal(entry.claimed, true); assert.ok(Math.abs(entry.source - entry.target) < 1);
    await page.waitForFunction(() => !document.querySelector('[data-widget-id="c3"]').dataset.codeAutoAnimating);
    await centered('c3', 30, 33);
    await page.evaluate(() => Reveal.slide(3)); await page.waitForTimeout(650);
    await page.locator('[data-widget-id="c4"] pre').evaluate(pre => pre.scrollTop = 250);
    await page.evaluate(() => Reveal.slide(0)); await page.waitForTimeout(650);
    await page.evaluate(() => Reveal.slide(3)); await page.waitForTimeout(650);
    assert.equal(await page.locator('[data-widget-id="c4"] pre').evaluate(pre => pre.scrollTop), 250);
    await page.evaluate(() => { Reveal.slide(1); Reveal.slide(3); Reveal.slide(1); }); await page.waitForTimeout(650);
    await centered('c2', 55, 58);
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
