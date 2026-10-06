const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('shared cell template supports table selection, direct typing, clipboard, ranges and old settings',
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
      const widgets = ['normal', 'matrix', 'binary_tree', 'table'].map((mode, i) => ({
        id: mode, type: 'structure', structureMode: mode,
        ...(mode === 'table' ? { tableData: [['1','2'],['3','4']], tableHeaderRow: false, tableTextColor: '#123456' } : {}),
        content: mode === 'matrix' ? '1,2;3,4' : '1,2,3', x: mode === 'table' ? 900 : 60 + (i % 2) * 550, y: 70 + Math.floor(i / 2) * 300,
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
        await page.keyboard.type('9');
        assert.equal(await page.locator('.structure-inline-value-input').inputValue(), '9', 'first key replaces the old value');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        const after = await saved(id);
        assert.deepEqual(dimensions(after), dimensions(before), id + ' changed value retains its box');
        assert.ok(after.content.includes('9'), id + ' commits its new value');
        assert.equal(await page.evaluate(async () => {
          const deck = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
          return deck.groups[0].slides[0].canvas.objects.length;
        }), 0, 'typing into a cell must not create text objects');
      };
      for (const id of ['normal', 'matrix', 'binary_tree', 'table']) await exercise(id);
      await page.mouse.click(1550, 950);
      await page.locator('[data-tool="table"]').click();
      await page.waitForFunction(() => document.querySelectorAll('.structure-widget').length === 5);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const newId = await page.locator('.structure-widget').last().getAttribute('data-widget-id');
      await page.mouse.click(1550, 950); await exercise(newId);
      await page.reload(); await ready();
      for (const id of ['normal', 'matrix', 'binary_tree', 'table']) {
        const widget = await saved(id);
        assert.deepEqual(dimensions(widget), dimensions(widgets.find(w => w.id === id)));
        if (id === 'table') { assert.equal(widget.tableHeaderRow, false); assert.equal(widget.tableTextColor, '#123456'); }
        else { assert.equal(widget.frameBackgroundEnabled, false); assert.equal(widget.highlightColor, '#123456'); }
        assert.ok(widget.content.includes('9'));
      }
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      const array = page.locator('[data-widget-id="normal"]');
      const cell = array.locator('[data-structure-item-index="0"] > text');
      await array.click(); await cell.click();
      await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Process', keyCode: 229, bubbles: true, cancelable: true
      })));
      await page.waitForSelector('.structure-inline-value-input');
      await page.locator('.structure-inline-value-input').evaluate(input => input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
      await page.keyboard.insertText('中文');
      await page.locator('.structure-inline-value-input').evaluate(input => input.dispatchEvent(new CompositionEvent('compositionend', { data: '中文', bubbles: true })));
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      assert.ok((await saved('normal')).content.includes('中文'));
      await cell.dblclick();
      const range = await page.locator('.structure-inline-value-input').evaluate(input => ({ start: input.selectionStart, end: input.selectionEnd, value: input.value }));
      assert.equal(range.value, '中文'); assert.equal(range.start, range.end, 'double click positions a caret instead of selecting the entire old value');
      await page.keyboard.press('Enter');
      const table = page.locator('[data-widget-id="table"]');
      await page.mouse.click(1550, 950); await table.click();
      await table.locator('[data-structure-item-index="0"] > text').click();
      await table.locator('[data-structure-item-index="3"] > text').click({ modifiers: ['Shift'] });
      assert.equal(await table.locator('.is-structure-cell-selected').count(), 4);
      await table.locator('[data-structure-item-index="1"] > text').click({ modifiers: ['Control'] });
      assert.equal(await table.locator('.is-structure-cell-selected').count(), 3);
      await table.locator('[data-structure-item-index="2"] > text').click();
      await page.evaluate(() => navigator.clipboard.writeText('表格'));
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      assert.equal((await saved('table')).tableData[1][0], '表格');
      assert.equal((await saved('table')).tableHeaderRow, false);
      assert.equal((await saved('table')).tableTextColor, '#123456');
      await page.reload(); await ready();
      assert.equal((await saved('table')).tableData[1][0], '表格');
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
