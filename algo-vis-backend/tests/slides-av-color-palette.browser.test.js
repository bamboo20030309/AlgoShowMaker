/**
 * 測試模組：slides-av-color-palette.browser.test
 *
 * 驗證重點：slides av color palette.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('slide color picker offers AV colors and saves transparent and opaque swatches', { timeout: 120000 }, async () => {
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
    const widget = { id: 'array', type: 'structure', structureMode: 'normal', content: '0, 0, 0', x: 180, y: 140, w: 500, h: 150, structureFrameVersion: 4 };
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget,
      { id: 'old-table', type: 'table', tableData: [['A','B'],['1','2']], content: 'A | B\n1 | 2', x: 650, y: 430, w: 380, h: 160, tableHeaderRow: false, tableBodyFill: '#abcdef' },
      { id: 'old-tree', type: 'structure', structureMode: 'binary_tree', content: '1,2,3', x: 830, y: 60, w: 270, h: 200, frameBackgroundEnabled: false, textColor: '#123456' }
    ] }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(value => {
      if (sessionStorage.getItem('av-palette-fixture-installed')) return;
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value));
      localStorage.setItem('asm_slide_last_picked_color_v1', '#abcdef');
      sessionStorage.setItem('av-palette-fixture-installed', '1');
    }, deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const object = page.locator('[data-widget-id="array"]');
    await object.click();
    if (!(await page.locator('#structureLengthInput').isVisible())) {
      await page.locator('#modeToggleBtn').click();
      await object.click();
    }
    const toolbar = page.locator('#structureContextMenu');
    const selectCellStyle = async (index, style) => {
      if (await page.locator('#iroPopup').isVisible()) {
        await page.mouse.move(10, 10);
        await page.locator('#iroPopup').waitFor({ state: 'hidden' });
      }
      const box = await object.locator(`[data-structure-item-index="${index}"] > text`).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      // Switching cells consumes the first click; reopen the style toolbar on the selected cell.
      await page.waitForTimeout(300);
      if (!(await toolbar.isVisible())) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector('#structureContextMenu.structure-cell-style-toolbar');
      await toolbar.getByRole('button', { name: style, exact: true }).click();
      await page.mouse.move(10, 10);
      await toolbar.getByRole('button', { name: style, exact: true }).hover();
    };
    await selectCellStyle(0, 'Highlight');
    assert.equal(await toolbar.getByRole('button',{name:'Highlight',exact:true}).locator('.structure-style-icon').evaluate(icon=>icon.style.getPropertyValue('--style-color')),'#ff0000','unselected style uses its own default, not the legacy global color');
    const palette = page.locator('#avColorSwatches');
    const colors = await page.evaluate(() => window.ASMArrowModel.COLORS);
    assert.deepEqual(await palette.locator('[data-av-color]').evaluateAll(buttons => buttons.map(button => button.dataset.avColor)), Object.keys(colors));
    assert.equal((await palette.innerText()).trim(), '', 'common colors show swatches without labels');
    assert.equal(await palette.locator('[title]').count(), 0, 'hover does not expose internal color names');
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/slides-av-color-palette.png') });
    await palette.locator('[data-av-color="AV_red"]').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    const savedWidget = () => page.evaluate(async () => {
      const saved = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return saved.groups[0].slides[0].widgets[0];
    });
    assert.equal((await savedWidget()).cellStyles['0'].highlight, colors.AV_red);
    await selectCellStyle(0, 'Focus');
    assert.equal((await savedWidget()).cellStyles['0'].focus, '#808080', 'Focus has its own unchosen default');
    await palette.locator('[data-av-color="AV_blue"]').click();
    await selectCellStyle(0, 'Point');
    assert.equal((await savedWidget()).cellStyles['0'].point, '#ff0000', 'Point does not inherit Focus');
    await palette.locator('[data-av-color="AV_yellow"]').click();
    await selectCellStyle(1, 'Highlight');
    assert.equal((await savedWidget()).cellStyles['1'].highlight, colors.AV_red, 'Highlight retains red after Focus and Point change');
    await palette.locator('[data-av-color="AV_node_green"]').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const saved = await savedWidget();
    assert.equal(saved.cellStyles['0'].focus, colors.AV_blue);
    assert.equal(saved.cellStyles['0'].point, colors.AV_yellow);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('asm_slide_style_colors_v1'))), {highlight: colors.AV_node_green, focus: colors.AV_blue, point: colors.AV_yellow}, 'independent preferences survive reload');
    assert.equal(saved.cellStyles['0'].highlight, colors.AV_red);
    assert.equal(saved.cellStyles['1'].highlight, colors.AV_node_green);
    assert.equal(saved.highlightColor, '#ff0000');
    // Opening on another old cell must retain its current color, while the
    // recent swatch survives reload and applies the remembered color explicitly.
    await object.click();
    await selectCellStyle(2, 'Highlight');
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    assert.equal((await savedWidget()).cellStyles['2'].highlight, colors.AV_node_green, 'new style immediately inherits last picked color after reload');
    const history = page.locator('#customColorSwatches');
    assert.equal(await history.locator('button').count(), 0, 'AV aliases are not duplicated into custom history');
    await page.locator('#iroPicker .IroBox').first().click({ position: { x: 91, y: 37 } });
    await page.waitForFunction(() => document.querySelectorAll('#customColorSwatches button').length === 1);
    const remembered = await page.evaluate(() => localStorage.getItem('asm_slide_last_picked_color_v1'));
    const expected = await page.evaluate(value => new iro.Color(value).hexString, remembered);
    await selectCellStyle(2, 'Highlight'); // Disable the active style to preview the next default.
    const highlight = toolbar.getByRole('button', { name: 'Highlight', exact: true });
    assert.equal(await highlight.getAttribute('aria-pressed'), 'false');
    assert.equal(await highlight.locator('.structure-style-icon').evaluate(icon => icon.style.getPropertyValue('--style-color')), expected);
    await highlight.click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    assert.equal((await savedWidget()).cellStyles['2'].highlight, expected, 'button applies the color it previews');
    assert.equal((await savedWidget()).cellStyles['0'].highlight, colors.AV_red, 'existing colors remain intact');
    await page.mouse.move(10, 10); await highlight.hover(); await history.locator('button').first().click();
    assert.equal(await history.locator('button').count(), 1, 'reusing a custom color does not duplicate it');
    await page.mouse.click(1550, 950);
    await page.locator('[data-tool="text"]').click(); await page.locator('#textColorBtn').click(); await page.mouse.move(10,10); await page.locator('#textColorBtn').hover();
    await history.locator('button').first().click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    const fill = await page.evaluate(async () => {
      const deck = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return deck.groups[0].slides[0].canvas.objects.at(-1).fill;
    });
    assert.equal(fill, remembered, 'text can reuse saved custom colors');
    await page.locator('#bgColorBtn').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    const background = await page.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].canvas.objects.at(-1).textBackgroundColor);
    assert.equal(background, remembered, 'text background applies the same remembered color');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const firstCell = await object.locator('[data-structure-item-index="0"] > text').boundingBox();
    await page.mouse.click(firstCell.x + firstCell.width / 2, firstCell.y + firstCell.height / 2);
    await selectCellStyle(0, 'Focus');
    assert.equal(await history.locator('button').count(), 1, 'custom history persists after reload');
    assert.equal(await toolbar.getByRole('button',{name:'Focus',exact:true}).locator('.structure-style-icon').evaluate(icon=>icon.style.getPropertyValue('--style-color')), colors.AV_blue, 'disabled Focus previews its own memory');
    assert.equal(await toolbar.getByRole('button',{name:'Mark',exact:true}).locator('.structure-style-icon').evaluate(icon=>icon.style.getPropertyValue('--style-color')), '#22c55e', 'unchosen Mark previews its own default');
    await page.screenshot({path:path.join(root,'test-results/style-color-memory.png')});
    assert.equal((await savedWidget()).cellStyles['0'].highlight, colors.AV_red);
    await page.mouse.click(1550,950);
    { const cell = await page.locator('[data-widget-id="old-table"] [data-structure-item-index] > text').first().boundingBox(); await page.mouse.click(cell.x+cell.width/2,cell.y+cell.height/2); }
    await page.locator('#tableTextColorInput').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    await page.mouse.move(10,10); await page.locator('#iroPopup').waitFor({ state: 'hidden' });
    { const cell = await page.locator('[data-widget-id="old-tree"] [data-structure-item-index] > text').first().boundingBox(); await page.mouse.click(cell.x+cell.width/2,cell.y+cell.height/2); }
    await page.locator('#structureTreeArrowColorInput').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const persisted = await page.evaluate(async () => (await ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].widgets);
    const table = persisted.find(w=>w.id==='old-table'), tree = persisted.find(w=>w.id==='old-tree');
    assert.equal(table.tableTextColor, expected, 'table color button applies remembered color');
    assert.equal(table.tableBodyFill, '#abcdef'); assert.equal(table.tableHeaderRow, false);
    assert.equal(tree.treeArrowColor, expected, 'tree arrow shares remembered color');
    assert.equal(tree.textColor, '#123456'); assert.equal(tree.frameBackgroundEnabled, false);
    { const cell = await page.locator('[data-widget-id="old-tree"] [data-structure-item-index] > text').first().boundingBox(); await page.mouse.click(cell.x+cell.width/2,cell.y+cell.height/2); }
    await page.locator('#structureTreeArrowColorInput').hover();
    assert.equal((await palette.innerText()).trim(), '', 'tree arrow picker shows only color chips');
    assert.equal(await palette.locator('[title]').count(), 0, 'tree color picker does not expose alias names');
    await page.screenshot({path:path.join(root,'test-results/tree-color-picker-current.png')});
    await page.mouse.click(1550,950);
    await page.addScriptTag({url: base+'/trace-color-picker.js'});
    await page.evaluate(() => {
      const button=ASMTraceColorPicker.create('#112233');button.id='test-trace-color';button.style.cssText='position:fixed;top:20px;right:20px;z-index:10000';document.body.append(button);
      window.traceColorEvents=[];button.addEventListener('change',()=>traceColorEvents.push(button.value));
    });
    await page.locator('#test-trace-color').click();
    assert.equal(await page.locator('#test-trace-color').evaluate(b=>b.value),expected);
    assert.equal(await page.evaluate(()=>traceColorEvents.length),1);
    await page.mouse.move(10,10); await page.locator('#test-trace-color').hover();
    assert.ok(await page.locator('.trace-iro-popup .asm-shared-color-swatch').count()>1);
    assert.equal((await page.locator('.trace-iro-popup .asm-shared-color-swatch').allTextContents()).join(''),'');
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
