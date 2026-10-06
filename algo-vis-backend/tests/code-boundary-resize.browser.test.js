const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('code selection handles resize boundaries without changing text size, including saved legacy widgets',
  { timeout: 60000 }, async t => {
    const { base } = await startIsolatedServer(t);
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    t.after(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript',
      body: `const fixtureLoad = fabric.Canvas.prototype.loadFromJSON;
        fabric.Canvas.prototype.loadFromJSON = function(...args) {
          window.fixtureCanvas = this; return fixtureLoad.apply(this, args);
        };\n` + fs.readFileSync(path.join(__dirname, '../public/slides.js'), 'utf8') }));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('fixture')) return;
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'g', slides: [{
        id: 's', canvas: { objects: [] }, widgets: [{ id: 'legacy-code', type: 'code',
          content: 'int answer = 42;\nreturn answer;', language: 'cpp', x: 180, y: 160,
          w: 420, h: 200, fontSize: 23, showLineNumbers: false, scale: 1.4 }]
      }] }] }));
      sessionStorage.setItem('fixture', '1');
    });
    const ready = () => page.waitForFunction(() => window.fixtureCanvas && Reveal.isReady()
      && document.body.dataset.fabricBuild?.startsWith('ready'));
    const saved = id => page.evaluate(async id => (await ASMSlideStorage.create(indexedDB, localStorage)
      .loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].widgets.find(w => w.id === id), id);
    const appearance = id => page.locator(`[data-widget-id="${id}"] code`).evaluate(el => ({
      fontSize: getComputedStyle(el).fontSize, lineHeight: getComputedStyle(el).lineHeight,
      transform: getComputedStyle(el).transform, text: el.textContent
    }));
    const resize = async (id, corner, dx, dy) => {
      await page.locator(`[data-widget-id="${id}"]`).click({ position: { x: 30, y: 30 } });
      const point = await page.evaluate(corner => {
        const c = fixtureCanvas.__asmSelectionControls, active = c.getActiveObject(); active.setCoords();
        const p = active.oCoords[corner], rect = c.upperCanvasEl.getBoundingClientRect();
        return { x: rect.x + p.x * rect.width / c.width, y: rect.y + p.y * rect.height / c.height };
      }, corner);
      await page.mouse.move(point.x, point.y); await page.mouse.down();
      await page.mouse.move(point.x + dx, point.y + dy, { steps: 8 }); await page.mouse.up();
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    };
    await page.goto(base + '/slides.html'); await ready();
    if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    const verify = async id => {
      const before = await saved(id), look = await appearance(id);
      await resize(id, 'br', 65, 40);
      const grown = await saved(id);
      assert.ok(grown.w > before.w && grown.h > before.h, 'corner changes the container dimensions');
      assert.equal(grown.fontSize, before.fontSize, 'resizing must preserve the authored font size');
      assert.equal(grown.scale, before.scale); assert.equal(grown.showLineNumbers, before.showLineNumbers);
      assert.equal(grown.content, before.content); assert.equal(grown.manualSize, true);
      assert.deepEqual(await appearance(id), look, 'rendered code stays at its original size');
      await resize(id, 'mr', -35, 0);
      assert.ok((await saved(id)).w < grown.w, 'side handle can shrink the boundary');
      assert.deepEqual(await appearance(id), look);
      return await saved(id);
    };
    const legacy = await verify('legacy-code');
    await page.locator('#exitCodeEditorBtn').click();
    await page.locator('[data-tool="code"]').click();
    await page.waitForFunction(() => document.querySelectorAll('.slide-widget[data-type="code"]').length === 2
      || document.querySelectorAll('.slide-widget code').length === 2);
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
    const newId = await page.locator('.slide-widget').filter({ has: page.locator('code') }).last().getAttribute('data-widget-id');
    const created = await verify(newId);
    await page.reload(); await ready();
    assert.deepEqual(await saved('legacy-code'), legacy);
    assert.deepEqual(await saved(newId), created);
    assert.equal((await appearance('legacy-code')).fontSize, '23px');
    assert.deepEqual(errors, []);
  });
