const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('structure hit regions exclude letterbox and rotated empty corners',
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


      const object=page.locator('[data-widget-id="array"]');
      const isSelected=()=>object.evaluate(el=>el.classList.contains('is-selected'));
      const points=await page.evaluate(()=>{
        const svg=document.querySelector('[data-widget-id="array"] svg');
        const group=svg.querySelector('[data-slide-structure]');
        const [l,t,r,b]=['left','top','right','bottom'].map(k=>Number(group.getAttribute('data-outerframe-'+k)));
        const screen=(x,y)=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};};
        const corners=[[l-3,t-3],[r+3,t-3],[r+3,b+3],[l-3,b+3]].map(([x,y])=>screen(x,y));
        // Independent empty corner: outside the rotated body but inside its screen AABB.
        const aabb={left:Math.min(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),right:Math.max(...corners.map(p=>p.x)),bottom:Math.max(...corners.map(p=>p.y))};
        const inside=p=>corners.every((a,i)=>{const c=corners[(i+1)%4];return (c.x-a.x)*(p.y-a.y)-(c.y-a.y)*(p.x-a.x)>=0;});
        const blank=screen((l+r)/2,t-28);
        const corner=[{x:aabb.left+8,y:aabb.top+8},{x:aabb.right-8,y:aabb.top+8},
          {x:aabb.left+8,y:aabb.bottom-8},{x:aabb.right-8,y:aabb.bottom-8}].find(p=>!inside(p));
        if(!corner)throw Error('fixture must expose an empty rotated corner');
        const layer=document.querySelector('.widget-layer[data-slide-id="s"]').getBoundingClientRect();
        return {blank,corner,body:screen((l+r)/2,(t+b)/2),layer:{x:layer.x,y:layer.y,width:layer.width,height:layer.height},corners};
      });
      for (const point of [points.blank,points.corner]) {
        await object.locator('[data-structure-item-index="0"] > text').click();
        assert.equal(await isSelected(),true);
        await page.mouse.click(point.x,point.y);
        assert.equal(await isSelected(),false,'empty space must deselect');
        await page.mouse.dblclick(point.x,point.y);
        assert.equal(await isSelected(),false,'empty double click must not edit/select');
        assert.equal(await page.locator('.structure-inline-value-input').count(),0);
      }
      // A blank-container drag may create a marquee, but never moves the structure.
      const before=await saved();
      await page.mouse.move(points.blank.x,points.blank.y);await page.mouse.down();
      await page.mouse.move(points.blank.x+6,points.blank.y+6);await page.mouse.up();
      const after=await saved();
      assert.deepEqual([after.x,after.y,after.w,after.h],[before.x,before.y,before.w,before.h]);
      assert.equal(await isSelected(),false);
      // Small marquee in a rotated AABB corner does not intersect the true body.
      await page.mouse.move(points.corner.x-2,points.corner.y-2);await page.mouse.down();
      await page.mouse.move(points.corner.x+4,points.corner.y+4);await page.mouse.up();
      assert.equal(await isSelected(),false,'empty AABB corner is excluded from marquee');
      await page.mouse.move(points.body.x-30,points.body.y-100);await page.mouse.down();
      await page.mouse.move(points.body.x+30,points.body.y+25);await page.mouse.up();
      assert.equal(await isSelected(),true,'marquee intersecting the body selects it');
      const contracts=await page.evaluate(({widget,points})=>{
        const toSlide=p=>({x:(p.x-points.layer.x)*1280/points.layer.width,y:(p.y-points.layer.y)*720/points.layer.height});
        const center=toSlide(points.body),blank=toSlide(points.blank),corner=toSlide(points.corner);
        return {body:AlgoStructureRenderer.containsSlidePoint(widget,center),blank:AlgoStructureRenderer.containsSlidePoint(widget,blank),
          corner:AlgoStructureRenderer.containsSlidePoint(widget,corner),
          emptyBox:AlgoStructureRenderer.intersectsSlideRect(widget,{left:corner.x-1,top:corner.y-1,right:corner.x+1,bottom:corner.y+1}),
          bodyBox:AlgoStructureRenderer.intersectsSlideRect(widget,{left:center.x-1,top:center.y-1,right:center.x+1,bottom:center.y+1})};
      },{widget:before,points});
      assert.deepEqual(contracts,{body:true,blank:false,corner:false,emptyBox:false,bodyBox:true});

      await object.locator('[data-structure-item-index="0"] > text').click();
      await page.waitForTimeout(350);
      await object.locator('[data-structure-item-index="0"] > text').click();
      await page.waitForSelector('.asm-structure-cell-selection-box:not([hidden])');
      const cellCorners=await page.evaluate(()=>{
        const shape=document.querySelector('[data-widget-id="array"] [data-structure-item-index="0"] > rect');
        const bounds=shape.getBBox(), ctm=shape.getScreenCTM();
        const expected=[[bounds.x,bounds.y],[bounds.x+bounds.width,bounds.y],
          [bounds.x+bounds.width,bounds.y+bounds.height],[bounds.x,bounds.y+bounds.height]]
          .map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(ctm);return {x:p.x,y:p.y};});
        const overlay=document.querySelector('.asm-structure-cell-selection-box:not([hidden])');
        const frame=document.querySelector('.asm-slide-frame-content').getBoundingClientRect();
        const m=new DOMMatrix(getComputedStyle(overlay).transform);
        const left=parseFloat(overlay.style.left),top=parseFloat(overlay.style.top);
        const w=parseFloat(overlay.style.width),h=parseFloat(overlay.style.height);
        const actual=[[0,0],[w,0],[w,h],[0,h]].map(([x,y])=>{
          const p=new DOMPoint(x,y).matrixTransform(m);
          return {x:frame.x+(left+p.x)*frame.width/1280,y:frame.y+(top+p.y)*frame.height/720};
        });
        return {expected,actual};
      });
      cellCorners.expected.forEach((p,i)=>{
        assert.ok(Math.abs(p.x-cellCorners.actual[i].x)<1,'cell overlay corner x');
        assert.ok(Math.abs(p.y-cellCorners.actual[i].y)<1,'cell overlay corner y');
      });
      assert.deepEqual(errors,[]);
    } finally { await browser?.close(); server.kill(); }
  });
