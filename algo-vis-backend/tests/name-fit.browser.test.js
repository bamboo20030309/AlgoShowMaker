const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('outerframe names fit narrow and growing frames, keep, and stored font limits', {timeout:60000}, async()=>{
  const {trace}=await compile(`#include <vector>
using namespace std;
int main(){vector<int> a;vector<vector<int>> grid={{1}};
// @frame a as very_long_visual_identifier
// @object grid as long_matrix_identifier
// @keep last as "saved"
a.push_back(1);
// @frame a as very_long_visual_identifier
a.push_back(2);a.push_back(3);a.push_back(4);a.push_back(5);a.push_back(6);a.push_back(7);a.push_back(8);
// @frame a as very_long_visual_identifier
return 0;}`);
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try{
    const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto(process.env.ASM_TEST_BASE_URL+'/algorithm.html');
    const report=await page.evaluate(async trace=>{
      const violations=[], fonts=[];
      const inspect=()=>{
        for(const label of document.querySelectorAll('#asm-trace-root .outerframe-label')){
          const nb=label.parentElement.querySelector(':scope > .outerframe-nb');
          if(!nb)continue;
          const text=label.getBBox(),box=nb.getBBox();
          if(text.x<box.x+3 || text.x+text.width>box.x+box.width-3
            || text.y<box.y || text.y+text.height>box.y+box.height){
            violations.push({name:label.textContent,font:label.getAttribute('font-size'),text:{x:text.x,y:text.y,width:text.width,height:text.height},box:{x:box.x,y:box.y,width:box.width,height:box.height}});
          }
        }
      };
      const loaded=window.ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace)));
      for(const index of [0,1,2]){
        await window.ASMTracePlayer.render(index,{stable:true});inspect();
        const live=[...document.querySelectorAll('#asm-trace-root .outerframe-label')].find(l=>!l.closest('[data-trace-snapshot]'));
        fonts.push(Number(live.getAttribute('font-size')));
      }
      for(const speed of [1,4]){
        window.asmGetAnimationPlaybackRate=()=>speed;
        await window.ASMTracePlayer.render(1,{stable:true});
        let done=false;
        const pending=window.ASMTracePlayer.render(2,{fromIndex:1,forceTransition:true}).finally(()=>done=true);
        while(!done){await new Promise(requestAnimationFrame);inspect();}
        await pending;inspect();
      }
      const old=JSON.parse(JSON.stringify(loaded));
      delete old.frames[0].source.objectId;delete old.frames[0].source.objectIds;
      old.studio.eventSettings={...(old.studio.eventSettings||{}),autoFixedEnabled:false};
      old.studio.objectStyles={ [old.frames[2].id]:{['very_long_visual_identifier:label']:{fontSize:12,fill:'#ff0000'}} };
      window.ASMTracePlayer.apply(old);
      await window.ASMTracePlayer.render(0,{stable:true});inspect();
      const legacyName=[...document.querySelectorAll('#asm-trace-root .outerframe-label')].map(l=>l.textContent);
      const saved=JSON.parse(JSON.stringify(window.ASMTracePlayer.getDocument()));
      window.ASMTracePlayer.apply(saved);
      await window.ASMTracePlayer.render(2,{stable:true});inspect();
      const label=[...document.querySelectorAll('#asm-trace-root .outerframe-label')].find(l=>!l.closest('[data-trace-snapshot]'));
      return {violations,fonts,legacyName,customFont:Number(label.getAttribute('font-size')),color:label.getAttribute('fill'),
        customStored:window.ASMTracePlayer.getDocument().studio.objectStyles[old.frames[2].id]['very_long_visual_identifier:label'].fontSize,
        disabled:window.ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled};
    },trace);
    assert.deepEqual(report.violations,[]);
    assert.ok(report.fonts[0]<report.fonts[2]);assert.equal(report.fonts[2],16);
    assert.ok(report.legacyName.includes('a'));
    assert.equal(report.customFont,12);assert.equal(report.customStored,12);
    assert.equal(report.color,'#ff0000');assert.equal(report.disabled,false);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
