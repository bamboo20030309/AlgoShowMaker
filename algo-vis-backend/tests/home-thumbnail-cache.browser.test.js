const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('complete card API loads covers and placeholders without thumbnail or full-deck requests', {timeout:60000}, async t=>{
 const {base}=await startIsolatedServer(t);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage();await page.addInitScript(()=>localStorage.setItem('algo_jwt_token','fixture'));
 const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 let owner='a',lists=0,details=0;
 let decks=[{deck_uid:'one',title:'one',slide_count:5,updated_at:'2026-10-07T01:00:00Z',cover_thumbnail:pixel},
 {deck_uid:'old',title:'old',slide_count:2,updated_at:'2026-10-07T01:00:00Z'}];
 await page.route('**/api/auth/me',r=>r.fulfill({json:{user:{id:owner,username:owner}}}));
 await page.route('**/api/slides',r=>{lists++;return r.fulfill({json:{slides:decks,layout:{folders:[],unfiled:decks.map(d=>d.deck_uid)}}})});
 await page.route('**/api/slide-library',r=>{details++;return r.fulfill({json:{layout:{folders:[],unfiled:[]}}})});
 await page.route('**/api/slides/*',r=>{details++;return r.fulfill({status:500,json:{error:'card view must not fetch details'}})});
 const ready=()=>page.waitForFunction(()=>document.querySelectorAll('#deckGrid .deck-card').length===2&&document.querySelector('#deckGrid .deck-cover-image')?.complete);
 await page.goto(base+'/');await ready();assert.equal(lists,1);assert.equal(details,0);
 assert.equal(await page.locator('#deckGrid .deck-cover-image').count(),1,'legacy cover is a placeholder');
 await page.reload();await ready();assert.equal(lists,2);assert.equal(details,0);
 owner='b';await page.reload();await ready();assert.equal(details,0);
 const retained=await page.evaluate(async pixel=>{for(let i=0;i<66;i++)await ASMHomeThumbnailCache.put('capacity',String(i),'revision',pixel);return (await ASMHomeThumbnailCache.load('capacity',Array.from({length:66},(_,i)=>({deck_uid:String(i),updated_at:'revision'})))).size},pixel);
 assert.equal(retained,64);
 await page.addInitScript(()=>Object.defineProperty(window,'indexedDB',{value:null}));await page.reload();await ready();assert.equal(details,0);
});