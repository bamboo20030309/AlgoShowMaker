'use strict';
// Export complete animation programs from the published deck catalog. Never
// load Trace payloads or turn explanatory code fragments into runnable files.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const backend=path.resolve(__dirname,'../..');
const definitions={
 'quick-sort':[['quick-sort','快速排序']],
 'merge-sort':[['merge-sort-recursive','合併排序－遞迴版'],['merge-sort-recursive','合併排序－遞迴版'],['merge-sort-iterative','合併排序－倍增版'],['merge-sort-iterative','合併排序－倍增版']],
 'bubble-sort':[['bubble-sort','冒泡排序']], 'selection-sort':[['selection-sort','選擇排序']], 'insertion-sort':[['insertion-sort','插入排序']], 'heap-sort':[['heap-sort','堆積排序']],
 'linear-sieve':[['linear-sieve-detailed','線性篩－逐步版'],['linear-sieve-condensed','線性篩－濃縮版']],
 'heap-teaching':[['max-heap-push-pop','堆積－插入與刪除'],['max-heap-incremental-build','堆積－逐筆建堆'],['max-heap-bottom-up-build','堆積－由下而上建堆']],
 'binary-indexed-tree-teaching':[['bit-build','BIT－一般建樹'],['bit-linear-build','BIT－線性建樹'],['bit-range-query','BIT－區間查詢']],
 'segment-tree-teaching':[['segment-tree-recursive-build','線段樹－遞迴建樹'],['segment-tree-recursive-lazy','線段樹－遞迴區間操作'],['segment-tree-iterative-build','線段樹－迭代建樹'],['segment-tree-iterative-lazy','線段樹－迭代區間操作']],
 'hanoi-teaching':[['hanoi','河內塔']],
 'eight-queens-teaching':[['eight-queens-loop','八皇后－一般迴圈'],['eight-queens-array-recursion','八皇后－陣列遞迴'],['eight-queens-bitmask','八皇后－位元運算']],
 'fibonacci-teaching':[['fibonacci-recursive','費式數列－遞迴'],['fibonacci-array','費式數列－陣列']],
 'prefix-sum':[['prefix-sum-1d','一維前綴和'],['prefix-sum-2d','二維前綴和']],
 'lcs-teaching':[['lcs-table','LCS－建表'],['lcs-backtracking','LCS－回溯']]
};
const preferredPaths={"quick-sort":"Sorting/quick_sort.cpp","merge-sort-recursive":"Sorting/merge_sort.cpp","bubble-sort":"Sorting/bubble_sort.cpp","selection-sort":"Sorting/selection_sort.cpp","insertion-sort":"Sorting/insertion_sort.cpp","heap-sort":"Sorting/heap_sort.cpp","hanoi":"Backtracking/hanoi.cpp","eight-queens-bitmask":"Backtracking/8queen.cpp","linear-sieve-detailed":"Math/euler_sieve.cpp","eight-queens-array-recursion":"Backtracking/8queen_array_teaching.cpp","eight-queens-loop":"Backtracking/8queen_loop_teaching.cpp","lcs-table":"DP/LCS.cpp"};
const canonical=text=>String(text||'').replace(/\r\n?/g,'\n');
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
async function exportSlideSamples({root=backend}={}){
 const publicRoot=path.join(root,'public'),sampleRoot=path.join(root,'algorithm_sample');
 const provenance=require('../../public/trace-provenance');
 provenance.configure({generationFingerprint:require('../../trace-generation').generationFingerprint(root)});
 const A=require('../../public/asmdeck');
 const catalog=JSON.parse(await fs.readFile(path.join(publicRoot,'guest-decks.json'),'utf8'));
 const manifestPath=path.join(sampleRoot,'.slide-samples.json');
 let previous;try{previous=JSON.parse(await fs.readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 const managed=new Set((previous?.entries||[]).map(entry=>entry.path));
 const entries=[],byCode=new Map(),files=new Map();let animationCount=0;
 for(const deck of catalog.decks){
  const archive=path.resolve(publicRoot,'.'+deck.archive.split('?')[0]);
  if(!archive.startsWith(publicRoot+path.sep))throw Error('Deck path escaped public');
  const decoded=await A.decode(new Blob([await fs.readFile(archive)]));
  const slides=decoded.deck.groups.flatMap(g=>g.slides||[]);let order=0;
  for(const[page,slide]of slides.entries()){
   if(!slide.animation?.code?.trim())continue;
   const a=slide.animation,code=canonical(a.code),hash=digest(code),definition=definitions[deck.id];
   if(!definition)throw Error('Missing sample names for '+deck.id);
   const named=definition.length===1?definition[0]:definition[order];
   if(!named)throw Error('Missing animation name for '+deck.id+'/'+order);
   order++;animationCount++;
   const category=deck.categories?.[0]||'Other',directory=category;
   let entry=byCode.get(deck.id+':'+hash);
   if(!entry){
    let stem=named[0].replace(/-/g,'_');
    let file=preferredPaths[named[0]]||directory+'/'+stem+'.cpp';
    try{await fs.access(path.join(sampleRoot,file));if(!managed.has(file)&&!preferredPaths[named[0]])throw Error('Unmapped filename collision: '+file);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(files.has(file))throw Error('Different programs share a filename: '+file);
    files.set(file,code);
    entry={path:file,title:named[1],sourceDeckId:deck.id,sourceDeckTitle:deck.title,codeSha256:hash,slides:[],inputs:[]};
    entries.push(entry);byCode.set(deck.id+':'+hash,entry);
   }
   const input=canonical(a.input),existing=entry.inputs.find(v=>v.sha256===digest(input));let inputRecord=existing;
   if(!existing){
    const variant=entry.inputs.length===0?'sample_input':'input_'+String(entry.inputs.length+1).padStart(2,'0');
    const inputPath=entry.path.replace(/\.cpp$/,'-'+variant+'.txt');
    files.set(inputPath,input);
    inputRecord={path:inputPath,sha256:digest(input)};entry.inputs.push(inputRecord);
   }
   entry.slides.push({slideId:slide.id,page:page+1,inputPath:inputRecord.path});
  }
 }
 const manifest={schema:2,source:'public/guest-decks.json',deckCount:catalog.decks.length,animationCount,entries,legacyUnconverted:previous?.legacyUnconverted||[],retiredAliases:previous?.retiredAliases||[]};
 for(const[relative,content]of files){const target=path.join(sampleRoot,relative);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,content,'utf8');}
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 return manifest;
}
if(require.main===module)exportSlideSamples().then(m=>console.log(JSON.stringify({decks:m.deckCount,animations:m.animationCount,programs:m.entries.length,inputs:m.entries.reduce((n,e)=>n+e.inputs.length,0)}))).catch(e=>{console.error(e);process.exitCode=1});
module.exports={exportSlideSamples,canonical,digest};
