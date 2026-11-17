'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),zlib=require('zlib');
test('shipped C++ and deck animation templates use explicit pointers',()=>{
 const failures=[];let sources=0,animations=0,decks=0;
 const inspect=(code,label)=>{sources++;for(const [i,line]of code.split(/\r?\n/).entries()){
  // Only actual directive lines: never rewrite conditions or saved event keys.
  const match=line.match(/^\s*\/\/\s*@(frame|object)\s+(.+)$/);if(!match||/^use\b/.test(match[2]))continue;
  const targets=match[2].split(/\s+(?:with|at|when|render|in|as)\b/)[0];
  if(/\w+\s*\[/.test(targets))failures.push(label+':'+(i+1)+':'+line.trim());
 }};
 const walk=dir=>{for(const name of fs.readdirSync(dir)){const file=path.join(dir,name);if(fs.statSync(file).isDirectory())walk(file);else if(file.endsWith('.cpp'))inspect(fs.readFileSync(file,'utf8'),file);}};
 walk(path.resolve(__dirname,'../algorithm_sample'));inspect(fs.readFileSync(path.resolve(__dirname,'../public/sample_code.cpp'),'utf8'),'sample_code.cpp');
 const dir=path.resolve(__dirname,'../public/guest-decks');for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.asmdeck'))){const b=fs.readFileSync(path.join(dir,name)),offset=b.subarray(0,9).toString()==='ASMDECK2\n'?13+b.readUInt32LE(9):9,pkg=JSON.parse(zlib.gunzipSync(b.subarray(offset)));decks++;
  for(const group of pkg.body.deck.groups||[])for(const slide of group.slides||[])if(slide.animation?.code){animations++;inspect(slide.animation.code,name+'/'+slide.id);}
 }
 assert.ok(sources>30&&decks>=15&&animations>=36,'scan all shipped sources and animations');assert.deepEqual(failures,[],failures.join('\n'));console.log(JSON.stringify({sources,decks,animations}));
});
