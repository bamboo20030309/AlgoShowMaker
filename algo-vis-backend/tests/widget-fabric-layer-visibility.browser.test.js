const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('adding Fabric objects never lifts old backgrounds over structure, LaTeX and code',
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
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      if (process.env.ASM_TEST_DISABLE_SPLIT === '1') await page.route('**/slide-fabric-layers.js?*', route =>
        route.fulfill({ contentType: 'application/javascript', body: 'window.ASMSlideFabricLayers = { install() {} };' }));
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [
        { type: 'rect', left: 0, top: 0, width: 1280, height: 720, fill: '#ffffff', layerIndex: 1000 }
      ] }, widgets: [
        { id: 'array', type: 'structure', structureMode: 'normal', content: '1,2,3',
          x: 100, y: 80, w: 300, h: 100, layerIndex: 2000, baseFill: '#00ff00', structureFrameVersion: 4 },
        { id: 'formula', type: 'latex', content: 'x^2 + y^2', x: 750, y: 80, w: 280, h: 90, layerIndex: 2010 },
        { id: 'code', type: 'code', content: 'int value = 42;', language: 'cpp',
          x: 100, y: 480, w: 340, h: 100, layerIndex: 2020 }
      ] }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
      await page.waitForSelector('[data-widget-id="formula"] .katex');
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      const snapshot = async id => {
        const buffer = await page.locator(`.slide-widget[data-widget-id="${id}"]`).screenshot();
        return page.evaluate(async url => {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
          const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
          let green = 0, dark = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] < 100 && pixels[i + 1] > 200 && pixels[i + 2] < 100) green++;
            if (pixels[i] < 100 && pixels[i + 1] < 100 && pixels[i + 2] < 100) dark++;
          }
          return { green, dark };
        }, 'data:image/png;base64,' + buffer.toString('base64'));
      };
      const before = {};
      for (const id of ['array', 'formula', 'code']) { before[id] = await snapshot(id); assert.ok(before[id].dark > 0, id + ' is visible initially'); }
      await page.locator('[data-tool="text"]').click();
      await page.waitForFunction(() => document.body.dataset.lastToolStatus === 'added:text');
      await page.mouse.move(10, 950);
      for (const id of ['array', 'formula', 'code']) {
        const painted = await snapshot(id);
        assert.ok(painted.dark > 0, `${id} must remain visibly rendered after adding text: ${JSON.stringify(painted)}`);
      }
      await page.mouse.click(1550, 950);
      await page.locator('#shapeMenuBtn').click();
      await page.locator('#shapeMenu [data-shape="circle"]').click();
      await page.waitForFunction(() => document.body.dataset.lastToolStatus === 'added:circle');
      for (const id of ['array', 'formula', 'code']) {
        const painted = await snapshot(id);
        assert.ok(painted.dark > 0, `${id} stays painted after adding a shape`);
      }
      // The transparent foreground must not steal clicks from visible SVG cells.
      const clickCell = async index => {
        const box = await page.locator(`[data-widget-id="array"] [data-structure-item-index="${index}"] > text`).first().boundingBox();
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      };
      await clickCell(0); await clickCell(0);
      await page.keyboard.down('Shift'); await clickCell(2); await page.keyboard.up('Shift');
      assert.equal(await page.locator('[data-widget-id="array"] .is-structure-cell-selected').count(), 3);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const saved = await page.evaluate(async () => ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
      assert.deepEqual(saved.groups[0].slides[0].widgets.map(widget => widget.id), ['array', 'formula', 'code']);
      assert.equal(saved.groups[0].slides[0].canvas.objects[0].layerIndex, 1000);
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
      await page.waitForSelector('[data-widget-id="formula"] .katex');
      for (const id of ['array', 'formula', 'code']) {
        const painted = await snapshot(id);
        assert.ok(painted.dark > 0, `${id} stays painted after reopening`);
      }
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });


