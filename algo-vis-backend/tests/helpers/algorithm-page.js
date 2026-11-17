'use strict';
const {sourceText}=require('../../public/trace-provenance');

// Wait for the UI lifecycle, independently of the retired persistent Trace cache.
async function waitForDefaultAlgorithm(page) {
  await page.waitForFunction(()=>document.body.dataset.defaultAnimationState==='ready'
    && window.ASMTracePlayer?.getDocument()?.frames?.length>0);
}

// RUN normalizes line endings and may rewrite only trailing Studio metadata.
async function waitForTraceSource(page, code) {
  await page.waitForFunction(expected=>window.ASMTraceProvenance?.sourceText(
    window.ASMTracePlayer?.getDocument()?.sourceCode||'')===expected
    && !document.getElementById('runBtn')?.classList.contains('loading'),sourceText(code),{timeout:30000});
}
async function showTraceCanvas(page) {
  await page.evaluate(()=>document.querySelector('.tab-btn[data-tab="tab-canvas"]')?.click());
  await page.waitForFunction(()=>document.getElementById('tab-canvas')?.getBoundingClientRect().width>0);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
module.exports={waitForDefaultAlgorithm,waitForTraceSource,showTraceCanvas};
