const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('slide text backing density follows display zoom while preserving editable coordinates', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const deck = { groups: [1, 2].map(n => ({ id: `g${n}`, slides: [{ id: `s${n}`, canvas: { objects: [{ type: 'textbox', text: '文字解析度 ABC 123', left: 400, top: 220, width: 600, fontSize: 48, fontFamily: 'Arial' }] }, widgets: [] }] })) };
    for (const dpr of [1, 2]) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dpr });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), deck);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
      await page.locator('#modeToggleBtn').click();
      async function density(id = 's1') {
        await page.waitForTimeout(500);
        return page.evaluate(id => { const el = document.getElementById(`fabric-${id}`); const rect = el.getBoundingClientRect(); return { width: el.width, height: el.height, pixelsPerScreenPixel: el.width / (rect.width * devicePixelRatio), globalDpr: fabric.devicePixelRatio }; }, id);
      }
      const normal = await density(); assert.ok(normal.pixelsPerScreenPixel >= 0.99); assert.equal(normal.globalDpr, dpr);
      for (let i = 0; i < 10; i++) await page.locator('#slideZoomInBtn').click();
      const zoomed = await density();
      assert.ok(zoomed.width > normal.width);
      assert.ok(zoomed.width * zoomed.height <= 32000000);
      if (dpr === 1) assert.ok(zoomed.pixelsPerScreenPixel >= 0.99);
      else assert.ok(zoomed.pixelsPerScreenPixel > 0.7); // Bounded allocation still improves the old 0.36 ratio.
      fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
      await page.screenshot({ path: path.join(root, `test-results/text-resolution-dpr-${dpr}.png`) });
      await page.evaluate(() => Reveal.slide(1));
      const second = await density('s2'); assert.ok(second.width > 1640);
      assert.equal(await page.evaluate(() => document.getElementById('fabric-s1').width), 1640);
      await page.evaluate(() => Reveal.slide(0));
      await page.locator('#slideZoomResetBtn').click();
      await page.locator('#modeToggleBtn').click();
      await page.waitForTimeout(500);
      await page.locator('#slideOrderToggleBtn').click();
      await page.waitForSelector('#customOverview:not([hidden])');
      await page.waitForFunction(() => [...document.querySelectorAll('.custom-overview-thumb')].every(thumb => thumb.dataset.thumbnailReady === 'true'));
      const snapshot = await page.locator('.custom-overview-snapshot').first().evaluate(img => ({ jpeg: img.src.startsWith('data:image/jpeg'), width: img.naturalWidth, height: img.naturalHeight }));
      assert.equal(snapshot.jpeg, true); assert.equal(snapshot.width, 640); assert.equal(snapshot.height, 360);
      await page.locator('#slideOrderToggleBtn').click();
      await page.waitForTimeout(500);
      const point = await page.evaluate(() => { const el = document.querySelector('#fabric-s1'); const rect = el.getBoundingClientRect(); const scale = rect.width / 1640; return { x: rect.left + (180 + 440) * scale, y: rect.top + (180 + 245) * scale }; });
      await page.mouse.dblclick(point.x, point.y);
      await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA');
      await page.keyboard.press('Control+A'); await page.keyboard.type('Editable text remains sharp');
      await page.locator('#modeToggleBtn').click();
      await page.waitForTimeout(600);
      const stored = await page.evaluate(async () => { const value = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'); return value.groups[0].slides[0].canvas.objects[0]; });
      assert.equal(stored.text, 'Editable text remains sharp');
      assert.equal(stored.left, 400); assert.equal(stored.top, 220); assert.equal(stored.fontSize, 48);
      await page.setViewportSize({ width: 1280, height: 720 });
      const resized = await density(); assert.ok(resized.pixelsPerScreenPixel >= 0.99); assert.ok(resized.width <= normal.width);
      await page.reload(); await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
      const reloaded = await page.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].canvas.objects[0]);
      assert.equal(reloaded.text, stored.text); assert.equal(reloaded.left, stored.left); assert.equal(reloaded.top, stored.top);
      assert.deepEqual(errors, []);
      console.log(`DPR ${dpr}: pixels per display pixel normal=${normal.pixelsPerScreenPixel.toFixed(3)}, 200%=${zoomed.pixelsPerScreenPixel.toFixed(3)}; editing and reload preserved`);
      await page.close();
    }
  } finally { if (browser) await browser.close(); server.kill(); }
});
