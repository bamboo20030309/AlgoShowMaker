const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('disk bounds include upper disks and preserve native selection through reopen',
  { timeout: 120000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await new Promise(resolve => { const probe = net.createServer();
      probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
    const server = spawn(process.execPath, ['server.js'], { cwd: root, stdio: 'ignore', windowsHide: true,
      env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1' } });
    let browser;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i=0; i<80; i++) { try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve,100)); }
      browser = await chromium.launch({ headless: true, ...(process.platform==='win32' ? { channel:'msedge' } : {}) });
      const page = await browser.newPage({ viewport: { width:1600, height:1000 } });
      const errors = []; page.on('pageerror', error=>errors.push(error.message));
      await page.route('**/slides.js?*', route=>route.fulfill({ contentType:'application/javascript',
        body: `const fixtureLoad=fabric.Canvas.prototype.loadFromJSON;
          fabric.Canvas.prototype.loadFromJSON=function(...args){window.fixtureCanvas=this;return fixtureLoad.apply(this,args);};\n`
          + fs.readFileSync(path.join(root,'public/slides.js'),'utf8') }));
      const original = { id:'array', type:'structure', structureMode:'disk', content:'8,7,6,5,4,3,2,1',
        x:220,y:230,w:760.5,h:240.25,manualSize:false,frameBackgroundEnabled:false,
        structureName:'data',highlightColor:'#123456',indexMode:0,cellStyles:{},angle:12,skewX:8 };
      const deck = { groups:[{id:'g',slides:[{id:'s',widgets:[original],canvas:{objects:[
        {type:'textbox',text:'Heading',left:120,top:100,width:230,fontSize:28,fill:'#234567'}
      ]}}]}] };
      await page.addInitScript(value=>{ if(sessionStorage.getItem('geometryFixture'))return;
        localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify(value));sessionStorage.setItem('geometryFixture','1'); },deck);
      const ready=()=>page.waitForFunction(()=>Reveal.isReady() && window.fixtureCanvas && document.body.dataset.fabricBuild?.startsWith('ready'));
      const saved=()=>page.evaluate(async()=> (await ASMSlideStorage.create(indexedDB,localStorage)
        .loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].widgets.find(w=>w.id==='array'));
      await page.goto(base+'/slides.html'); await ready();
      if(!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode'))await page.locator('#modeToggleBtn').click();
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');



      const object=page.locator('[data-widget-id="array"]');
      const inspect=(id='array')=>page.locator(`[data-widget-id="${id}"] svg`).evaluate(svg=>{
        const rects=[...svg.querySelectorAll('.disk-base,.disk-peg,[data-structure-item-index] > rect')];
        if(!rects.length)throw Error('missing disk body');
        const left=Math.min(...rects.map(r=>Number(r.getAttribute('x'))));
        const top=Math.min(...rects.map(r=>Number(r.getAttribute('y'))));
        const right=Math.max(...rects.map(r=>Number(r.getAttribute('x'))+Number(r.getAttribute('width'))));
        const bottom=Math.max(...rects.map(r=>Number(r.getAttribute('y'))+Number(r.getAttribute('height'))));
        const view=svg.viewBox.baseVal;
        const screen=(x,y)=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};};
        return {left,top,right,bottom,view:{left:view.x,top:view.y,right:view.x+view.width,bottom:view.y+view.height},
          expected:[[left-3,top-3],[right+3,top-3],[right+3,bottom+3],[left-3,bottom+3]].map(([x,y])=>screen(x,y))};
      });
      const before=await inspect();
      assert.ok(before.top<0,'fixture exposes disks above the stand origin');
      assert.ok(before.view.top<=before.top-1,'top disk stroke is not cropped');
      assert.ok(before.view.left<=before.left-1 && before.view.right>=before.right+1 && before.view.bottom>=before.bottom+1);
      await object.locator('[data-structure-item-index="0"] > text').click();
      const controls=await page.evaluate(()=>{
        const canvas=fixtureCanvas.__asmSelectionControls,active=canvas.getActiveObject(),rect=canvas.upperCanvasEl.getBoundingClientRect();
        return [[-active.width/2,-active.height/2],[active.width/2,-active.height/2],[active.width/2,active.height/2],[-active.width/2,active.height/2]].map(([x,y])=>{
          const p=fabric.util.transformPoint(new fabric.Point(x,y),active.calcTransformMatrix());
          const q=fabric.util.transformPoint(p,canvas.viewportTransform);
          return {x:rect.left+q.x*rect.width/canvas.width,y:rect.top+q.y*rect.height/canvas.height};
        });
      });
      before.expected.forEach((p,i)=>{assert.ok(Math.abs(p.x-controls[i].x)<1);assert.ok(Math.abs(p.y-controls[i].y)<1);});
      fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
      await page.screenshot({path:path.join(root,'test-results/structure-disk-bounds.png')});
      const cases=await page.evaluate(()=>{
        return ['','1','1,1,1,1,1,1,1,1','9,2,6,1','8,7,6,5,4,3,2,1'].map(content=>{
          const widget={type:'structure',structureMode:'disk',content,x:0,y:0,w:500,h:280,indexMode:0};
          const plain=AlgoStructureRenderer.getWidgetGeometry(widget);
          const marked=AlgoStructureRenderer.getWidgetGeometry({...widget,pointIndices:'0',annotationIndices:'0'});
          const svg=AlgoStructureRenderer.createSvg(widget),view=svg.viewBox.baseVal;
          return {content,stable:JSON.stringify(plain.selection)===JSON.stringify(marked.selection),
            covered:[...svg.querySelectorAll('.disk-base,.disk-peg,[data-structure-item-index] > rect')].every(rect=>{
              const x=Number(rect.getAttribute('x')),y=Number(rect.getAttribute('y'));
              return x>=view.x && y>=view.y && x+Number(rect.getAttribute('width'))<=view.x+view.width && y+Number(rect.getAttribute('height'))<=view.y+view.height;
            })};
        });
      });
      cases.forEach(result=>{assert.equal(result.covered,true,result.content);assert.equal(result.stable,true,result.content);});
      await page.waitForTimeout(350);await object.locator('[data-structure-item-index="1"] > text').dblclick();
      const editor=page.locator('.structure-inline-value-input');await editor.fill('5');await editor.press('Enter');
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
      await page.reload();await ready();
      const reopened=await inspect(),stored=await saved();
      assert.ok(reopened.view.top<=reopened.top-1);
      assert.equal(stored.content.split(',')[1].trim(),'5');
      assert.deepEqual([stored.x,stored.y,stored.w,stored.h],[original.x,original.y,original.w,original.h]);
      assert.equal(stored.highlightColor,'#123456');assert.equal(stored.frameBackgroundEnabled,false);

      if(!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode'))await page.locator('#modeToggleBtn').click();
      await page.mouse.click(1550,950);await page.locator('#structureMenuBtn').click();
      await page.locator('#structureMenu [data-structure-mode="disk"]').click();
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved' && document.querySelectorAll('.structure-widget').length===2);
      const id=await page.locator('.structure-widget').last().getAttribute('data-widget-id');
      const created=await inspect(id);assert.ok(created.view.top<=created.top-1);
      await page.reload();await ready();const createdAgain=await inspect(id);assert.ok(createdAgain.view.top<=createdAgain.top-1);
      assert.deepEqual(errors,[]);
    } finally {await browser?.close();server.kill();}
  });
