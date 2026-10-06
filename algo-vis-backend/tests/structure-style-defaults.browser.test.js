const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('slide default style colors match omitted-color animation renderers',
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



      const colors=await page.evaluate(()=>{
        const modes=['normal','matrix','heap','segment_tree','BIT','disk','stack','queue'];
        const context=document.createElement('canvas').getContext('2d');
        const normalize=color=>{context.fillStyle='#010203';context.fillStyle=color;return context.fillStyle;};
        const paint=(root,type)=>{
          if(type==='highlight')return normalize(root.querySelector('[id^="highlight-"]').getAttribute('stroke'));
          if(type==='point')return normalize(root.querySelector('[id^="point-"]').getAttribute('fill'));
          if(type==='mark')return normalize(root.querySelector('[id^="mark-"]').getAttribute('stroke'));
          const cells=[...root.querySelectorAll('[id^="cell-"] > rect')].filter(rect=>!rect.parentElement.id.endsWith('-index'));
          return normalize(cells[type==='focus'?1:0].getAttribute('fill'));
        };
        const results=[];
        for(const mode of modes) for(const type of ['highlight','point','mark','focus','background']) {
          const oneBased=['heap','segment_tree','BIT'].includes(mode);
          const values=oneBased?[null,1,2,3,4]:[1,2,3,4];
          const g=document.createElementNS('http://www.w3.org/2000/svg','g');
          const styles=[{type,color:'',elements:[oneBased?1:0]}];
          const range=oneBased?[1,4]:[0,3];
          if(mode==='normal'||mode==='matrix')draw_array_normal(g,'animation',values,styles,range,mode==='matrix'?2:Infinity,0,0);
          else if(mode==='segment_tree')draw_standard_segment_tree(g,'animation',values,styles,{domainStart:0,domainEnd:3,root:1,indexMode:0,gap:0});
          else if(mode==='disk')draw_array_disk(g,'animation',values,styles,range,Infinity,0);
          else window['draw_array_'+mode](g,'animation',values,styles,range,0,0);
          const widget={type:'structure',structureMode:mode,content:mode==='matrix'?'1,2;3,4':'1,2,3,4',x:0,y:0,w:500,h:300,
            frameBackgroundEnabled:false,[type+'Indices']:'0'};
          const svg=AlgoStructureRenderer.createSvg(widget);
          results.push({mode,type,animation:paint(g,type),slide:paint(svg,type)});
        }
        return results;
      });
      for(const result of colors)assert.equal(result.slide,result.animation,`${result.mode} ${result.type}`);

      await page.locator('#structureMenuBtn').click();
      await page.locator('#structureMenu [data-structure-mode="normal"]').click();
      await page.waitForFunction(()=>document.body.dataset.localDeckSave==='saved' && document.querySelectorAll('.structure-widget').length===2);
      await page.reload();await ready();
      const persisted=await page.evaluate(async()=> (await ASMSlideStorage.create(indexedDB,localStorage)
        .loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].widgets);
      const created=persisted.find(w=>w.id!=='array'),legacy=persisted.find(w=>w.id==='array');
      assert.deepEqual([created.highlightColor,created.focusColor,created.pointColor,created.markColor,created.backgroundColor],
        ['#ff0000','#cccccc','#ff0000','#32cd32','#e790ff']);
      assert.equal(legacy.highlightColor,'#123456','explicit custom color remains intact');
      assert.equal(legacy.frameBackgroundEnabled,false,'explicit disabled setting remains intact');
      assert.deepEqual(errors,[]);
    } finally { await browser?.close(); server.kill(); }
  });
