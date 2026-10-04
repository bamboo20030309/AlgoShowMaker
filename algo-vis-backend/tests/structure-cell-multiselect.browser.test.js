const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('Shift ranges and Ctrl toggles apply styles/colors in one edit and preserve old settings on reopen',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await new Promise(resolve => {
      const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => {
        const port = probe.address().port; probe.close(() => resolve(port));
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
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [] }, widgets: [
        { id: 'array', type: 'structure', structureMode: 'normal', content: '1,2,3,4,5,6',
          x: 160, y: 140, w: 600, h: 130, structureFrameVersion: 4,
          highlightColor: '#123456', frameBackgroundEnabled: false },
        { id: 'matrix', type: 'structure', structureMode: 'matrix', content: '1,2,3\n4,5,6\n7,8,9',
          x: 160, y: 350, w: 360, h: 200, structureFrameVersion: 4 },
        { id: 'tree', type: 'structure', structureMode: 'binary_tree', content: '1,2,3,4,5,6,7',
          x: 720, y: 350, w: 360, h: 230, structureFrameVersion: 4 }
      ] }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
        sessionStorage.setItem('fixture', '1');
      }, deck);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      const widget = id => page.locator(`.structure-widget[data-widget-id="${id}"]`);
      const cell = (id, index) => widget(id).locator(`[data-structure-item-index="${index}"] > text`).first();
      const selected = id => widget(id).locator('.is-structure-cell-selected').evaluateAll(cells =>
        cells.map(cell => Number(cell.dataset.structureItemIndex)).sort((a, b) => a - b));
      const saved = async id => page.evaluate(async id => {
        const deck = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
        return deck.groups[0].slides[0].widgets.find(widget => widget.id === id);
      }, id);
      const settled = () => page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const toolbar = page.locator('#structureContextMenu');
      await widget('array').click();
      await cell('array', 1).click();
      await cell('array', 4).click({ modifiers: ['Shift'] });
      assert.deepEqual(await selected('array'), [1, 2, 3, 4]);
      assert.equal(await page.locator('.asm-structure-cell-selection-box:not([hidden])').count(), 4);
      await toolbar.getByRole('button', { name: 'Highlight', exact: true }).click();
      await toolbar.getByRole('button', { name: 'Highlight', exact: true }).hover();
      await page.locator('[data-av-color="AV_red"]').click();
      await settled();
      const red = await page.evaluate(() => ASMArrowModel.COLORS.AV_red);
      let array = await saved('array');
      assert.equal(array.highlightIndices, '1,2,3,4');
      for (const index of [1, 2, 3, 4]) assert.equal(array.cellStyles[index].highlight, red);
      await page.mouse.move(10, 950);
      await page.waitForFunction(() => document.querySelector('#iroPopup').hidden);
      await cell('array', 2).click({ modifiers: ['Control'] });
      await cell('array', 0).click({ modifiers: ['Control'] });
      assert.deepEqual(await selected('array'), [0, 1, 3, 4]);
      await toolbar.getByRole('button', { name: 'Focus', exact: true }).click();
      await settled();
      assert.equal((await saved('array')).focusIndices, '0,1,3,4');
      await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
      await page.keyboard.press('Control+z'); await settled();
      assert.equal((await saved('array')).focusIndices, '');
      await page.keyboard.press('Control+y'); await settled();
      assert.equal((await saved('array')).focusIndices, '0,1,3,4');
      await cell('array', 2).dblclick({ modifiers: ['Control'] });
      assert.deepEqual(await selected('array'), [0, 1, 3, 4]);
      assert.equal(await page.locator('.structure-inline-value-input').count(), 0);
      assert.equal(await toolbar.getByRole('button', { name: 'Highlight', exact: true }).getAttribute('aria-pressed'), 'mixed');
      await toolbar.getByRole('button', { name: 'Highlight', exact: true }).click(); await settled();
      array = await saved('array');
      assert.equal(array.highlightIndices, '0,1,2,3,4');
      assert.equal(new Set([0,1,3,4].map(index => array.cellStyles[index].highlight)).size, 1);
      await toolbar.getByRole('button', { name: '清除格子樣式', exact: true }).click();
      await settled();
      array = await saved('array');
      assert.equal(array.highlightIndices, '2');
      assert.equal(array.cellStyles[2].highlight, red);
      assert.equal(array.highlightColor, '#123456');
      assert.equal(array.frameBackgroundEnabled, false);
      await widget('matrix').click();
      await cell('matrix', 1).click();
      await cell('matrix', 8).click({ modifiers: ['Shift'] });
      assert.deepEqual(await selected('matrix'), [1, 2, 4, 5, 7, 8]);
      await toolbar.getByRole('button', { name: 'Mark', exact: true }).click(); await settled();
      assert.equal((await saved('matrix')).markIndices, '1,2,4,5,7,8');
      await widget('tree').click();
      const treeCells = widget('tree').locator('[data-structure-item-index] > text');
      await treeCells.nth(0).click();
      await treeCells.nth(3).click({ modifiers: ['Shift'] });
      const treeIndices = await widget('tree').locator('.is-structure-cell-selected').evaluateAll(cells =>
        cells.map(cell => Number(cell.closest('[data-tree-index]')?.dataset.treeIndex ?? cell.dataset.structureItemIndex)).sort((a,b) => a-b));
      assert.equal(treeIndices.length, 4);
      await toolbar.getByRole('button', { name: 'Point', exact: true }).click(); await settled();
      assert.equal((await saved('tree')).pointIndices, treeIndices.join(','));
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
      assert.equal((await saved('matrix')).markIndices, '1,2,4,5,7,8');
      assert.equal((await saved('array')).highlightColor, '#123456');
      assert.equal((await saved('array')).frameBackgroundEnabled, false);
      assert.equal((await saved('tree')).pointIndices, treeIndices.join(','));
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
