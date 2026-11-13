const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{chromium}=require('playwright');
const{compile}=require('./helpers/compile'),{startIsolatedServer}=require('./helpers/isolated-server');
test('compound assignment transfers retain subtraction multiplication and division signs',{timeout:90000},async t=>{
 const{base}=await startIsolatedServer(t),old=process.env.ASM_TEST_BASE_URL;let prefix,arithmetic;
 try{process.env.ASM_TEST_BASE_URL=base;prefix=(await compile(fs.readFileSync('tests/fixtures/prefix-2d-compound-signs.cpp','utf8'),fs.readFileSync('tests/fixtures/prefix-2d-compound-signs.txt','utf8'))).trace;arithmetic=(await compile(`#include <vector>
int main(){std::vector<int>a={24,3};
// @frame a
 a[0]*=a[1];
// @frame a
 a[0]/=a[1];
// @frame a
 a[0]=a[1];
// @frame a
}`)).trace;}finally{if(old===undefined)delete process.env.ASM_TEST_BASE_URL;else process.env.ASM_TEST_BASE_URL=old;}
 const event=prefix.frames[31].events.find(e=>e.compound);assert.equal(event.payload.before.value,22);assert.equal(event.payload.source.value,3);assert.equal(event.payload.after.value,19);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/algorithm.html?asmEmbed=runtime');await page.waitForFunction(()=>window.ASMTracePlayer);
 for(const mode of ['fresh','reopened'])for(const speed of [1,4])for(const[c,from,to,expected]of [[prefix,30,31,'-3'],[prefix,29,30,'+16'],[arithmetic,0,1,'*3'],[arithmetic,1,2,'/3'],[arithmetic,2,3,'3']]){
 const report=await page.evaluate(async({trace,from,to,mode,speed})=>{const raw=JSON.parse(JSON.stringify(trace));raw.frames=[raw.frames[from],raw.frames[to]];raw.studio||={};raw.studio.codePanelScrollMs=0;let doc=ASMTracePlayer.apply(raw);if(mode==='reopened')doc=ASMTracePlayer.apply(JSON.parse(JSON.stringify(doc)));window.asmGetAnimationPlaybackRate=()=>speed;window.ASMTraceCamera={...ASMTraceCamera,apply(){},transitionDuration:()=>0};await ASMTracePlayer.render(0,{stable:true});window.setCamera?.(600,400,1,false);window.ASMStructureLOD?.refresh?.();await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
 const native={raf:requestAnimationFrame,cancel:cancelAnimationFrame,now:Object.getOwnPropertyDescriptor(performance,'now')};let clock=performance.now(),elapsed=0,id=0;const callbacks=new Map(),texts=[];requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};cancelAnimationFrame=id=>callbacks.delete(id);Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});const restore=()=>{requestAnimationFrame=native.raf;cancelAnimationFrame=native.cancel;if(native.now)Object.defineProperty(performance,'now',native.now);else delete performance.now;};try{const pending=ASMTracePlayer.render(1,{fromIndex:0,forceTransition:true}),plan=ASMTracePlayer.getLastPlaybackPlan();while(elapsed<Math.min(4000,plan.totalDurationMs+30)/speed){elapsed+=16;clock+=16;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(clock));for(let i=0;i<10;i++)await Promise.resolve();for(const n of document.querySelectorAll('#asm-trace-root .asm-trace-assign-transfer'))texts.push(n.textContent);}restore();ASMTraceFrameTween.cancel();await pending;return{from,to,texts:[...new Set(texts)]};}finally{restore();ASMTraceFrameTween.cancel();}},{trace:c,from,to,mode,speed});
 fs.mkdirSync('test-results/compound-signs',{recursive:true});fs.writeFileSync(`test-results/compound-signs/${mode}-${speed}-${from}-${expected.replace(/\W/g,'s')}.json`,JSON.stringify(report));assert.ok(report.texts.includes(expected),`${mode} ${speed}x ${expected}: ${JSON.stringify(report.texts)}`);
 }
 assert.deepEqual(errors,[]);
});
