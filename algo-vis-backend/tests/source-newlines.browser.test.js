const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawn}=require('node:child_process');const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'fixtures/kmp-source-newlines.cpp'),'utf8').replace(/\r\n?/g,'\n');
test('KMP CRLF API requests and editor imports preserve LF positions and old saved settings',{timeout:120000},async()=>{
 const root=path.resolve(__dirname,'..');
 const port=await new Promise(resolve=>{const socket=net.createServer().listen(0,'127.0.0.1',()=>{const p=socket.address().port;socket.close(()=>resolve(p));});});
 const base=`http://127.0.0.1:${port}`;
 const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),ASM_REGRESSION:'1',JWT_SECRET:require('node:crypto').randomBytes(32).toString('hex')},windowsHide:true,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/algorithm.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  const post=async(endpoint,body)=>{const response=await fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.ok,true,JSON.stringify(result));assert.ok(!result.error,result.error);return result;};
  let mixed=0;const inputs=[source,source.replace(/\n/g,'\r\n'),source.replace(/\n/g,()=>mixed++%2?'\r\n':'\n'),source.replace(/\n/g,'\r')];
  let baseline,baselineTree,baselinePlan;
  for(const code of inputs){
   const syntax=await post('/syntax-tree',{code}),analysis=await post('/trace/analyze',{code});
   const reply=await post('/compile',{code,input:'ababac\n',trace:{enabled:true,watches:[...new Set(analysis.frameDirectives.flatMap(f=>f.variableIds))],sliceMode:'manual'}});
   assert.equal(reply.output.trim(),'0 0 1 2 3 0');assert.equal(reply.traceDocument.sourceCode,source);
   const doc=reply.traceDocument,p=Object.values(doc.variables).find(v=>v.name==='p');
   assert.deepEqual(doc.frames.at(-1).state[p.id].data.items.map(v=>v.value),[0,0,1,2,3,0]);
   const plan=doc.frames.map(frame=>({line:frame.source.line,state:frame.state[p.id].data,events:frame.events.map(e=>({type:e.type,line:e.line,from:e.source?.from,to:e.source?.to,text:e.source?.text}))}));
   if(!baseline){baseline=doc;baselineTree=syntax;baselinePlan=plan;}
   else{assert.deepEqual(syntax,baselineTree);assert.deepEqual(plan,baselinePlan);}
  }
  browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/algorithm.html',{waitUntil:'networkidle'});
  await page.evaluate(code=>{aceEditor.setValue(code,-1);document.getElementById('inputArea').value='ababac\n';document.getElementById('runBtn').click();},inputs[1]);
  await page.waitForFunction(()=>!document.getElementById('runBtn').classList.contains('loading'),{},{timeout:90000});
  assert.equal((await page.locator('#outputArea').textContent()).trim(),'0 0 1 2 3 0');
  assert.equal(await page.evaluate(()=>aceEditor.getValue().includes('\r')),false);
  const highlight=await page.evaluate(async()=>{
   await ASMTracePlayer.renderStable(1);
   const line=ASMTracePlayer.getDocument().frames[1].source.line;
   return {line,markers:Object.values(aceEditor.session.getMarkers()).filter(m=>m.clazz==='code-highlight-line').map(m=>m.range.start.row+1),text:aceEditor.session.getLine(line-1)};
  });
  assert.ok(highlight.markers.includes(highlight.line));assert.match(highlight.text,/@frame/);
  await page.evaluate(()=>ASMTraceStudio.open());
  await page.evaluate(()=>ASMTraceStudio.close());
  const old={...baseline,sourceCode:inputs[1],studio:{...baseline.studio,eventSettings:{...baseline.studio?.eventSettings,autoFixedEnabled:false,autoLoopBoundaryEnabled:false,gapMs:0},customColor:'#123456'}};
  const roundtrip=await page.evaluate(async trace=>{
   aceEditor.setValue(trace.sourceCode,-1);
   ASMTraceEditor.applyTraceDocument(trace,{openStudio:false,preserveEventSettings:true});
   await ASMTracePlayer.renderStable(1);
   const saved=JSON.stringify(ASMTracePlayer.getDocument());
   const reopened=ASMTraceEditor.applyTraceDocument(JSON.parse(saved),{openStudio:false,preserveEventSettings:true});
   ASMAlgorithmDraft.save();
   return {settings:reopened.studio.eventSettings,color:reopened.studio.customColor,source:aceEditor.getValue()};
  },old);
  assert.equal(roundtrip.settings.autoFixedEnabled,false);assert.equal(roundtrip.settings.autoLoopBoundaryEnabled,false);assert.equal(roundtrip.settings.gapMs,0);assert.equal(roundtrip.color,'#123456');assert.equal(roundtrip.source,source);
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.evaluate(()=>aceEditor.getValue()),source);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({formats:inputs.length,frames:baseline.frames.length,nodes:baselineTree.nodeCount,highlight}));
 }finally{await browser?.close();server.kill();}
});
