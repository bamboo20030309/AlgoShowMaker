const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('editing scaled old text preserves its transforms and styles', { timeout: 60000 }, async () => {
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
      const plainOnly = false, tableVariant = false;
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
      deck.groups[0].slides[0].widgets.push({id:'formula', type:'latex', content:String.raw`\(x^2\)`, x:800,y:60,w:260,h:90,scale:1.7,angle:12,manualSize:true});
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
      const before = await page.evaluate(() => {
        const o = fixtureCanvas.getObjects()[0];
        fixtureCanvas.setActiveObject(o); o.enterEditing(); o.selectAll();
        return {scaleX:o.scaleX,scaleY:o.scaleY,fontSize:o.fontSize,fill:o.fill,left:o.left,top:o.top};
      });
      await page.keyboard.type('修改之後仍然保持縮放比例');
      await page.mouse.click(1550,950);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const edited = (await saved()).canvas.objects[0];
      for (const key of ['scaleX','scaleY','fontSize','fill','left','top']) assert.equal(edited[key],before[key],key);
      assert.equal(edited.text,'修改之後仍然保持縮放比例');
      const formulaBefore = (await saved()).widgets.find(w => w.id==='formula');
      await click(930,105);
      const native = await page.evaluate(() => {
        const c=fixtureCanvas.__asmSelectionControls,o=c.getActiveObject();
        return {type:o.type,count:c.getActiveObjects().length,corner:o.cornerStyle,border:o.borderColor};
      });
      assert.deepEqual(native,{type:'rect',count:1,corner:'circle',border:'#1d8f83'});
      assert.equal(await page.locator('.asm-group-selection-box').count(),0);
      assert.equal(await page.locator('.widget-edge-handle').count(),0,'old DOM resize handles are removed');
      const outer = await page.locator('[data-widget-id="formula"]').evaluate(el => ({
        shadow:getComputedStyle(el).boxShadow, pseudo:getComputedStyle(el,'::after').content,
        border:getComputedStyle(el).borderTopColor
      }));
      assert.deepEqual(outer,{shadow:'none',pseudo:'none',border:'rgba(0, 0, 0, 0)'});
      await page.locator('#latexEditorInput').fill(String.raw`\(x^2+y^2\)`);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const formulaAfter = (await saved()).widgets.find(w => w.id==='formula');
      for (const key of ['x','y','w','h','scale','angle','manualSize']) assert.equal(formulaAfter[key],formulaBefore[key],`formula ${key}`);
      await click(520,140);
      const arrayBefore = (await saved()).widgets.find(w => w.id==='array');
      const naturalBefore = await page.evaluate(w => AlgoStructureRenderer.getNaturalSize(w),arrayBefore);
      await page.locator('#structureLengthInput').fill('6');
      await page.locator('#structureLengthInput').press('Enter');
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      const arrayAfter = (await saved()).widgets.find(w => w.id==='array');
      const naturalAfter = await page.evaluate(w => AlgoStructureRenderer.getNaturalSize(w),arrayAfter);
      assert.ok(Math.abs(arrayBefore.w/naturalBefore.width - arrayAfter.w/naturalAfter.width)<0.001);
      assert.ok(Math.abs(arrayBefore.h/naturalBefore.height - arrayAfter.h/naturalAfter.height)<0.001);
      assert.equal(arrayAfter.x,arrayBefore.x); assert.equal(arrayAfter.y,arrayBefore.y);
      assert.equal(arrayAfter.frameBackgroundEnabled,false);
      await page.reload(); await ready();
      const formulaReopened = (await saved()).widgets.find(w => w.id==='formula');
      for (const key of ['w','h','scale','angle','manualSize']) assert.equal(formulaReopened[key],formulaBefore[key],`formula reopen ${key}`);
      const reopened = (await saved()).canvas.objects[0];
      assert.equal(reopened.scaleX,before.scaleX); assert.equal(reopened.scaleY,before.scaleY);
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });


