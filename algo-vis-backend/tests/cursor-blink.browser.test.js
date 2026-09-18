const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('text cursor blinks with binary opacity and stops after editing', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [{ type: 'textbox', text: 'Cursor blink', left: 400, top: 220, width: 600, fontSize: 48 }] }, widgets: [] }] }] };
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), deck);
    await page.goto(base + '/slides.html'); await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    await page.evaluate(() => {
      window.cursorSamples = [];
      const original = fabric.IText.prototype.renderCursorOrSelection;
      fabric.IText.prototype.renderCursorOrSelection = function (...args) {
        if (this.isEditing && this.selectionStart === this.selectionEnd) { window.cursorText = this; window.cursorSamples.push({ opacity: this._currentCursorOpacity, time: performance.now() }); }
        return original.apply(this, args);
      };
    });
    const point = await page.evaluate(() => { const rect = document.querySelector('#fabric-s1').getBoundingClientRect(); const scale = rect.width / 1640; return { x: rect.left + 620 * scale, y: rect.top + 425 * scale }; });
    await page.mouse.dblclick(point.x, point.y); await page.keyboard.press('End');
    await page.waitForTimeout(1600);
    const samples = await page.evaluate(() => window.cursorSamples);
    assert.ok(samples.some(sample => sample.opacity === 0)); assert.ok(samples.some(sample => sample.opacity === 1));
    assert.ok(samples.every(sample => sample.opacity === 0 || sample.opacity === 1));
    const transitions = samples.filter((sample, index) => index === 0 || sample.opacity !== samples[index - 1].opacity);
    assert.ok(transitions.length >= 3);
    for (let i = 2; i < transitions.length; i++) assert.ok(transitions[i].time - transitions[i - 1].time >= 450, 'each blink phase holds instead of flashing rapidly');
    await page.keyboard.type('!'); assert.equal(await page.evaluate(() => window.cursorText._currentCursorOpacity), 1);
    await page.locator('#modeToggleBtn').click();
    assert.equal(await page.evaluate(() => window.cursorText.isEditing), false);
    const count = await page.evaluate(() => window.cursorSamples.length); await page.waitForTimeout(650);
    assert.equal(await page.evaluate(() => window.cursorSamples.length), count);
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
