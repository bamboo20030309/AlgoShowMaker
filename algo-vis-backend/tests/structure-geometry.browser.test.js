const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('structure body matches native controls through letterboxing, point, scaling and saved legacy objects',
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
      const original = { id:'array', type:'structure', structureMode:'normal', content:'1,2,3,4',
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

      // Independent painted bounds: SVG coordinates and actual screen CTM, not playback plans.
      const checkControls = async (id='array') => {
        await page.locator(`[data-widget-id="${id}"] [data-structure-item-index="0"] > text`).click();
        const result=await page.evaluate(id=>{
          const el=document.querySelector(`[data-widget-id="${id}"]`), svg=el.querySelector('svg');
          const group=svg.querySelector('[data-slide-structure]');
          const bounds=['left','top','right','bottom'].map(k=>Number(group.getAttribute('data-outerframe-'+k)));
          if(!bounds.every(Number.isFinite)||bounds[2]<=bounds[0])throw Error('Missing independent SVG body bounds');
          const [l,t,r,b]=[bounds[0]-3,bounds[1]-3,bounds[2]+3,bounds[3]+3];
          const screen=(x,y)=>new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());
          const expected=[[l,t],[r,t],[r,b],[l,b]].map(([x,y])=>screen(x,y));
          const controls=fixtureCanvas.__asmSelectionControls, active=controls.getActiveObject();
          const canvasRect=controls.upperCanvasEl.getBoundingClientRect();
          const halfW=active.width/2, halfH=active.height/2;
          const actual=[[-halfW,-halfH],[halfW,-halfH],[halfW,halfH],[-halfW,halfH]].map(([x,y])=>{
            const p=fabric.util.transformPoint(new fabric.Point(x,y),active.calcTransformMatrix());
            const q=fabric.util.transformPoint(p,controls.viewportTransform);
            return {x:canvasRect.left+q.x*canvasRect.width/controls.width,y:canvasRect.top+q.y*canvasRect.height/controls.height};
          });
          return {expected:expected.map(p=>({x:p.x,y:p.y})),actual};
        },id);
        result.expected.forEach((p,i)=>{assert.ok(Math.abs(p.x-result.actual[i].x)<1,`corner ${i} x ${JSON.stringify(result)}`);
          assert.ok(Math.abs(p.y-result.actual[i].y)<1,`corner ${i} y ${JSON.stringify(result)}`);});
      };
      await checkControls();
      const before=await saved();
      assert.deepEqual([before.x,before.y,before.w,before.h],[original.x,original.y,original.w,original.h]);
      assert.equal(before.manualSize,false,'legacy explicit automatic-size setting is retained');
      const cellRect=()=>page.locator('[data-widget-id="array"] [data-structure-item-index="0"] > text').boundingBox();
      const beforePoint=await cellRect();
      // Separate object selection from cell selection; a rapid second click edits text.
      await page.waitForTimeout(350);
      await page.locator('[data-widget-id="array"] [data-structure-item-index="0"] > text').click();
      await page.waitForSelector('#structureContextMenu.structure-cell-style-toolbar', {timeout:5000}).catch(async error=>{
        throw Error(error.message+' '+await page.evaluate(()=>JSON.stringify({menu:document.querySelector('#structureContextMenu')?.outerHTML,
          selected:[...document.querySelectorAll('.is-structure-cell-selected')].map(e=>e.dataset.structureItemIndex),
          inline:!!document.querySelector('.structure-inline-value-input')})));
      });
      await page.locator('#structureContextMenu').getByRole('button',{name:'Point',exact:true}).click();
      await page.mouse.move(10,10);
      const afterPoint=await cellRect();
      for(const k of ['x','y','width','height'])assert.ok(Math.abs(beforePoint[k]-afterPoint[k])<0.5,'point preserves '+k);
      const pointed=await saved();
      assert.deepEqual([pointed.x,pointed.y,pointed.w,pointed.h],[before.x,before.y,before.w,before.h]);
      await checkControls();

      // Stretch with the real Fabric side handle. Explicit scales persist the resulting geometry.
      await page.mouse.click(1550,950);
      await checkControls();
      const handle=await page.evaluate(()=>{
        const c=fixtureCanvas.__asmSelectionControls,a=c.getActiveObject(),p=a.oCoords.mr,r=c.upperCanvasEl.getBoundingClientRect();
        return {x:r.left+p.x*r.width/c.width,y:r.top+p.y*r.height/c.height};
      });
      await page.mouse.move(handle.x,handle.y);await page.mouse.down();
      await page.mouse.move(handle.x+80,handle.y+17,{steps:6});await page.mouse.up();
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
      const stretched=await saved();
      assert.ok(stretched.structureScaleX>0 && stretched.structureScaleY>0,'resize records separate render scales');
      assert.notEqual(stretched.w,before.w,'side handle changes dimensions');
      await checkControls();
      await page.waitForTimeout(350);
      await page.locator('[data-widget-id="array"] [data-structure-item-index="0"] > text').dblclick();
      await page.locator('.structure-inline-value-input').fill('9');
      await page.locator('.structure-inline-value-input').press('Enter');
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved');
      const edited=await saved();
      for(const k of ['x','y','w','h','structureScaleX','structureScaleY'])assert.equal(edited[k],stretched[k],'editing preserves '+k);
      await page.reload();await ready();
      if(!(await page.locator('body').getAttribute('class')).includes('asm-edit-mode'))await page.locator('#modeToggleBtn').click();
      await checkControls();
      const reopened=await saved();
      for(const k of ['x','y','w','h','structureScaleX','structureScaleY','angle','skewX'])assert.equal(reopened[k],stretched[k],k+' persists');
      assert.equal(reopened.frameBackgroundEnabled,false);assert.equal(reopened.highlightColor,'#123456');

      // Geometry across renderers and external annotations, including mismatched legacy boxes.
      const modes=await page.evaluate(()=>{
        const result=[];
        for(const mode of ['normal','matrix','binary_tree','heap','segment_tree','BIT','table']){
          const widget={type:mode==='table'?'table':'structure',structureMode:mode,content:mode==='matrix'?'1,2;3,4':'1,2,3,4',
            x:0,y:0,w:600,h:230,indexMode:0,structureName:'data',frameBackgroundEnabled:false};
          const plain=AlgoStructureRenderer.getWidgetGeometry(widget);
          const marked=AlgoStructureRenderer.getWidgetGeometry({...widget,pointIndices:'0,1',annotationIndices:'1',annotationText:'i'});
          result.push({mode,plain:plain.selection,marked:marked.selection,natural:plain.naturalSize,markedNatural:marked.naturalSize,
            paint:marked.paint,body:marked.selection});
          const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:600px;height:230px';
          document.body.appendChild(host);AlgoStructureRenderer.render(host,widget);
          const svg=host.querySelector('svg'),g=svg.querySelector('[data-slide-structure]');
          const attrs=['left','top','right','bottom'].map(k=>Number(g.getAttribute('data-outerframe-'+k)));
          if(attrs.every(Number.isFinite)&&attrs[2]>attrs[0]){
            const a=new DOMPoint(attrs[0]-3,attrs[1]-3).matrixTransform(svg.getScreenCTM());
            const b=new DOMPoint(attrs[2]+3,attrs[3]+3).matrixTransform(svg.getScreenCTM());
            result.at(-1).actual={left:a.x,top:a.y,width:b.x-a.x,height:b.y-a.y};
          }
          host.remove();
        }return result;
      });
      for(const result of modes){
        assert.deepEqual(result.marked,result.plain,result.mode+' decorations do not change selection');
        assert.deepEqual(result.markedNatural,result.natural,result.mode+' decorations do not change natural size');
        assert.ok(result.actual,result.mode+' exposes independent rendered body bounds');
        for(const k of ['left','top','width','height'])assert.ok(Math.abs(result.actual[k]-result.plain[k])<0.5,result.mode+' painted '+k);
      }
      const raster=await page.evaluate(async()=>{
        const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=700;
        const ctx=canvas.getContext('2d');
        const w={type:'structure',structureMode:'normal',content:'1,2,3,4',x:150,y:250,w:450,h:140,indexMode:0,structureName:'data'};
        const extent=()=>{const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let minY=canvas.height;
          for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(data[(y*canvas.width+x)*4+3])minY=Math.min(minY,y);
          return minY;};
        await AlgoStructureRenderer.drawCanvas(ctx,w);const plain=extent();ctx.clearRect(0,0,canvas.width,canvas.height);
        await AlgoStructureRenderer.drawCanvas(ctx,{...w,pointIndices:'0'});return {plain,point:extent()};
      });
      assert.ok(raster.point<raster.plain-8,'raster export includes external point above the unchanged body');
      // New UI object also uses geometry without requiring migration fields.
      await page.mouse.click(1550,950);
      await page.locator('#structureMenuBtn').click();
      await page.locator('#structureMenu [data-structure-mode="matrix"]').click();
      await page.waitForFunction(()=>document.querySelectorAll('.structure-widget').length===2);
      const newId=await page.locator('.structure-widget').last().getAttribute('data-widget-id');
      await checkControls(newId);
      assert.deepEqual(errors,[]);
    } finally {await browser?.close();server.kill();}
  });
