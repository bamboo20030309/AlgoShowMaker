const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const net=require('node:net');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const {chromium}=require('playwright');

test('Queens explains only initially empty P before returning',{timeout:90000},async()=>{
  const root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'algorithm_sample/Backtracking/8queen_recursion.cpp'),'utf8');
  const port=await new Promise(resolve=>{const p=net.createServer();p.listen(0,'127.0.0.1',()=>{const n=p.address().port;p.close(()=>resolve(n));});});
  const server=spawn(process.execPath,['server.js'],{cwd:root,env:{...process.env,PORT:String(port),ASM_REGRESSION:'1',JWT_SECRET:randomBytes(32).toString('hex')},windowsHide:true,stdio:'ignore'});
  let browser;
  try {
    const base=`http://127.0.0.1:${port}`;
    for(let i=0;i<80;i++){try{if((await fetch(base)).ok)break;}catch{} await new Promise(r=>setTimeout(r,200));}
    browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ASMTracePlayer && window.ace);
    await page.waitForTimeout(800);
    await page.evaluate(code=>{ace.edit('editor').setValue(code,-1);document.getElementById('inputArea').value='4';},source);
    await page.locator('#runBtn').click();
    await page.waitForFunction(()=>!document.getElementById('runBtn').classList.contains('loading') && ASMTracePlayer.getDocument()?.frames.length>10,null,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const doc=ASMTracePlayer.getDocument();
      const id=name=>Object.entries(doc.variables).find(([,v])=>v.name===name)?.[0];
      const scalar=(frame,name)=>Number(ASMTraceModel.scalarValue(frame.state[id(name)]?.data));
      const indices=doc.frames.map((f,i)=>JSON.stringify(f.texts).includes('返回上一列')?i:-1).filter(i=>i>=0);
      const notices=indices.map(i=>({P:scalar(doc.frames[i],'P'),n:scalar(doc.frames[i],'n'),beforeP:scalar(doc.frames[i-1],'P'),sameActivation:doc.frames[i].source.recursionActivationId===doc.frames[i-1].source.recursionActivationId}));
      const computedZero=doc.frames.filter(f=>JSON.stringify(f.texts).includes('再與 (1 << N) - 1') && scalar(f,'P')===0).length;
      await ASMTracePlayer.renderStable(indices[0]-1);
      await CodeScript.next();
      const visible=document.getElementById('asm-trace-root').textContent.includes('返回上一列');
      await ASMTracePlayer.renderStable(indices[0]-1);
      return {notices,computedZero,visible,output:document.getElementById('outputArea').textContent,snapshots:doc.snapshots.length};
    });
    assert.ok(result.notices.length>0);
    assert.equal(result.notices.length,result.computedZero);
    for(const notice of result.notices){assert.equal(notice.P,0);assert.equal(notice.beforeP,0);assert.ok(notice.n>0);assert.ok(notice.sameActivation);}
    assert.equal(result.visible,true);
    assert.match(result.output,/Total Solutions: 2/);
    assert.equal(result.snapshots,17);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify(result));
  } finally {if(browser)await browser.close();server.kill();}
});
