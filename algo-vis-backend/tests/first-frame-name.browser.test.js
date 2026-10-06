'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
test('KMP first-frame names stay centered after RUN from hidden canvas tabs', {timeout:90000}, async t => {
 const {base}=await startIsolatedServer(t);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.goto(base+'/algorithm.html');
 await page.waitForFunction(()=>document.body.dataset.defaultAnimationCache==='stored');
 const code=fs.readFileSync(path.join(__dirname,'fixtures/kmp-first-frame.cpp'),'utf8');
 for (const tab of ['tab-canvas','tab-input','tab-debug']) {
  await page.click(`[data-tab="${tab}"]`);
  await page.evaluate(code=>{aceEditor.setValue(code,-1);document.querySelector('#inputArea').value='abababca';window.__nameDone=false;window.addEventListener('asm:compile-finished',()=>window.__nameDone=true,{once:true});document.querySelector('#runBtn').click();},code);
  await page.waitForFunction(()=>window.__nameDone);await page.waitForTimeout(150);
  const labels=await page.evaluate(()=>[...document.querySelectorAll('#asm-trace-root .outerframe-label')].map(label=>{
   const b=label.getBBox(),box=label.parentElement.querySelector(':scope > .outerframe-nb');
   return {name:label.textContent,x:Number(label.getAttribute('x')),y:Number(label.getAttribute('y')),dx:b.x+b.width/2-Number(box.getAttribute('x'))-Number(box.getAttribute('width'))/2,dy:b.y+b.height/2-Number(box.getAttribute('y'))-Number(box.getAttribute('height'))/2};
  }));
  assert.equal((await page.locator('#outputArea').textContent()).trim(),'0 0 1 2 3 4 0 1');
  assert.equal(labels.length,2);for(const label of labels){assert.ok(Math.abs(label.dx)<1,`${tab} ${label.name} horizontal offset ${label.dx}`);assert.ok(Math.abs(label.dy)<1,`${tab} ${label.name} vertical offset ${label.dy}`);}
 }
});
