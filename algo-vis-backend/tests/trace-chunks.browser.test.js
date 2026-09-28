const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn,execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
test('chunked checkerboard trace reaches canvas; legacy documents reopen; marker availability is unchanged',{timeout:180000},async()=>{
 const root=path.resolve(__dirname,'..');
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),ASM_REGRESSION:'1',JWT_SECRET:require('node:crypto').randomBytes(32).toString('hex')},windowsHide:true,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/algorithm.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/algorithm.html',{waitUntil:'networkidle'});
  const old=await page.evaluate(()=>{
   const doc={schemaVersion:'1.0',variables:{a:{id:'a',name:'a',kind:'sequence'}},frames:[{id:'old',source:{},events:[],state:{a:{name:'a',data:{kind:'sequence',items:[{kind:'scalar',value:0},{kind:'scalar',value:8}]}}}}],studio:{eventSettings:{autoFixedEnabled:false,autoLoopBoundaryEnabled:false,gapMs:0},customColor:'#123456'}};
   ASMTracePlayer.apply(doc);
   const saved=JSON.stringify(ASMTracePlayer.getDocument());
   const reopened=ASMTracePlayer.apply(JSON.parse(saved));
   return {settings:reopened.studio,values:reopened.frames[0].state.a.data.items.map(v=>v.value),cells:document.querySelectorAll('#asm-trace-root g[data-trace-index]').length};
  });
  assert.deepEqual(old,{settings:{eventSettings:{autoFixedEnabled:false,autoLoopBoundaryEnabled:false,gapMs:0},customColor:'#123456'},values:[0,8],cells:2});
  const source=fs.readFileSync(path.join(__dirname,'fixtures/trace-chunks-checkerboard.cpp'),'utf8').replace(/\r\n/g,'\n');
  const replyPromise=page.waitForResponse(r=>r.url().endsWith('/compile')&&r.request().method()==='POST');
  await page.evaluate(code=>{aceEditor.setValue(code,-1);window.__traceStart=performance.now();document.getElementById('runBtn').click();},source);
  const response=await replyPromise;
  assert.equal(response.headers()['content-encoding'],'gzip');
  await page.waitForFunction(()=>!document.getElementById('runBtn').classList.contains('loading'),{},{timeout:90000});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const result=await page.evaluate(()=>{
   const doc=ASMTracePlayer.getDocument(),frame=doc.frames[0];
   const vars=Object.values(doc.variables);const grid=vars.find(v=>v.name==='grid'),arr=vars.find(v=>v.name==='arr');
   const data=frame.state[grid.id].data.items;
   const cells=[...document.querySelectorAll('#asm-trace-root g[data-trace-index]')];
   const fills=[...new Set([...document.querySelectorAll('#asm-trace-root [fill]')].map(c=>c.getAttribute('fill')))];
   return {elapsed:performance.now()-window.__traceStart,frames:doc.frames.length,events:frame.events.length,
    increasing:frame.events.every((e,i)=>i===0||e.order>frame.events[i-1].order),
    arrLength:frame.state[arr.id].data.items.length,rows:data.length,
    checkerboard:data.every((row,i)=>row.items.length===100&&row.items.every((v,j)=>v.value===(i+j)%2)),
    cells:cells.length,fills,settings:doc.studio.eventSettings,output:document.getElementById('outputArea').textContent,
    studio:document.body.classList.contains('asm-trace-studio-open')};
  });
  assert.equal(result.output,'完成');assert.equal(result.frames,1);assert.equal(result.events,96013);
  assert.equal(result.increasing,true);assert.equal(result.arrLength,1000);assert.equal(result.rows,100);
  assert.equal(result.checkerboard,true);assert.equal(result.cells,11000);assert.equal(result.studio,false);
  assert.equal(result.settings.autoFixedEnabled,false);assert.equal(result.settings.autoLoopBoundaryEnabled,false);
  assert.ok(result.fills.includes('rgba(165, 214, 167, 0.6)'),JSON.stringify(result.fills));
  assert.ok(result.fills.includes('rgba(239, 154, 154, 0.6)'),JSON.stringify(result.fills));
  assert.deepEqual(errors,[]);
  const out=path.join(root,'test-results/trace-chunks');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'browser-summary.json'),JSON.stringify(result,null,2));
  await page.evaluate(()=>{
   const rect=document.querySelector('#asm-trace-root g[data-trace-index="50,50"] > rect');
   const box=rect.getBBox();
   const point=new DOMPoint(box.x+box.width/2,box.y+box.height/2)
    .matrixTransform(rect.getScreenCTM()).matrixTransform(getViewport().getScreenCTM().inverse());
   setCamera(point.x,point.y,0.8,false);
  });
  await page.waitForFunction(()=>document.querySelector('#asm-trace-root g[data-trace-index="50,50"] > text'));
  await page.screenshot({path:path.join(out,'checkerboard.png')});
  console.log(JSON.stringify(result));
  await browser.close();browser=null;
  // One existing targeted fixture checks real marker, hidden target and lifetime semantics.
  const {NODE_TEST_CONTEXT, ...childEnvironment}=process.env;
  const preflightOutput=execFileSync(process.execPath,['--test','tests/studio-availability-preflight.browser.test.js'],{cwd:root,env:{...childEnvironment,ASM_TEST_BASE_URL:base},windowsHide:true,timeout:90000,encoding:'utf8'});
  assert.match(preflightOutput,/# pass 1/);
  console.log(preflightOutput);
 }finally{await browser?.close();server.kill();}
});
