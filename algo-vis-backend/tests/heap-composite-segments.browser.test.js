const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('heap fields and local segments render at root and child coordinates', {timeout:60000}, async () => {
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace&&window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'fixtures/heap-composite-segments.cpp'),'utf8').replace(/\r\n?/g,'\n');
    await page.evaluate(code=>ace.edit('editor').setValue(code,-1),code);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const byName=Object.fromEntries(Object.entries(doc.variables).map(([id,value])=>[value.name,id]));
      const indices={};
      for(const name of ['tree','pairs','tuples','arr'])indices[name]=doc.frames.findIndex(frame=>frame.state[byName[name]]);
      const treeFrames=doc.frames.map((frame,index)=>({frame,index})).filter(item=>item.frame.renderers?.[byName.tree]==='original-heap');
      const readTree=async index=>{
        await player.render(index,{animatePositions:false,animateEvents:false});
        const root=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
        const scene=root.closest('#asm-trace-root');
        const cell=indexValue=>root.querySelector(`[data-trace-index="${indexValue}"]`);
        const seg=node=>[...scene.querySelectorAll(`.asm-trace-heap-cell-segment[data-trace-segment-node="${node}"]`)].map(rect=>({
          id:rect.dataset.traceSegmentId,start:+rect.dataset.traceSegmentStart,end:+rect.dataset.traceSegmentEnd,
          identity:rect.dataset.traceRuntimeIdentity,count:+rect.dataset.traceSegmentCount,
          width:+rect.getAttribute('width'),base:+cell(node).querySelector(':scope > rect').getAttribute('width'),
          styleLayer:Boolean(rect.closest('.asm-trace-style-layer')),nestedInCell:cell(node).contains(rect)
        }));
        const children=[...scene.children];
        return {
          texts:[1,2,3,4].map(i=>cell(i).querySelector(':scope > text').textContent),
          fills:[2,3].map(i=>cell(i).querySelector(':scope > rect').getAttribute('fill')),
          root:seg(1),child:seg(2),empty:seg(3),
          styleBeforeArrows:children.findIndex(node=>node.classList.contains('asm-trace-style-layer'))
            < children.findIndex(node=>node.classList.contains('asm-trace-foreground-arrows'))
        };
      };
      const first=await readTree(treeFrames[0].index),second=await readTree(treeFrames[1].index);
      await player.render(treeFrames[1].index,{animatePositions:false,animateEvents:false});
      const samples=[];
      let settled=false;
      const transition=player.render(treeFrames[2].index).finally(()=>{settled=true;});
      for(let count=0;count<180&&!settled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const root=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
        const rect=root?.closest('#asm-trace-root')?.querySelector('[data-trace-segment-id="full"]');
        if(rect)samples.push({x:+rect.getAttribute('x'),width:+rect.getAttribute('width')});
      }
      await transition;
      const third=await readTree(treeFrames[2].index);
      const frontiers=[];
      for(const item of treeFrames.slice(3,6)){
        await player.render(item.index,{animatePositions:false,animateEvents:false});
        const root=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
        frontiers.push([...root.closest('#asm-trace-root').querySelectorAll('.asm-trace-heap-cell-segment')].map(rect=>({
          node:+rect.dataset.traceSegmentNode,start:+rect.dataset.traceSegmentStart,
          end:+rect.dataset.traceSegmentEnd,count:+rect.dataset.traceSegmentCount,
          phase:rect.dataset.traceSegmentSplit,identity:rect.dataset.traceRuntimeIdentity
        })).sort((a,b)=>a.node-b.node));
      }
      player.apply(JSON.parse(JSON.stringify(doc)));
      const reload=await readTree(treeFrames[1].index);
      await player.render(indices.pairs,{animatePositions:false,animateEvents:false});
      const pairs=[...document.querySelector(`[data-trace-variable="${byName.pairs}"]`).querySelectorAll('[data-trace-index]')]
        .filter(node=>!node.hasAttribute('data-trace-index-label')).map(node=>node.querySelector(':scope > text')?.textContent).filter(Boolean);
      await player.render(indices.tuples,{animatePositions:false,animateEvents:false});
      const tuples=[...document.querySelector(`[data-trace-variable="${byName.tuples}"]`).querySelectorAll('[data-trace-index]')]
        .filter(node=>!node.hasAttribute('data-trace-index-label')).map(node=>node.querySelector(':scope > text')?.textContent).filter(Boolean);
      await player.render(indices.arr,{animatePositions:false,animateEvents:false});
      return {first,second,third,frontiers,samples,reload,pairs,tuples,legacy:document.querySelectorAll('.asm-trace-segment').length};
    });
    assert.deepEqual(result.first.texts,['15','7,3','8,8','4,2,9']);
    assert.equal(result.first.root.length,2);
    assert.deepEqual(result.first.root.map(item=>[item.start,item.end,item.count]),[[0,7,8],[2,5,8]]);
    assert.equal(result.first.root[0].width,result.first.root[0].base);
    assert.deepEqual(result.first.child.map(item=>[item.start,item.end,item.count]),[[2,3,4]]);
    assert.equal(result.first.child[0].width,result.first.child[0].base/2);
    assert.ok([...result.first.root,...result.first.child].every(item=>item.styleLayer&&!item.nestedInCell));
    assert.equal(result.first.styleBeforeArrows,true);
    assert.deepEqual(result.first.empty,[]);
    assert.deepEqual(result.first.fills,['rgba(144, 202, 249, 0.6)','orange']);
    assert.equal(result.second.texts[0],'15 / 6');
    assert.deepEqual(result.second.root.map(item=>[item.start,item.end,item.count]),[[0,7,8]]);
    assert.equal(result.first.root[0].identity,result.second.root[0].identity);
    assert.equal(result.second.root[0].identity,result.third.root[0].identity);
    assert.deepEqual(result.third.root.map(item=>[item.start,item.end,item.count]),[[1,6,8]]);
    assert.ok(result.samples.some(sample=>sample.x>8&&sample.x<48&&sample.width>240&&sample.width<320),
      'named segment interpolates its local x and width');
    assert.deepEqual(result.frontiers.map(items=>items.map(({node,start,end,count,phase})=>(
      [node,start,end,count,phase]
    ))), [
      [[2,1,3,4,'before'],[3,0,2,4,'before']],
      [[3,0,2,4,'before'],[4,1,1,2,'before'],[5,0,1,2,'before']],
      [[3,0,2,4,'after'],[5,0,1,2,'after']]
    ]);
    assert.equal(result.frontiers[0][1].identity,result.frontiers[1][0].identity);
    assert.equal(result.frontiers[1][0].identity,result.frontiers[2][0].identity);
    assert.deepEqual(result.reload,result.second);
    assert.deepEqual(result.pairs,['5','0 / 5']);
    assert.deepEqual(result.tuples,['1,0,3','0,0,0']);
    assert.equal(result.legacy,1);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
