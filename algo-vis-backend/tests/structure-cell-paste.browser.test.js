const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('plain text pastes directly into a selected structure cell and preserves dimensions',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await new Promise(resolve => {
      const server = net.createServer(); server.listen(0, '127.0.0.1', () => {
        const port = server.address().port; server.close(() => resolve(port));
      });
    });
    const server = spawn(process.execPath, ['server.js'], { cwd: root, windowsHide: true, stdio: 'ignore',
      env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1' } });
    let browser;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      browser = await chromium.launch({ headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const widgets = ['normal', 'matrix', 'binary_tree'].map((mode, i) => ({
        id: mode, type: 'structure', structureMode: mode,
        content: mode === 'matrix' ? '1,2;3,4' : '1,2,3', x: 60 + i * 390, y: 110,
        w: 325.5, h: 240.25, structureFrameVersion: 4, frameBackgroundEnabled: false,
        highlightColor: '#123456'
      }));
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', widgets, canvas: { objects: [] } }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      const ready = () => page.waitForFunction(() => Reveal.isReady() && document.body.dataset.fabricBuild?.startsWith('ready'));
      const saved = id => page.evaluate(async id => {
        const deck = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
        return deck.groups[0].slides[0].widgets.find(widget => widget.id === id);
      }, id);
      const dimensions = widget => ({ x: widget.x, y: widget.y, w: widget.w, h: widget.h });
      await page.goto(base + '/slides.html'); await ready();
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const exercise = async id => {
        const object = page.locator(`[data-widget-id="${id}"]`);
        const cell = () => object.locator('[data-structure-item-index] > text').first();
        const before = await saved(id);
        await object.click(); await cell().click();
        assert.equal(await page.locator('.structure-inline-value-input').count(), 0);
        await page.evaluate(() => navigator.clipboard.writeText('9'));
        await page.keyboard.press('Control+v');
        await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        const after = await saved(id);
        assert.deepEqual(dimensions(after), dimensions(before), id + ' changed value retains its box');
        assert.ok(after.content.includes('9'), id + ' commits its new value');
        assert.equal(await page.evaluate(async () => {
          const deck = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
          return deck.groups[0].slides[0].canvas.objects.length;
        }), 0, 'pasting into a cell must not create text objects');
      };
      for (const id of ['normal', 'matrix', 'binary_tree']) await exercise(id);
      await page.mouse.click(1550, 950);
      await page.locator('#structureMenuBtn').click();
      await page.locator('#structureMenu [data-structure-mode="binary_tree"]').click();
      await page.waitForFunction(() => document.querySelectorAll('.structure-widget').length === 4);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const newId = await page.locator('.structure-widget').last().getAttribute('data-widget-id');
      await page.mouse.click(1550, 950); await exercise(newId);
      await page.reload(); await ready();
      for (const id of ['normal', 'matrix', 'binary_tree']) {
        const widget = await saved(id);
        assert.deepEqual(dimensions(widget), dimensions(widgets.find(w => w.id === id)));
        assert.equal(widget.frameBackgroundEnabled, false); assert.equal(widget.highlightColor, '#123456');
        assert.ok(widget.content.includes('9'));
      }
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });

