'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const{createLoader}=require('../public/sample-trace-assets');
test('obsolete public Trace loader never downloads cached results',async()=>{
 let requests=0;const loader=createLoader(async()=>{requests++;});await assert.rejects(loader('a'.repeat(64)),e=>e.code==='TRACE_NOT_FOUND');assert.equal(requests,0);
});
test('legacy publisher cannot recreate public Trace result files',()=>{
 assert.throws(()=>require('../scripts/build/sample-trace-assets').registerDeckTraces(),/disabled/);
 assert.ok(!fs.existsSync('public/deck-traces')||!fs.readdirSync('public/deck-traces',{recursive:true}).some(n=>n.endsWith('.json')));
});
test('retired public routes return 410 before static fallback',()=>{
 let handler;require('../sample-trace-route').registerSampleTraceRoute({use(prefix,fn){assert.equal(prefix,'/deck-traces');handler=fn;}});
 const response={setHeader(name,value){assert.equal(name,'Cache-Control');assert.equal(value,'no-store');},status(code){assert.equal(code,410);return this;},json(value){assert.equal(value.code,'TRACE_NOT_FOUND');}};handler({},response);
});
