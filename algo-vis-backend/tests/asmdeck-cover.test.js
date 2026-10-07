const {test}=require('node:test');const assert=require('node:assert/strict');
global.ASMTraceProvenance=require('../public/trace-provenance');const archive=require('../public/asmdeck');
const pixel='data:image/png;base64,AAAA';
const fixture=()=>({deck:{groups:[{id:'g',slides:[{id:'s',canvas:{objects:[]},widgets:[]}]}]},assets:{},cover:{title:'封面',categories:['排序'],tags:['分治'],updatedAt:'2026-10-07T00:00:00Z',thumbnail:pixel}});
test('cover reads only prefix and preview, and custom metadata round-trips',async()=>{
 const blob=await archive.encode(fixture());const reads=[];
 const file={size:blob.size,slice(start,end){reads.push([start,end]);return blob.slice(start,end)},arrayBuffer(){throw Error('full body must not be read')}};
 const cover=await archive.readCover(file);assert.equal(reads.length,2);assert.equal(reads[1][1],cover.bodyOffset);assert.ok(cover.bodyOffset<blob.size);
 assert.equal(cover.title,'封面');assert.equal(cover.slideCount,1);assert.equal(cover.updatedAt,'2026-10-07T00:00:00Z');assert.deepEqual(cover.categories,['排序']);
 const reopened=await archive.decode(blob);assert.equal(reopened.cover.thumbnail,pixel);
 const badCover={...cover,title:'changed'};delete badCover.bodyOffset;const data=new TextEncoder().encode(JSON.stringify(badCover));const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,data.length,true);
 await assert.rejects(archive.decode(new Blob([archive.COVER_MAGIC,length,data,blob.slice(cover.bodyOffset)])),/封面雜湊/);
});
test('remote cover uses two bounded range requests, never a full-download fallback',async()=>{
 const blob=await archive.encode(fixture());const ranges=[];
 const fetcher=async(url,options)=>{const [start,end]=options.headers.Range.match(/\d+/g).map(Number);ranges.push([start,end]);return new Response(await blob.slice(start,end+1).arrayBuffer(),{status:206})};
 const cover=await archive.readCoverURL('/fixture.asmdeck',fetcher);assert.equal(ranges.length,2);assert.equal(ranges[1][1]+1,cover.bodyOffset);
 let cancelled=false;await assert.rejects(archive.readCoverURL('/unsupported',async()=>({status:200,body:{cancel:async()=>{cancelled=true}}})),/不支援/);assert.ok(cancelled);
});
test('old covers remain optional and malformed lengths fail before content parsing',async()=>{
 const {gzipSync}=require('node:zlib');const body={deck:fixture().deck,assets:{}};
 const old=new Blob([archive.MAGIC,gzipSync(JSON.stringify({manifest:{format:'AlgoShowMaker.asmdeck',packageVersion:1,engineVersion:archive.engineVersion(),contentHash:await archive.sha256(JSON.stringify(body)),assetHashes:[]},body}))]);
 assert.equal(await archive.readCover(old),null);assert.equal((await archive.decode(old)).deck.groups.length,1);
 const malformed=new Uint8Array(4);new DataView(malformed.buffer).setUint32(0,0xffffffff,true);
 await assert.rejects(archive.readCover(new Blob([archive.COVER_MAGIC,malformed,'{}'])),/長度無效/);
});
test('static server serves a cover through actual HTTP ranges',async t=>{
 const fs=require('node:fs');const path=require('node:path');
 const name='cover-fixture-'+require('node:crypto').randomUUID()+'.asmdeck';
 const file=path.join(__dirname,'../public',name);const blob=await archive.encode(fixture());
 fs.writeFileSync(file,Buffer.from(await blob.arrayBuffer()));t.after(()=>fs.unlinkSync(file));
 const {base}=await require('./helpers/isolated-server').startIsolatedServer(t);
 let transferred=0,requests=0;
 const cover=await archive.readCoverURL(base+'/'+name,async(url,options)=>{
   const result=await fetch(url,options);assert.equal(result.status,206);
   transferred+=Number(result.headers.get('content-length'));requests++;return result;
 });
 assert.equal(requests,2);assert.equal(transferred,cover.bodyOffset);assert.ok(transferred<blob.size);
});
