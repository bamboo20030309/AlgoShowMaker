const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('list changes keep native editing input synchronized', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [{ type: 'textbox', text: 'Alpha', left: 400, top: 220, width: 600, fontSize: 48, fontFamily: 'Arial' }] }, widgets: [] }] }] };
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), deck);
    await page.goto(base + '/slides.html');
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const point = await page.evaluate(() => { const rect = document.querySelector('#fabric-s1').getBoundingClientRect(); const scale = rect.width / 1640; return { x: rect.left + 620 * scale, y: rect.top + 425 * scale }; });
    await page.mouse.dblclick(point.x, point.y);
    await page.waitForFunction(() => document.activeElement?.tagName === 'TEXTAREA');
    const value = () => page.evaluate(() => document.activeElement.value);
    await page.keyboard.press('Control+A');
    await page.locator('#listStyleBtn').click();
    await page.locator('#listStyleBtn').click();
    assert.equal(await value(), '1.\u00a0Alpha');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Backspace');
    assert.equal(await value(), '1.\u00a0Alph');
    await page.keyboard.press('Shift+ArrowLeft');
    await page.keyboard.press('Backspace');
    assert.equal(await value(), '1.\u00a0Alp');
    await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Backspace');
    assert.equal(await value(), '.\u00a0Alp');
    await page.keyboard.press('Control+A'); await page.keyboard.type('Beta');
    await page.keyboard.press('Control+A'); await page.locator('#listStyleBtn').click();
    assert.equal(await value(), '\u2022\u00a0Beta');
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('Backspace');
    assert.equal(await value(), '\u2022\u00a0Bet');
    await page.keyboard.press('Control+A'); await page.locator('#listStyleBtn').click();
    await page.locator('#listStyleBtn').click();
    assert.equal(await value(), 'Bet');
    await page.keyboard.press('ArrowRight'); await page.keyboard.type('a');
    await page.locator('#modeToggleBtn').click(); await page.waitForTimeout(600);
    const storedText = () => page.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].canvas.objects[0].text);
    assert.equal(await storedText(), 'Beta');
    await page.reload(); await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    assert.equal(await storedText(), 'Beta');
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
