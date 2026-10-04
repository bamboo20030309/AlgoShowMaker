const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('old lower-layer text keeps visible selection controls, highlighted text and caret above painted backgrounds',
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
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 },
        permissions: ['clipboard-read', 'clipboard-write'] });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.route('**/slides.js?*', route => route.fulfill({ contentType: 'application/javascript',
        body: `const fixtureLoad = fabric.Canvas.prototype.loadFromJSON;
          fabric.Canvas.prototype.loadFromJSON = function(...args) {
            window.fixtureCanvas = this; return fixtureLoad.apply(this, args);
          };\n` + fs.readFileSync(path.join(root, 'public/slides.js'), 'utf8') }));
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', canvas: { objects: [
        { type: 'rect', left: 0, top: 0, width: 1280, height: 720, fill: '#ffffff', layerIndex: 1000 },
        { type: 'textbox', text: 'Editable text', left: 180, top: 180, width: 400, fontSize: 40,
          fontFamily: 'Arial', fill: '#000000', layerIndex: 1500 }
      ] }, widgets: [{ id: 'array', type: 'structure', content: '1,2,3',
        x: 850, y: 400, w: 300, h: 100, layerIndex: 2000 }] }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      await page.goto(base + '/slides.html');
      await page.waitForFunction(() => fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      const box = await page.evaluate(() => {
        const object = fixtureCanvas.getObjects()[1]; const matrix = fixtureCanvas.viewportTransform;
        const rect = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
        const scale = rect.width / fixtureCanvas.width;
        return { x: rect.x + (object.left + matrix[4]) * scale,
          y: rect.y + (object.top + matrix[5]) * scale, width: object.width * scale, height: object.height * scale };
      });
      const bluePixels = async () => {
        const png = await page.screenshot({ clip: { x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24 } });
        return page.evaluate(async url => {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let count = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 2] > pixels[i] + 25 && pixels[i + 1] > pixels[i] + 25) count++;
          return count;
        }, 'data:image/png;base64,' + png.toString('base64'));
      };
      await page.mouse.click(box.x + 40, box.y + 20);
      assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject()?.text), 'Editable text');
      assert.ok(await bluePixels() > 30, 'selection border must be visible in the composited page');
      await page.mouse.dblclick(box.x + 40, box.y + 20);
      await page.waitForFunction(() => fixtureCanvas.getActiveObject()?.isEditing);
      await page.keyboard.press('Control+a');
      assert.ok(await bluePixels() > 100, 'selected text must have a visible highlight');
      await page.keyboard.type('Updated'); await page.keyboard.press('Backspace');
      assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObject().text), 'Update');
      const cursorPixels = await page.evaluate(() => {
        const object = fixtureCanvas.getActiveObject(); object._currentCursorOpacity = 1; object.renderCursorOrSelection();
        const upper = fixtureCanvas.upperCanvasEl; const overlay = document.querySelector('.asm-fabric-editing-layer');
        const a = upper.getContext('2d').getImageData(0, 0, upper.width, upper.height).data;
        const b = overlay.getContext('2d').getImageData(0, 0, overlay.width, overlay.height).data;
        let cursor = 0, mirrored = 0;
        for (let i = 3; i < a.length; i += 4) if (a[i]) { cursor++; if (b[i]) mirrored++; }
        return { cursor, mirrored };
      });
      assert.ok(cursorPixels.cursor > 0, 'native text caret is painted');
      assert.equal(cursorPixels.mirrored, cursorPixels.cursor, 'all caret pixels reach the visible editing layer');
      await page.mouse.click(1550, 950);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload(); await page.waitForFunction(() => fixtureCanvas?.getObjects().length === 2 && Reveal.isReady());
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[1].text), 'Update');
      assert.equal(await page.evaluate(() => fixtureCanvas.getObjects()[1].layerIndex), 1500);
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });

