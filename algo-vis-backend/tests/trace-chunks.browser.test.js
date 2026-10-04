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
   const doc={schemaVersion:'1.0',variables:{a:{id:'a',name:'a',kind:'sequence'}},frames:[{id:'old',source:{},events:[{id:'legacy',order:0,type:'assign',signature:'assign:legacy',enabled:false,targets:[],payload:{before:3,after:8}}],state:{a:{name:'a',data:{kind:'sequence',items:[{kind:'scalar',value:0},{kind:'scalar',value:8}]}}}}],studio:{eventSettings:{autoFixedEnabled:false,autoLoopBoundaryEnabled:false,gapMs:0},eventInstructionStates:{'assign:legacy':false},customColor:'#123456'}};
   ASMTracePlayer.apply(doc);
   const saved=JSON.stringify(ASMTracePlayer.getDocument());
   const reopened=ASMTracePlayer.apply(JSON.parse(saved));
   return {legacy:reopened.frames[0].events.map(e=>({id:e.id,enabled:e.enabled,after:e.payload.after})),settings:reopened.studio,values:reopened.frames[0].state.a.data.items.map(v=>v.value),cells:document.querySelectorAll('#asm-trace-root g[data-trace-index]').length};
  });
  assert.deepEqual(old,{legacy:[{id:'legacy',enabled:false,after:8}],settings:{eventSettings:{autoFixedEnabled:false,autoLoopBoundaryEnabled:false,gapMs:0,defaultEnabled:{},timelineTypes:{}},eventInstructionStates:{'assign:legacy':false},customColor:'#123456'},values:[0,8],cells:2});
  const source=fs.readFileSync(path.join(__dirname,'fixtures/trace-chunks-checkerboard.cpp'),'utf8').replace(/\r\n/g,'\n').replace(/@style grid background/g,'@style grid[0:100][0:100] background');
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
    hasOutput:frame.events.some(event=>event.type==='output'&&event.afterCapture===true),
    arrLength:frame.state[arr.id].data.items.length,rows:data.length,
    checkerboard:data.every((row,i)=>row.items.length===100&&row.items.every((v,j)=>v.value===(i+j)%2)),
    cells:cells.length,fills,settings:doc.studio.eventSettings,output:document.getElementById('outputArea').textContent,
    studio:document.body.classList.contains('asm-trace-studio-open')};
  });
  assert.equal(result.output,'完成');assert.equal(result.frames,1);assert.ok(result.events>0);assert.equal(result.hasOutput,true);
  assert.equal(result.increasing,true);assert.equal(result.arrLength,1000);assert.equal(result.rows,100);
  assert.equal(result.checkerboard,true);assert.equal(result.cells,11000);assert.equal(result.studio,false);
  assert.equal(result.settings.autoFixedEnabled,false);assert.equal(result.settings.autoLoopBoundaryEnabled,false);
  assert.ok(result.fills.includes('rgba(165, 214, 167, 0.6)'),JSON.stringify(result.fills));
  assert.ok(result.fills.includes('rgba(239, 154, 154, 0.6)'),JSON.stringify(result.fills));
  assert.deepEqual(errors,[]);
  for(let cycle=0;cycle<3;cycle++){
    await page.evaluate(()=>{ASMTraceStudio.open();ASMTraceStudio.close();});
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    assert.equal(await page.locator('#asm-trace-root [data-asm-lod]').count(),2);
    assert.equal(await page.locator('#asm-trace-root g[data-trace-index] > text').count(),0);
    assert.ok(await page.locator('#asm-trace-root [data-asm-lod-batch]').count()>0);
  }
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
  async function compileRaw(code,input='') {
    const post=async(endpoint,body)=>{const response=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.ok,true);assert.ok(!result.error,result.error);return result;};
    const analysis=await post('/trace/analyze',{code});
    return post('/compile',{code,input,trace:{enabled:true,watches:[...new Set(analysis.frameDirectives.flatMap(frame=>frame.variableIds))],sliceMode:'manual'}});
  }
  const windowSource=`#include <bits/stdc++.h>
using namespace std;
int main(){
 int x=0;
 vector<int> arr={3,1,2};
 x += 5;
 // @keep x as "seed"
 // @frame arr,x
 for(int i=0;i<2;i++){
  x++;
  arr[0]+=x;
  // @frame arr,x
 }
 x = 999;
 cout<<x;
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */`;
  const interval=await compileRaw(windowSource),doc=interval.traceDocument;
  assert.equal(interval.output,'999');assert.equal(doc.frames.length,3);
  const variable=Object.values(doc.variables).find(v=>v.name==='x');
  assert.deepEqual(doc.frames.map(f=>f.state[variable.id].data.value),[5,6,7]);
  const initialLine=windowSource.split('\n').indexOf(' x += 5;')+1;
  const trailingLine=windowSource.split('\n').indexOf(' x = 999;')+1;
  assert.ok(doc.frames[0].events.some(event=>event.line===initialLine));
  assert.ok(doc.frames.at(-1).events.some(event=>event.line===trailingLine&&event.afterCapture===true));
  assert.ok(doc.frames.slice(1).every(f=>f.events.some(e=>e.type==='write'||e.type==='assign')));
  assert.ok(doc.frames.every(f=>f.events.every((e,i,a)=>Number.isFinite(e.order)&&(i===0||a[i-1].order<e.order))));
  const seed=doc.snapshots.find(snapshot=>snapshot.label.startsWith('seed'));
  assert.equal(seed?.data.value,5,'initial keep is scene data, not an initial animation');
  const roundtrip=await page.evaluate(async trace=>{
    ASMTracePlayer.apply(trace);
    const before=document.querySelectorAll('#asm-trace-root [data-trace-snapshot]').length;
    await ASMTracePlayer.render(1);await ASMTracePlayer.render(2);await ASMTracePlayer.render(0);
    const saved=JSON.stringify(ASMTracePlayer.getDocument());
    const reopened=ASMTracePlayer.apply(JSON.parse(saved));
    await ASMTracePlayer.renderStable(2);
    return {before,index:ASMTracePlayer.getCurrentFrame(),seed:reopened.snapshots.find(s=>s.label.startsWith('seed')).data.value,disabled:reopened.studio.eventSettings.autoFixedEnabled};
  },doc);
  assert.ok(roundtrip.before>0);assert.equal(roundtrip.index,2);assert.equal(roundtrip.seed,5);assert.equal(roundtrip.disabled,false);
  // One small sorting fixture exercises retained middle compare/swap events.
  const bubble=await compileRaw(fs.readFileSync(path.join(__dirname,'fixtures/bubble.cpp'),'utf8'),'3\n3 1 2\n');
  const sorted=bubble.traceDocument,arr=Object.values(sorted.variables).find(v=>v.name==='arr');
  assert.deepEqual(sorted.frames.at(-1).state[arr.id].data.items.map(v=>v.value),[1,2,3]);
  assert.equal(sorted.frames.flatMap(f=>f.events).filter(e=>e.type==='swap').length,2);
  await page.evaluate(async trace=>{ASMTracePlayer.apply(trace);await ASMTracePlayer.render(1);await ASMTracePlayer.renderStable(trace.frames.length-1);},sorted);
  assert.deepEqual(errors,[]);
  await browser.close();browser=null;
  // One existing targeted fixture checks real marker, hidden target and lifetime semantics.
  const {NODE_TEST_CONTEXT, ...childEnvironment}=process.env;
  const preflightOutput=execFileSync(process.execPath,['--test','tests/studio-availability-preflight.browser.test.js'],{cwd:root,env:{...childEnvironment,ASM_TEST_BASE_URL:base},windowsHide:true,timeout:90000,encoding:'utf8'});
  assert.match(preflightOutput,/# pass 1/);
  console.log(preflightOutput);
 }finally{await browser?.close();server.kill();}
});
