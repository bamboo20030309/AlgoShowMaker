const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('structure raster thumbnail matches visible SVG at reduced scale',
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


      const result=await page.evaluate(async()=>{
        const results=[];
        for(const mode of ['normal','matrix','disk','heap','segment_tree','BIT','binary_tree','stack','queue']) for(const scale of [0.25,0.5,1]) {
          const widget={type:'structure',structureMode:mode,content:mode==='matrix'?'1,2;3,4':'4,3,2,1',x:200,y:160,w:700,h:340,frameBackgroundEnabled:false};
          const host=document.createElement('div');host.style.cssText='position:fixed;left:0;top:0;width:700px;height:340px';document.body.appendChild(host);
          AlgoStructureRenderer.render(host,widget);const rects=[...host.querySelectorAll('svg rect')].map(element=>{
            const box=element.getBoundingClientRect(),matrix=element.getScreenCTM(),style=getComputedStyle(element);
            // DOM bounds exclude stroke. Include its actual transformed width;
            // thick queue/outerframe borders grow under widget scaling.
            const stroke=style.stroke==='none'?0:Number.parseFloat(style.strokeWidth)||0;
            const dx=stroke*Math.hypot(matrix.a,matrix.c)/2,dy=stroke*Math.hypot(matrix.b,matrix.d)/2;
            return {left:box.left-dx,top:box.top-dy,right:box.right+dx,bottom:box.bottom+dy,width:box.width,height:box.height};
          }).filter(rect=>rect.width&&rect.height);
          const rect={left:Math.min(...rects.map(r=>r.left)),top:Math.min(...rects.map(r=>r.top)),right:Math.max(...rects.map(r=>r.right)),bottom:Math.max(...rects.map(r=>r.bottom))};
          const canvas=document.createElement('canvas');canvas.width=1280*scale;canvas.height=720*scale;
          await AlgoStructureRenderer.drawCanvas(canvas.getContext('2d'),widget,scale);
          const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          let left=canvas.width,top=canvas.height,right=0,bottom=0;
          for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>100){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
          results.push({mode,scale,expected:{left:(widget.x+rect.left)*scale,top:(widget.y+rect.top)*scale,right:(widget.x+rect.right)*scale,bottom:(widget.y+rect.bottom)*scale},actual:{left,top,right,bottom}});
          if(scale===0.5) {
            const url=await AlgoDeckThumbnail.createSlide({canvas:{objects:[]},widgets:[widget]});
            const image=new Image();image.src=url;await image.decode();
            const thumbnail=document.createElement('canvas');thumbnail.width=640;thumbnail.height=360;
            const ctx=thumbnail.getContext('2d');ctx.drawImage(image,0,0);
            const jpeg=ctx.getImageData(0,0,640,360).data;
            let firstDarkRow=360;
            for(let y=0;y<360;y++)for(let x=0;x<640;x++)if(jpeg[(y*640+x)*4]<140&&jpeg[(y*640+x)*4+1]<140&&jpeg[(y*640+x)*4+2]<140)firstDarkRow=Math.min(firstDarkRow,y);
            results.at(-1).thumbnailTop=firstDarkRow;
          }
          host.remove();
        }return results;
      });
      for(const item of result)for(const key of ['left','top','right','bottom'])assert.ok(Math.abs(item.expected[key]-item.actual[key])<3,JSON.stringify(item));
      for(const item of result)if(item.scale===0.5)assert.ok(Math.abs(item.thumbnailTop-item.expected.top)<3,`JPEG thumbnail ${JSON.stringify(item)}`);
      assert.deepEqual(errors,[]);
    }finally{await browser?.close();server.kill();}
  });
