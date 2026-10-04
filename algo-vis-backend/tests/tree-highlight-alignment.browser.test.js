const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('tree highlights share node coordinates for old, customized and newly created trees',
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
      const widgets = [
        { id: 'old-tree', type: 'structure', structureMode: 'binary_tree', content: '1,2,3',
          x: 100, y: 100, w: 350, h: 250, pointIndices: '0', highlightIndices: '0,1,2', highlightColor: '#123456' },
        { id: 'custom-tree', type: 'structure', structureMode: 'binary_tree', content: '4,5,6',
          x: 650, y: 100, w: 450, h: 300, highlightIndices: '0,1,2', highlightColor: '#ff1234',
          indexMode: 1, treeHorizontal: true, frameBackgroundEnabled: false },
        { id:'rotated-tree',type:'structure',structureMode:'binary_tree',content:'1,2,3',x:750,y:380,w:300,h:200,manualSize:true,structureFrameVersion:4,angle:27,skewX:8,frameBackgroundEnabled:false }
      ];
      const deck = { groups: [{ id: 'g', slides: [{ id: 's', widgets, canvas: { objects: [] } }] }] };
      await page.addInitScript(value => {
        if (sessionStorage.getItem('fixture')) return;
        localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)); sessionStorage.setItem('fixture', '1');
      }, deck);
      const ready = () => page.waitForFunction(() => Reveal.isReady() && document.body.dataset.fabricBuild?.startsWith('ready'));
      const assertAligned = async id => {
        const nodes = await page.evaluate(id => {
          const widget = document.querySelector(`[data-widget-id="${id}"]`);
          return [...widget.querySelectorAll('[id^="highlight-tree_"]')].map(highlight => {
            const index = Number(highlight.id.match(/tree_(\d+)/)[1]);
            const node = widget.querySelector(`[data-tree-index="${index}"]`);
            const cell = node.querySelector('[data-structure-item-index] > rect');
            const c = cell.getBoundingClientRect(); const h = highlight.getBoundingClientRect();
            const indexCell = node.querySelector('[id$="-index"] > rect');
            const bottom = indexCell ? indexCell.getBoundingClientRect().bottom : c.bottom;
            return { index, dx: h.left - c.left, dy: h.top - c.top, dw: h.width - c.width, db: h.bottom - bottom };
          });
        }, id);
        assert.ok(nodes.length > 0, id + ' has highlights');
        for (const node of nodes) for (const field of ['dx', 'dy', 'dw', 'db'])
          assert.ok(Math.abs(node[field]) < 0.01, `${id} node ${node.index} ${field}: ${node[field]}`);
      };
      await page.route('**/slides.js?*', route=>route.fulfill({contentType:'application/javascript',body:
        'const originalLoad=fabric.Canvas.prototype.loadFromJSON; fabric.Canvas.prototype.loadFromJSON=function(...args){window.fixtureCanvas=this;return originalLoad.apply(this,args);};\n'+fs.readFileSync(path.join(root,'public/slides.js'),'utf8')}));
      await page.goto(base + '/slides.html'); await ready();
      const geometries = await page.evaluate(() => ['normal','matrix','binary_tree','segment_tree'].map(mode=>{
        const base={type:'structure',structureMode:mode,content:mode==='matrix'?'1,2\n3,4':'1,2,3,4',frameBackgroundEnabled:false};
        const plain=AlgoStructureRenderer.getNaturalSize(base), painted=AlgoStructureRenderer.getNaturalSize({...base,pointIndices:'0'});
        const box=AlgoStructureRenderer.getSelectionRect({...base,pointIndices:'0',w:painted.width*1.5,h:painted.height*1.5});
        return {mode,plain,painted,box};
      }));
      for(const {mode,plain,painted,box} of geometries){
        assert.ok(painted.height>plain.height,mode+' retains paint/export space for Point');
        assert.ok(Math.abs(box.height-plain.height*1.5)<0.01,mode+' selection excludes Point');
        assert.ok(Math.abs(box.width-plain.width*1.5)<0.01,mode+' width preserved');
      }
      await assertAligned('old-tree'); await assertAligned('custom-tree');
      if (!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode')) await page.locator('#modeToggleBtn').click();
      { const cell=await page.locator('[data-widget-id="old-tree"] [data-structure-item-index] > text').first().boundingBox();await page.mouse.click(cell.x+cell.width/2,cell.y+cell.height/2); }
      const proxy = await page.evaluate(() => {const active=fixtureCanvas.__asmSelectionControls.getActiveObject();return {width:active.width,height:active.height};});
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
      const expected = await page.evaluate(async()=> {const deck=await ASMSlideStorage.create(indexedDB,localStorage).loadDeck('asm_reveal_fabric_deck_v5');return AlgoStructureRenderer.getSelectionRect(deck.groups[0].slides[0].widgets.find(w=>w.id==='old-tree'));});
      assert.ok(Math.abs(proxy.height-expected.height)<0.01,'actual Fabric frame omits Point');
      assert.ok(await page.locator('[data-widget-id="old-tree"] [id^="point-"]').count()>0,'Point remains rendered');
      await page.mouse.click(1550,950);
      await page.locator('#structureMenuBtn').click();
      await page.locator('#structureMenu [data-structure-mode="binary_tree"]').click();
      await page.waitForFunction(() => document.querySelectorAll('.structure-widget').length === 4);
      const newest = page.locator('.structure-widget').last(); const id = await newest.getAttribute('data-widget-id');
      await newest.locator('[data-structure-item-index] > text').first().click();
      await page.locator('#structureContextMenu').getByRole('button', { name: 'Highlight', exact: true }).click();
      await assertAligned(id);
      const beforePoint = await page.evaluate(()=>fixtureCanvas.__asmSelectionControls.getActiveObject().getBoundingRect(true,true));
      await page.locator('#structureContextMenu').getByRole('button',{name:'Point',exact:true}).click();
      const afterPoint = await page.evaluate(()=>fixtureCanvas.__asmSelectionControls.getActiveObject().getBoundingRect(true,true));
      for (const key of ['left','top','width','height']) assert.ok(Math.abs(afterPoint[key]-beforePoint[key])<0.01,'enabling Point keeps frame '+key);
      assert.ok(await newest.locator('[id^="point-"]').count()>0);
      await page.locator('#structureContextMenu').getByRole('button',{name:'Point',exact:true}).click();
      const disabledPoint = await page.evaluate(()=>fixtureCanvas.__asmSelectionControls.getActiveObject().getBoundingRect(true,true));
      for(const key of ['left','top','width','height']) assert.ok(Math.abs(disabledPoint[key]-beforePoint[key])<0.01,'disabling Point keeps frame '+key);
      await page.locator('#structureContextMenu').getByRole('button',{name:'Point',exact:true}).click();
      fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
      await page.screenshot({path:path.join(root,'test-results/point-selection-frame.png')});
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload(); await ready();
      for (const id of ['old-tree', 'custom-tree']) await assertAligned(id);
      const saved = await page.evaluate(async () => ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
      const custom = saved.groups[0].slides[0].widgets.find(widget => widget.id === 'custom-tree');
      assert.equal(custom.highlightColor, '#ff1234'); assert.equal(custom.treeHorizontal, true);
      assert.equal(custom.frameBackgroundEnabled, false); assert.equal(custom.indexMode, 1);
      const rotated=saved.groups[0].slides[0].widgets.find(widget=>widget.id==='rotated-tree');
      assert.equal(rotated.angle,27); assert.equal(rotated.skewX,8); assert.equal(rotated.frameBackgroundEnabled,false);
      assert.ok(await page.locator('[data-widget-id="'+id+'"] [id^="point-"]').count()>0,'new Point persists after reopening');
      const old=saved.groups[0].slides[0].widgets.find(widget=>widget.id==='old-tree');
      assert.equal(old.pointIndices,'0','legacy Point persists');
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
