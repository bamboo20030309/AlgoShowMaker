const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

for (const [plainOnly, tableVariant] of [[false,false], [true,false], [false,true]]) test(`mixed selection pastes and transforms (${tableVariant ? 'table and LaTeX' : plainOnly ? 'plain-text clipboard bridge' : 'structure and code'})`,
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
        { type: 'textbox', text: 'Styled A', left: 100, top: 80, width: 250, fontSize: 32, fill: '#123456',
          fontFamily: 'Georgia', scaleX: 1.2, scaleY: 0.8, asmInlineScripts: false, layerIndex: 4000, styles: { 0: { 0: { underline: true } } } },
        { type: 'textbox', text: 'Styled B', left: 100, top: 170, width: 250, fontSize: 28,
          fill: '#654321', fontStyle: 'italic', asmInlineScripts: false, layerIndex: 2500 }
      ] }, widgets: [
        { id: 'array', type: tableVariant ? 'table' : 'structure', structureMode: 'normal', content: '1,2,3', x: 500, y: 100,
          w: 250, h: 140, structureFrameVersion: 4, frameBackgroundEnabled: false,
          tableBodyFill: '#aa22cc', highlightIndices: '1', cellStyles: { 1: { highlight: '#aa22cc' } }, layerIndex: 2000 },
        { id: 'code', type: tableVariant ? 'latex' : 'code', content: tableVariant ? String.raw`\(x^2\)` : 'int n = 42;', language: 'cpp', x: 850, y: 350,
          w: 300, h: 200, manualSize: tableVariant, fontSize: 23, showLineNumbers: false, layerIndex: 3000 }
      ] }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      const ready = () => page.waitForFunction(() => fixtureCanvas?.getObjects().length >= 2 && Reveal.isReady());
      const saved = () => page.evaluate(async () => (await ASMSlideStorage.create(indexedDB, localStorage)
        .loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0]);
      await page.goto(base + '/slides.html'); await ready();
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      const host = await page.locator('.fabric-host').boundingBox();
      const click = (x,y) => page.mouse.click(host.x + x * host.width / 1280, host.y + y * host.height / 720);
      await click(130,95);
      await page.keyboard.down('Control');
      await click(520,140); await click(130,185); await click(875,375);
      await page.keyboard.up('Control');
      assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObjects().length), 2, 'both texts remain selected');
      assert.equal(await page.locator('.slide-widget.is-selected').count(), 2, 'structure and code join the same selection');
      assert.equal(await page.locator('#alignmentToolbar').isVisible(), true);
      const group = { boundingBox: () => page.evaluate(() => {
        const c=fixtureCanvas.__asmSelectionControls, b=c.getActiveObject().getBoundingRect(false,true);
        const host=c.upperCanvasEl.getBoundingClientRect();
        return {x:host.x+b.left*host.width/c.width,y:host.y+b.top*host.height/c.height,width:b.width*host.width/c.width,height:b.height*host.height/c.height};
      }) };
      const controlPoint = corner => page.evaluate(corner => {
        const c=fixtureCanvas.__asmSelectionControls, active=c.getActiveObject(); active.setCoords();
        const p=active.oCoords[corner], rect=c.upperCanvasEl.getBoundingClientRect();
        return {x:rect.x+p.x*rect.width/c.width,y:rect.y+p.y*rect.height/c.height};
      },corner);
      const assertGroup = async count => {
        assert.equal(await page.evaluate(() => fixtureCanvas.__asmSelectionControls.getActiveObjects().length), count);
        assert.equal(await page.locator('.asm-group-selection-box').count(),0,'no custom HTML selection box');
        const frame = await group.boundingBox();
        const bounds = await page.evaluate(() => {
          const host = fixtureCanvas.upperCanvasEl.getBoundingClientRect();
          const fabricBounds = fixtureCanvas.getActiveObjects().map(object => {
            const matrix = object.calcTransformMatrix();
            const halfW = (object.width + object.strokeWidth) / 2, halfH = (object.height + object.strokeWidth) / 2;
            const points = [[-halfW,-halfH],[halfW,-halfH],[halfW,halfH],[-halfW,halfH]].map(([x,y]) =>
              fabric.util.transformPoint(new fabric.Point(x,y), matrix));
            const b = fabric.util.makeBoundingBoxFromPoints(points.map(p=>fabric.util.transformPoint(p,fixtureCanvas.viewportTransform)));
            return { x: host.x + b.left * host.width / fixtureCanvas.width, y: host.y + b.top * host.height / fixtureCanvas.height,
              width: b.width * host.width / fixtureCanvas.width, height: b.height * host.height / fixtureCanvas.height };
          });
          const widgets = [...document.querySelectorAll('.slide-widget.is-selected')].map(el => {
            const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height };
          });
          return [...fabricBounds, ...widgets];
        });
        for (const b of bounds) {
          assert.ok(frame.x <= b.x + 1 && frame.y <= b.y + 1, 'group contains selected top-left');
          assert.ok(frame.x + frame.width >= b.x + b.width - 1 && frame.y + frame.height >= b.y + b.height - 1,
            'group contains selected bottom-right');
        }
        return frame;
      };
      const fullFrame = await assertGroup(4);
      const logicalFrame = await page.evaluate(() => fixtureCanvas.__asmSelectionControls.getActiveObject().getBoundingRect(true,true));
      assert.ok(Math.abs(logicalFrame.left - 100) < 2, `absolute selection left: ${JSON.stringify(logicalFrame)}`);
      assert.ok(Math.abs(logicalFrame.top - 80) < 2, `absolute selection top: ${JSON.stringify(logicalFrame)}`);
      await page.keyboard.down('Control'); await click(875,375); await page.keyboard.up('Control');
      const smallerFrame = await assertGroup(3);
      assert.ok(smallerFrame.width < fullFrame.width - 50, 'removing the rightmost code shrinks the frame');
      await page.keyboard.down('Control'); await click(875,375); await page.keyboard.up('Control');
      await assertGroup(4);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const before = await saved();
      await page.keyboard.press('Control+c');
      // Some clipboard bridges preserve plain text but strip custom MIME types.
      if (plainOnly) await page.evaluate(async () => {
        const text = await navigator.clipboard.readText();
        await navigator.clipboard.writeText(text);
      });
      await page.keyboard.press('Control+v');
      await page.waitForFunction(() => fixtureCanvas.getObjects().length === 4 && document.querySelectorAll('.slide-widget').length === 4);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const after = await saved();
      for (let i = 0; i < 2; i++) {
        const source = before.canvas.objects[i], pasted = after.canvas.objects[i + 2];
        for (const field of ['text','left','top','width','scaleX','scaleY','fill','fontSize','fontFamily','fontStyle','asmInlineScripts'])
          assert.deepEqual(pasted[field], source[field] ?? ({ scaleX: 1, scaleY: 1, fontFamily: 'Times New Roman', fontStyle: 'normal' })[field], `text ${i} ${field}`);
        assert.deepEqual(pasted.styles, source.styles || {});
      }
      for (let i = 0; i < 2; i++) {
        const source = before.widgets[i], pasted = after.widgets[i + 2];
        assert.notEqual(pasted.id, source.id);
        for (const field of ['type','content','x','y','w','h','fontSize','showLineNumbers','frameBackgroundEnabled','cellStyles'])
          assert.deepEqual(pasted[field], source[field], `widget ${i} ${field}`);
      }
      const textA = after.canvas.objects[2], textB = after.canvas.objects[3], array = after.widgets[2], code = after.widgets[3];
      assert.ok(array.layerIndex < textB.layerIndex && textB.layerIndex < code.layerIndex && code.layerIndex < textA.layerIndex);
      assert.equal(await page.evaluate(() => fixtureCanvas.getActiveObjects().length), 2);
      assert.equal(await page.locator('.slide-widget.is-selected').count(), 2);
      await assertGroup(4);
      if (!plainOnly) {
        const drag = async (x,y,toX,toY) => {
          await page.mouse.move(host.x + x * host.width / 1280, host.y + y * host.height / 720);
          await page.mouse.down();
          await page.mouse.move(host.x + toX * host.width / 1280, host.y + toY * host.height / 720, {steps: 5});
          await page.mouse.up();
          await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        };
        // Start from a text object, then from a widget: both must move the same four objects.
        await drag(130,95,150,115);
        const moved = await saved();
        assert.deepEqual(errors,[]);
        for (let i=2;i<4;i++) {
          assert.ok(Math.abs(moved.canvas.objects[i].left - after.canvas.objects[i].left - 20) < 1, JSON.stringify({before:after.canvas.objects[i].left,after:moved.canvas.objects[i].left}));
          assert.ok(Math.abs(moved.canvas.objects[i].top - after.canvas.objects[i].top - 20) < 1);
          assert.ok(Math.abs(moved.widgets[i].x - after.widgets[i].x - 20) < 1);
          assert.ok(Math.abs(moved.widgets[i].y - after.widgets[i].y - 20) < 1);
        }
        await assertGroup(4);
        await drag(900,400,920,410);
        const widgetMoved = await saved();
        for (let i=2;i<4;i++) {
          assert.ok(Math.abs(widgetMoved.canvas.objects[i].left - moved.canvas.objects[i].left - 20) < 1,JSON.stringify({before:moved.canvas.objects[i].left,after:widgetMoved.canvas.objects[i].left,errors}));
          assert.ok(Math.abs(widgetMoved.widgets[i].x - moved.widgets[i].x - 20) < 1);
        }
        const scaleHandle = await controlPoint('br');
        await page.mouse.move(scaleHandle.x,scaleHandle.y); await page.mouse.down();
        await page.mouse.move(scaleHandle.x+60,scaleHandle.y+40,{steps:5}); await page.mouse.up();
        await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        const scaled = await saved();
        const ratio = scaled.widgets[2].w / widgetMoved.widgets[2].w;
        assert.ok(ratio > 1.05, 'group handle enlarges the selection');
        assert.ok(Math.abs(scaled.canvas.objects[2].scaleX / widgetMoved.canvas.objects[2].scaleX - ratio) < 0.01);
        assert.ok(Math.abs(scaled.widgets[3].w / widgetMoved.widgets[3].w - ratio) < 0.01);
        await assertGroup(4);
        const rotateHandle = await controlPoint('mtr');
        await page.mouse.move(rotateHandle.x,rotateHandle.y); await page.mouse.down();
        await page.mouse.move(rotateHandle.x+70,rotateHandle.y+20,{steps:5}); await page.mouse.up();
        await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        const rotated = await saved();
        assert.ok(Math.abs(await page.evaluate(() => fixtureCanvas.__asmSelectionControls.getActiveObject().angle))>5,'native selection frame rotates too');
        await assertGroup(4);
        assert.ok(Math.abs(rotated.widgets[2].angle) > 5, 'rotation applies to widgets');
        assert.ok(Math.abs(rotated.canvas.objects[2].angle - rotated.widgets[2].angle) < 0.01);
        assert.equal(rotated.widgets[2].frameBackgroundEnabled, false);
        assert.equal(tableVariant ? rotated.widgets[2].tableBodyFill : rotated.widgets[2].cellStyles['1'].highlight, '#aa22cc');
        await page.keyboard.press('Control+z');
        await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        const undone = await saved();
        assert.ok(Math.abs(undone.widgets[2].angle || 0) < 0.01, 'one undo reverts all widget rotation');
        assert.ok(Math.abs(undone.canvas.objects[2].angle || 0) < 0.01, 'same undo reverts text rotation');
        await page.keyboard.press('Control+y');
        await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
        await page.reload(); await ready();
        const reopened = await saved();
        assert.ok(Math.abs(reopened.widgets[2].angle - rotated.widgets[2].angle) < 0.01);
        for (const i of [2,3]) for (const key of ['x','y','w','h','angle','scale','fontSize','manualSize'])
          assert.deepEqual(reopened.widgets[i][key], rotated.widgets[i][key], `reopen widget ${i} ${key}`);
        assert.equal(tableVariant ? reopened.widgets[2].tableBodyFill : reopened.widgets[2].cellStyles['1'].highlight, '#aa22cc');
        assert.deepEqual(errors, []);
        return;
      }
      const mr = await controlPoint('mr');
      const beforeSide = await saved();
      await page.mouse.move(mr.x,mr.y); await page.mouse.down();
      await page.mouse.move(mr.x+60,mr.y,{steps:5}); await page.mouse.up();
      await page.waitForFunction(() => document.body.dataset.localDeckSave==='saved');
      const afterSide = await saved();
      assert.ok(afterSide.widgets[2].w>beforeSide.widgets[2].w,'native side handle changes width');
      assert.ok(Math.abs(afterSide.widgets[2].h-beforeSide.widgets[2].h)<0.01,'native side handle retains height');
      assert.equal(afterSide.canvas.objects.length,4,'geometry proxies are never saved');
      await assertGroup(4);
      await page.locator('#alignmentToolbar [data-align-action="left"]').click();
      const alignedFrame = await assertGroup(4);
      assert.ok(alignedFrame.width < fullFrame.width - 50, 'alignment updates the full group outline');
      await click(1200,650);
      assert.equal(await page.locator('.asm-native-selection-controls').evaluate(el=>el.hidden),true,'clearing selection hides native controls');
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload(); await ready();
      assert.equal((await saved()).widgets[2].cellStyles['1'].highlight, '#aa22cc');
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });


