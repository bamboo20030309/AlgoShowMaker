const {test}=require('node:test');const assert=require('node:assert/strict');
const {chromium}=require('playwright');const {startIsolatedServer}=require('./helpers/isolated-server');
test('public gallery uses complete cached cards and never downloads archives or Trace on homepage',async t=>{
 const {base}=await startIsolatedServer(t);const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();const forbidden=[],errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\.asmdeck(?:\?|$)|\/deck-traces\/|\/compile(?:\?|$)/.test(request.url()))forbidden.push(request.url())});
 await page.route('**/guest-decks/*.asmdeck*',route=>route.abort());
 const catalog=await(await fetch(base+'/guest-decks.json')).json();
 assert.ok(catalog.decks.every(entry=>entry.cover_thumbnail?.startsWith('data:image/jpeg;base64,')&&entry.slide_count>0&&'updated_at'in entry));
 await page.goto(base+'/?examples=1');await page.waitForFunction(count=>{const images=[...document.querySelectorAll('#galleryGrid .deck-cover-image')];return images.length===count&&images.every(image=>image.complete&&image.naturalWidth>0)},catalog.decks.length);
 await page.reload();await page.waitForFunction(count=>document.querySelectorAll('#galleryGrid .deck-cover-image').length===count,catalog.decks.length);
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);
});