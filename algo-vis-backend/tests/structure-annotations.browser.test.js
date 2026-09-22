const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('structure annotations follow indices, persist and retain custom colors', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const widget = { id: 'structure', type: 'structure', structureMode: 'normal', content: '10,20,30,40', annotationIndices: '1', x: 180, y: 140, w: 600, h: 260 };
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget] }] }] };
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.stack || error.message));
    await page.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), deck);
    await page.goto(base + '/slides.html');
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const structureMenu = page.locator('#structureContextMenu');
    assert.equal(await structureMenu.getAttribute('hidden'), '');
    assert.equal(await structureMenu.evaluate(element => getComputedStyle(element).display), 'none');
    const object = page.locator('[data-widget-id="structure"]');
    const annotations = () => object.locator('[data-structure-annotation-index]').evaluateAll(items => items.map(item => item.dataset.structureAnnotationIndex));
    const savedWidget = () => page.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].widgets[0]);
    assert.deepEqual(await annotations(), ['1']);
    assert.equal(await object.locator('[data-structure-annotation-index] > path').first().getAttribute('stroke'), '#ffffff');
    await object.click();
    if (!(await page.locator('#structureLengthInput').isVisible())) { await page.locator('#modeToggleBtn').click(); await object.click(); }
    assert.equal(await page.locator('#structureEditorPanel .structure-style-list').count(), 0);
    assert.equal(await page.locator('#structureHighlightIndicesInput, #structureAnnotationIndicesInput').count(), 0);
    const geometry = await object.locator('svg').evaluate(svg => {
      const view = svg.viewBox.baseVal;
      return [...svg.querySelectorAll('[data-structure-annotation-index]')].every(marker => { const box = marker.getBBox(); return box.y >= view.y && box.y + box.height <= view.y + view.height; });
    });
    assert.equal(geometry, true);
    await page.locator('#structureAnnotationTextInput').fill('i');
    assert.equal(await object.locator('[data-structure-annotation-index="1"] text').textContent(), 'i');
    const defaults = await savedWidget();
    assert.deepEqual(
      [defaults.highlightColor, defaults.focusColor, defaults.pointColor, defaults.markColor],
      ['#ff0000', '#808080', '#ff0000', '#22c55e']
    );
    async function selectCell(index) {
      await object.locator(`[data-structure-item-index="${index}"] > text`).click();
      await page.waitForSelector('#structureContextMenu.structure-cell-style-toolbar');
    }
    await selectCell(0);
    const toolbar = page.locator('#structureContextMenu');
    await toolbar.getByRole('button', { name: 'Highlight', exact: true }).click();
    assert.equal((await savedWidget()).highlightIndices, '0');
    assert.equal(await page.locator('#iroPopup').isVisible(), true);
    assert.equal(await toolbar.locator('[data-structure-style-type]').count(), 6);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/structure-cell-style-color-picker.png') });
    await page.locator('#avColorSwatches [data-av-color="AV_blue"]').click();
    let styled = await savedWidget();
    assert.equal(styled.highlightColor, '#ff0000');
    assert.equal(styled.cellStyles['0'].highlight, 'rgba(144, 202, 249, 0.6)');
    await selectCell(2);
    await toolbar.getByRole('button', { name: 'Highlight', exact: true }).click();
    await page.locator('#avColorSwatches [data-av-color="AV_yellow"]').click();
    styled = await savedWidget();
    assert.equal(styled.highlightIndices, '0,2');
    assert.equal(styled.cellStyles['0'].highlight, 'rgba(144, 202, 249, 0.6)');
    assert.equal(styled.cellStyles['2'].highlight, 'rgba(252, 255, 64, 0.46)');
    const highlightColors = await object.locator('.highlight-blink').evaluateAll(items => Object.fromEntries(items.map(item => [
      item.id.match(/-(\d+)$/)?.[1],
      item.getAttribute('stroke')
    ])));
    assert.equal(highlightColors['0'], styled.cellStyles['0'].highlight);
    assert.equal(highlightColors['2'], styled.cellStyles['2'].highlight);
    await selectCell(0);
    await toolbar.getByRole('button', { name: '註標箭頭', exact: true }).click();
    assert.deepEqual(await annotations(), ['0', '1']);
    assert.equal(await page.locator('#iroPopup').isVisible(), true);
    await page.locator('#iroPicker .IroBox').first().click({ position: { x: 110, y: 35 } });
    const annotationColor = (await savedWidget()).cellStyles['0'].annotation;
    assert.notEqual(annotationColor, '#ffffff');
    assert.equal(await object.locator('[data-structure-annotation-index="0"] > path').getAttribute('stroke'), annotationColor);
    assert.equal(await object.locator('[data-structure-annotation-index="1"] > path').getAttribute('stroke'), '#ffffff');
    await selectCell(0);
    await toolbar.getByRole('button', { name: '清除格子樣式', exact: true }).click();
    assert.deepEqual(await annotations(), ['1']);
    styled = await savedWidget();
    assert.equal(styled.highlightIndices, '2');
    assert.equal(styled.cellStyles['0'], undefined);
    assert.equal(styled.cellStyles['2'].highlight, 'rgba(252, 255, 64, 0.46)');
    await selectCell(2); await toolbar.getByRole('button', { name: 'Mark', exact: true }).click();
    assert.equal((await savedWidget()).markIndices, '2');
    await selectCell(1); await toolbar.getByRole('textbox', { name: '此格註標文字' }).fill('left'); await page.keyboard.press('Enter');
    await selectCell(3); await toolbar.getByRole('button', { name: '註標箭頭', exact: true }).click();
    await selectCell(3); await toolbar.getByRole('textbox', { name: '此格註標文字' }).fill('right'); await page.keyboard.press('Enter');
    assert.equal(await object.locator('[data-structure-annotation-index="1"] text').textContent(), 'left');
    assert.equal(await object.locator('[data-structure-annotation-index="3"] text').textContent(), 'right');
    const toolbarBox = await toolbar.boundingBox();
    const cellBox = await object.locator('[data-structure-item-index="3"] > rect').boundingBox();
    assert.ok(toolbarBox.y + toolbarBox.height < cellBox.y);
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/structure-cell-toolbar.png') });
    await page.locator('#modeToggleBtn').click(); await page.waitForTimeout(600);
    await page.reload(); await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
    assert.deepEqual(await annotations(), ['1', '3']);
    const saved = await savedWidget();
    assert.equal(saved.annotationIndices, '1,3');
    assert.equal(saved.annotationText, 'i');
    assert.deepEqual(saved.annotationLabels, { 1: 'left', 3: 'right' });
    assert.equal(saved.cellStyles['2'].highlight, 'rgba(252, 255, 64, 0.46)');
    assert.equal(saved.cellStyles['2'].mark, '#22c55e');
    assert.equal(await object.locator('#highlight-Array-2').getAttribute('stroke'), saved.cellStyles['2'].highlight);
    assert.equal(await object.locator('[data-structure-annotation-index="1"] text').textContent(), 'left');
    assert.equal(saved.annotationColor, '#ffffff');
    assert.equal(await object.locator('[data-structure-annotation-index="1"] > path').getAttribute('stroke'), '#ffffff');
    const custom = await page.evaluate(widget => {
      const svg = AlgoStructureRenderer.createSvg({ ...widget, highlightColor: '#123456', highlightIndices: '0' });
      return svg.querySelector('.highlight-blink').getAttribute('stroke');
    }, widget);
    assert.equal(custom, '#123456');
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/structure-annotations.png') });
    const canvasDraw = await page.evaluate(async widget => {
      const svg = AlgoStructureRenderer.createSvg(widget);
      const parsed = new DOMParser().parseFromString(new XMLSerializer().serializeToString(svg), 'image/svg+xml');
      await AlgoStructureRenderer.drawCanvas(document.createElement('canvas').getContext('2d'), widget);
      return !parsed.querySelector('parsererror');
    }, widget);
    assert.equal(canvasDraw, true);
    const otherModes = await page.evaluate(widget => ['matrix', 'binary_tree', 'heap'].map(structureMode => {
      const svg = AlgoStructureRenderer.createSvg({ ...widget, structureMode, content: structureMode === 'matrix' ? '10,20;30,40' : '10,20,30,40', annotationIndices: '2' });
      return [...svg.querySelectorAll('[data-structure-annotation-index]')].map(item => item.dataset.structureAnnotationIndex);
    }), widget);
    assert.deepEqual(otherModes, [['2'], ['2'], ['2']]);
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
