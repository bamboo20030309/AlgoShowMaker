const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('comma style list renders a highlight box and point on each selected cell and survives reload', {timeout:60000}, async()=>{
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace && window.ASMTracePlayer);
    const code=`int main(){int isprime[4]={1,1,1,1},i=1;
// @frame isprime
// @events animate off
// @style isprime[i] highlight,point
// @for k in [2:3]
// @style isprime[k] highlight,point when k==2
// @endfor
}`;
    await page.evaluate(code=>ace.edit('editor').setValue(code,-1),code);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const id=Object.keys(doc.variables).find(id=>doc.variables[id].name==='isprime');
      const read=()=>[0,1,2,3].map(index=>{
        const visuals=[...document.querySelectorAll('#arraySvg .asm-trace-style-decoration')]
          .filter(wrapper=>wrapper._asmStyleCell?.getAttribute('data-trace-arrow-target-key')===`${id}#${index}` && wrapper.getAttribute('display')!=='none')
          .map(wrapper=>wrapper.firstElementChild).filter(node=>node && node.getAttribute('display')!=='none');
        return {
          highlight:visuals.some(node=>node.tagName.toLowerCase()==='rect' && node.getAttribute('stroke')==='red' && node.getBBox().width>0),
          point:visuals.some(node=>node.tagName.toLowerCase()==='path' && node.getAttribute('fill')==='red' && node.classList.contains('arrow-bounce') && node.getBBox().height>0)
        };
      });
      await player.render(0);
      const original=read();
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(0);
      return {original,reloaded:read()};
    });
    assert.deepEqual(result.original,[{highlight:false,point:false},{highlight:true,point:true},{highlight:true,point:true},{highlight:false,point:false}]);
    assert.deepEqual(result.reloaded,result.original);

    const traceDocument=await page.evaluate(()=>JSON.parse(JSON.stringify(ASMTracePlayer.getDocument())));
    const slides=await browser.newPage({viewport:{width:1440,height:1000}});
    slides.on('pageerror',error=>errors.push(error.message));
    await slides.addInitScript(deck=>localStorage.setItem('asm_reveal_fabric_deck_v5',JSON.stringify(deck)),{groups:[{id:'style-group',slides:[{id:'style-slide',kind:'algorithm-animation',animation:{mode:'trace',code,traceDocument},canvas:{objects:[]},widgets:[]}]}]});
    await slides.goto(base+'/slides.html');
    await slides.waitForFunction(()=>document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length);
    const runtime=slides.frames().find(frame=>frame.url().includes('asmEmbed=runtime'));
    assert.ok(runtime,'algorithm slide runtime loaded');
    const embedded=await runtime.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const id=Object.keys(doc.variables).find(id=>doc.variables[id].name==='isprime');
      const read=()=>[0,1,2,3].map(index=>{
        const visuals=[...document.querySelectorAll('#arraySvg .asm-trace-style-decoration')]
          .filter(wrapper=>wrapper._asmStyleCell?.getAttribute('data-trace-arrow-target-key')===`${id}#${index}` && wrapper.getAttribute('display')!=='none')
          .map(wrapper=>wrapper.firstElementChild).filter(node=>node && node.getAttribute('display')!=='none');
        return {
          highlight:visuals.some(node=>node.tagName.toLowerCase()==='rect' && node.getAttribute('stroke')==='red' && node.getBBox().width>0),
          point:visuals.some(node=>node.tagName.toLowerCase()==='path' && node.getAttribute('fill')==='red' && node.classList.contains('arrow-bounce') && node.getBBox().height>0)
        };
      });
      await player.render(0);
      const original=read();
      player.apply(JSON.parse(JSON.stringify(doc)));
      await player.render(0);
      return {original,reloaded:read()};
    });
    assert.deepEqual(embedded.original,result.original,'embedded cells retain simultaneous highlight and point');
    assert.deepEqual(embedded.reloaded,result.original,'embedded styles survive trace reload');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
