'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const {startIsolatedServer}=require('./helpers/isolated-server');
test('third-party notices are accessible without login and preserve complete package notices', {timeout:60000},async t=>{
 const {base}=await startIsolatedServer(t);
 const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});t.after(()=>browser.close());
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);
 const link=page.locator('.site-legal-footer a');assert.equal(await link.innerText(),'第三方授權');
 await link.click();await page.waitForURL('**/licenses/');
 assert.equal(await page.getByRole('heading',{name:'第三方授權',exact:true}).count(),1);
 const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../public/licenses/components.json'),'utf8'));
 assert.equal(await page.locator('details').count(),data.components.length);
 for(const pkg of data.components){assert.ok(pkg.documents.length);assert.ok(pkg.documents.every(d=>d.text.trim().length>100));}
 const iro=data.components.find(p=>p.name==='@jaames/iro');assert.equal(iro.license,'MPL-2.0');assert.match(iro.source,/1825363da88e1971befb6c6b827951594f388798/);
 const full=await(await fetch(base+'/licenses/third-party-notices.txt')).text();
 for(const name of ['@jaames/iro','@irojs/iro-core','preact','fabric','reveal.js','highlight.js','KaTeX','playwright'])assert.ok(full.includes(name),name);
 assert.match(full,/Mozilla Public License Version 2.0/);assert.match(full,/Apache License/);assert.match(full,/Sebastian Mayr/);
 for(const url of ['/vendor/reveal/LICENSE','/vendor/fabric/LICENSE','/vendor/iro/LICENSE.txt','/vendor/ace/LICENSE','/vendor/katex/LICENSE','/licenses/project-license.txt'])assert.equal((await fetch(base+url)).status,200,url);
 const downloaded=page.waitForEvent('download');await page.getByRole('link',{name:'下載完整第三方授權'}).click();const download=await downloaded;assert.equal(fs.readFileSync(await download.path(),'utf8'),full);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:path.join(__dirname,'../test-results/third-party-notices.png'),fullPage:false});
 assert.deepEqual(errors,[]);
});
