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
      await player.render(treeFrames[3].index,{animatePositions:false,animateEvents:false});
      const splitSamples=[];
      let splitSettled=false;
      const splitTransition=player.render(treeFrames[4].index).finally(()=>{splitSettled=true;});
      for(let count=0;count<180&&!splitSettled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const root=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1)?.closest('#asm-trace-root');
        const entering=root?.querySelector('.asm-trace-heap-cell-segment[data-trace-segment-node="4"]');
        const exiting=[...(root?.querySelectorAll('.asm-trace-transition-ghost .asm-trace-heap-cell-segment')||[])]
          .find(rect=>rect.dataset.traceSegmentNode==='2');
        splitSamples.push({
          entering:entering?{y:+entering.getAttribute('y'),height:+entering.getAttribute('height')}:null,
          exiting:exiting?{y:+exiting.getAttribute('y'),height:+exiting.getAttribute('height')}:null
        });
      }
      await splitTransition;
      const splitRoot=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1).closest('#asm-trace-root');
      const splitFinal=splitRoot.querySelector('.asm-trace-heap-cell-segment[data-trace-segment-node="4"]');
      const splitTransitionState={samples:splitSamples,finalHeight:+splitFinal.getAttribute('height')};
      player.apply(JSON.parse(JSON.stringify(doc)));
      const reload=await readTree(treeFrames[1].index);
      await player.render(indices.pairs,{animatePositions:false,animateEvents:false});
      const pairs=[...document.querySelector(`[data-trace-variable="${byName.pairs}"]`).querySelectorAll('[data-trace-index]')]
        .filter(node=>!node.hasAttribute('data-trace-index-label')).map(node=>node.querySelector(':scope > text')?.textContent).filter(Boolean);
      await player.render(indices.tuples,{animatePositions:false,animateEvents:false});
      const tuples=[...document.querySelector(`[data-trace-variable="${byName.tuples}"]`).querySelectorAll('[data-trace-index]')]
        .filter(node=>!node.hasAttribute('data-trace-index-label')).map(node=>node.querySelector(':scope > text')?.textContent).filter(Boolean);
      await player.render(indices.arr,{animatePositions:false,animateEvents:false});
      return {first,second,third,frontiers,samples,splitTransitionState,reload,pairs,tuples,legacy:document.querySelectorAll('.asm-trace-segment').length};
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
    assert.deepEqual(result.first.fills,['rgba(144, 202, 249, 0.6)','rgba(255, 183, 77, 0.65)']);
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
    assert.ok(result.splitTransitionState.samples.some(sample=>(
      sample.entering&&sample.entering.height>0
        &&sample.entering.height<result.splitTransitionState.finalHeight
    )),'new child segment reveals from its top edge downward');
    assert.ok(result.splitTransitionState.samples.some(sample=>(
      sample.exiting&&sample.exiting.y>0
        &&sample.exiting.height>0
        &&sample.exiting.height<result.splitTransitionState.finalHeight
    )),'removed parent segment erases from its top edge downward');
    assert.deepEqual(result.reload,result.second);
    assert.deepEqual(result.pairs,['5','0 / 5']);
    assert.deepEqual(result.tuples,['1,0,3','0,0,0']);
    assert.equal(result.legacy,1);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('standalone segment tree build animates every input and parent sum', {timeout:60000}, async () => {
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace&&window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Tree/Segment_Tree_easy_build.cpp'),'utf8')
      .replace(/\r\n?/g,'\n');
    await page.evaluate(code=>{
      ace.edit('editor').setValue(code,-1);
      document.querySelector('#inputArea').value='15\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15\n';
    },code);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const treeId=Object.keys(doc.variables).find(id=>doc.variables[id]?.name==='tree');
      const buildFrames=doc.frames.map((frame,index)=>({frame,index}))
        .filter(({frame})=>frame.source?.function==='build');
      const firstInput=buildFrames[1];
      const parentBuilds=buildFrames.filter(({frame})=>(frame.arrows||[]).length===2);
      const parentBuild=parentBuilds[1]||parentBuilds[0];
      await player.render(firstInput.index,{animatePositions:false,animateEvents:false});
      const firstInputText=document.querySelector('#asm-trace-root .asm-trace-text-object')?.textContent||'';
      const firstInputPointer=document.querySelector(
        '#asm-trace-root .asm-trace-pointer-layer .trace-variable-marker-label-text'
      )?.textContent;
      await player.render(parentBuild.index,{animatePositions:false,animateEvents:false});
      const parentText=document.querySelector('#asm-trace-root .asm-trace-text-object')?.textContent||'';
      const arrowCount=document.querySelectorAll('#asm-trace-root .asm-trace-arrow').length;
      const binaryEvent=(parentBuild.frame.events||[]).find(event=>event.binaryOperation==='+');
      const binaryTarget=binaryEvent?.targets?.find(target=>target.role==='target')?.resolvedIndex;
      await player.render(parentBuild.index-1,{animatePositions:false,animateEvents:false});
      const samples=[];
      let settled=false;
      const transition=player.render(parentBuild.index).finally(()=>{settled=true;});
      // The real i array pointer contributes its own ordered movement event
      // before the parent-value assignment. Sample long enough to observe both.
      for(let count=0;count<420&&!settled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const scene=document.querySelector('#asm-trace-root');
        const targetText=scene.querySelector(
          `[data-trace-object-key="${CSS.escape(`${treeId}#${binaryTarget}`)}"]`
        )?.querySelector('text:not([data-trace-content-role="index"])');
        const transfers=[...scene.querySelectorAll('.asm-trace-assign-transfer-value')];
        samples.push({
          targetValue:targetText?.textContent,
          transferValues:transfers.map(item=>item.querySelector('text')?.textContent).sort(),
          transferRects:transfers.reduce((sum,item)=>sum+item.querySelectorAll('rect').length,0)
        });
      }
      await transition;
      const binaryFinal=document.querySelector('#asm-trace-root')?.querySelector(
        `[data-trace-object-key="${CSS.escape(`${treeId}#${binaryTarget}`)}"]`
      )?.querySelector('text:not([data-trace-content-role="index"])')?.textContent;
      const finalFrame=buildFrames.at(-1);
      await player.render(finalFrame.index,{animatePositions:false,animateEvents:false});
      const finalText=document.querySelector('#asm-trace-root .asm-trace-text-object')?.textContent||'';
      return {
        frameCount:buildFrames.length,
        firstInputText,firstInputPointer,parentText,arrowCount,
        binaryEvent:{operation:binaryEvent?.binaryOperation,target:binaryTarget},
        samples,binaryFinal,finalText,
        queryFrames:doc.frames.filter(frame=>frame.source?.function==='query').length
      };
    });
    assert.equal(result.frameCount,32);
    assert.match(result.firstInputText,/讀入第 1 個值 1/);
    assert.equal(result.firstInputPointer,'i');
    assert.match(result.parentText,/左右子節點/);
    assert.equal(result.arrowCount,2);
    assert.deepEqual(result.binaryEvent,{operation:'+',target:14});
    const transfers=result.samples.filter(sample=>sample.transferValues.length===2);
    assert.ok(transfers.some(sample=>JSON.stringify(sample.transferValues)===JSON.stringify(['13','14'])),
      JSON.stringify(result.samples.slice(-20)));
    assert.ok(transfers.every(sample=>sample.transferRects===0));
    assert.ok(transfers.some(sample=>sample.targetValue==='0'));
    assert.equal(transfers.some(sample=>sample.targetValue==='27'),false);
    assert.equal(result.binaryFinal,'27');
    assert.match(result.finalText,/根節點的值是 120/);
    assert.equal(result.queryFrames,0);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('standalone segment tree query descends, removes accepted pieces and accumulates sum', {timeout:60000}, async () => {
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace&&window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Tree/Segment_Tree_easy.cpp'),'utf8')
      .replace(/\r\n?/g,'\n').replace('    // @keep tree as "built_tree"\n','');
    await page.evaluate(code=>{
      ace.edit('editor').setValue(code,-1);
      document.querySelector('#inputArea').value='15 1\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15\n13 14\n';
    },code);
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const treeId=Object.keys(doc.variables).find(id=>doc.variables[id]?.name==='tree');
      const sumId=Object.keys(doc.variables).find(id=>doc.variables[id]?.name==='sum');
      const queryFrames=doc.frames.map((frame,index)=>({frame,index})).filter(({frame})=>frame.segments?.length);
      const now=frame=>Number(window.ASMTraceRules.resolveExpression(doc,frame,'now'));
      const deepest=Math.max(...queryFrames.map(({frame})=>now(frame)).filter(Number.isFinite));
      const accepted=queryFrames.filter(({frame})=>now(frame)===deepest).at(-1);
      const compound=doc.frames.map((frame,index)=>({frame,index})).find(({frame})=>(frame.events||[])
        .some(event=>event.compound===true&&event.targets?.some(target=>target.variableId===sumId)));
      const entry=queryFrames.find(({frame})=>now(frame)===1);
      await player.render(entry.index-1,{animatePositions:false,animateEvents:false});
      await player.render(entry.index);
      const animatedTree=[...document.querySelectorAll(`[data-trace-variable="${treeId}"]`)].at(-1);
      const animatedSegment=animatedTree.closest('#asm-trace-root').querySelector('.asm-trace-heap-cell-segment');
      const animatedVisible=Boolean(animatedSegment&&getComputedStyle(animatedSegment).display!=='none');
      const pointerLabel=document.querySelector(
        '#asm-trace-root .asm-trace-pointer-layer .trace-variable-marker-label-text'
      )?.textContent;
      const pointStyleCount=document.querySelectorAll(
        '#asm-trace-root [data-trace-style-kind="point"]'
      ).length;
      await player.render(compound.index-1,{animatePositions:false,animateEvents:false});
      const beforeScene=document.querySelector('#asm-trace-root');
      const beforeSum=beforeScene.querySelector(`[data-trace-variable="${sumId}"]`);
      const beforeSumIdentity=beforeSum?.dataset.traceRuntimeIdentity;
      const compoundSamples=[];
      let compoundSettled=false;
      const compoundTransition=player.render(compound.index).finally(()=>{compoundSettled=true;});
      for(let count=0;count<180&&!compoundSettled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const currentScene=document.querySelector('#asm-trace-root');
        const currentSum=currentScene.querySelector(`[data-trace-variable="${sumId}"]`);
        const currentSumText=currentScene.querySelector(
          `[data-trace-object-key="${CSS.escape(`${sumId}#0`)}"] > text`
        );
        const transfer=currentScene.querySelector('.asm-trace-assign-transfer-value');
        const transferText=transfer?.querySelector('text');
        const transferBox=transferText?.getBoundingClientRect();
        const targetBox=currentSumText?.getBoundingClientRect();
        compoundSamples.push({
          sumValue:currentSumText?.textContent,
          sumOpacity:Number(getComputedStyle(currentSum).opacity),
          transferValue:transferText?.textContent,
          transferRects:transfer?.querySelectorAll('rect').length||0,
          transferDistance:transferBox&&targetBox?Math.hypot(
            transferBox.x+transferBox.width/2-targetBox.x-targetBox.width/2,
            transferBox.y+transferBox.height/2-targetBox.y-targetBox.height/2
          ):null
        });
      }
      await compoundTransition;
      await player.render(accepted.index,{animatePositions:false,animateEvents:false});
      const tree=[...document.querySelectorAll(`[data-trace-variable="${treeId}"]`)].at(-1);
      const scene=tree.closest('#asm-trace-root');
      const sum=scene.querySelector(`[data-trace-variable="${sumId}"]`);
      const sumCell=sum?.querySelector('[data-trace-index="0"]');
      return {
        deepest,
        animatedVisible,
        pointerLabel,
        pointStyleCount,
        beforeSumIdentity,
        afterSumIdentity:sum?.dataset.traceRuntimeIdentity,
        compoundSamples,
        segments:[...scene.querySelectorAll('.asm-trace-heap-cell-segment')].map(rect=>(+rect.dataset.traceSegmentNode)),
        sum:sumCell?.querySelector(':scope > text')?.textContent,
        sumBelowTree:Number(sum?.dataset?.tracePositionY)>Number(tree?.dataset?.tracePositionY)
      };
    });
    assert.equal(result.deepest,14);
    assert.equal(result.animatedVisible,true);
    assert.equal(result.pointerLabel,'now');
    assert.equal(result.pointStyleCount,0);
    assert.ok(result.beforeSumIdentity);
    assert.equal(result.afterSumIdentity,result.beforeSumIdentity);
    assert.ok(result.compoundSamples.length>0);
    assert.ok(result.compoundSamples.every(sample=>sample.sumValue!==''),
      'sum never becomes blank while += is playing');
    assert.ok(result.compoundSamples.every(sample=>sample.sumOpacity>0.99),
      'the global sum cell does not replay an entrance or exit');
    const transferSamples=result.compoundSamples.filter(sample=>sample.transferValue==='27');
    assert.ok(transferSamples.length>0,'tree[now] value is copied into a moving text transfer');
    assert.ok(transferSamples.every(sample=>sample.transferRects===0),
      'compound += moves only the value text, not the source cell rectangle');
    assert.ok(transferSamples.some(sample=>sample.sumValue==='0'),
      `sum retains its old value until the incoming number lands: ${JSON.stringify(transferSamples)}`);
    assert.equal(transferSamples.some(sample=>sample.sumValue==='27'),false,
      'the moving number disappears in the same animation update that commits the destination value');
    const distances=transferSamples.map(sample=>sample.transferDistance).filter(Number.isFinite);
    assert.ok(Math.max(...distances)>Math.min(...distances)+20,
      'the copied number travels from the tree cell to the sum value');
    assert.deepEqual(result.segments,[]);
    assert.equal(result.sum,'27');
    assert.equal(result.sumBelowTree,true);
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});

test('full segment tree sample merges lazy and set state into cell backgrounds', {timeout:60000}, async () => {
  const base=process.env.ASM_TEST_BASE_URL;
  assert.ok(base,'set ASM_TEST_BASE_URL to an isolated server');
  const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
  try {
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/algorithm.html');
    await page.waitForFunction(()=>window.ace&&window.ASMTracePlayer);
    const code=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Tree/Segment_Tree.cpp'),'utf8')
      .replace(/\r\n?/g,'\n');
    const input=fs.readFileSync(path.join(__dirname,'../algorithm_sample/Tree/Segment_Tree-sample_input.txt'),'utf8');
    await page.evaluate(({code,input})=>{
      ace.edit('editor').setValue(code,-1);
      document.querySelector('#inputArea').value=input;
    },{code,input});
    await page.click('#runBtn');
    await page.waitForFunction(code=>window.ASMTracePlayer.getDocument()?.sourceCode===code,code,{timeout:30000});
    const result=await page.evaluate(async()=>{
      const player=window.ASMTracePlayer,doc=player.getDocument();
      const byName=Object.fromEntries(Object.entries(doc.variables).map(([id,value])=>[value.name,id]));
      const indexed=doc.frames.map((frame,index)=>({frame,index}));
      const scalar=item=>Number(window.ASMTraceModel.scalarValue(item));
      const markedNodes=frame=>{
        const result=[];
        (frame.state[byName.lazy]?.data?.items||[]).forEach((item,node)=>{
          if(scalar(item)!==0)result.push({node,color:'rgb(231,144,255)'});
        });
        (frame.state[byName.sets]?.data?.items||[]).forEach((item,node)=>{
          if(scalar(item)!==2147483647)result.push({node,color:'rgb(255,183,77)'});
        });
        return result;
      };
      const operation=indexed.find(({frame})=>frame.source?.function==='main'&&(frame.segments||[]).length>0);
      const lazyTagged=indexed.find(({frame})=>Object.values(frame.state[byName.lazy]?.data?.items||{})
        .some(item=>Number(item.value)!==0));
      const setTagged=indexed.find(({frame})=>Object.values(frame.state[byName.sets]?.data?.items||{})
        .some(item=>Number(item.value)!==2147483647));
      const unwind=indexed.find(({frame,index})=>index>lazyTagged.index
        &&frame.source?.function==='query'&&(frame.arrows||[]).length===2
        &&markedNodes(frame).length>0);
      const handoff=indexed.find(({frame,index})=>index>0
        &&(doc.frames[index-1].segments||[]).some(segment=>segment.split?.phase==='before')
        &&(frame.segments||[]).some(segment=>segment.split?.phase==='after')
        &&markedNodes(frame).length>0);
      await player.render(operation.index,{animatePositions:false,animateEvents:false});
      const operationSegments=document.querySelectorAll('#asm-trace-root .asm-trace-heap-cell-segment').length;
      const handoffMark=markedNodes(handoff.frame)[0];
      await player.render(handoff.index-1,{animatePositions:false,animateEvents:false});
      const handoffSamples=[];
      let handoffSettled=false;
      const handoffTransition=player.render(handoff.index).finally(()=>{handoffSettled=true;});
      for(let count=0;count<180&&!handoffSettled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const currentTree=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
        const segment=currentTree?.closest('#asm-trace-root')?.querySelector(
          `.asm-trace-heap-cell-segment[data-trace-segment-node="${handoffMark.node}"]`
        );
        const rect=currentTree?.querySelector(`[data-trace-index="${handoffMark.node}"] > rect`);
        const indexRect=currentTree?.querySelector(`[data-trace-index-label="${handoffMark.node}"] > rect`);
        handoffSamples.push({
          segmentHeight:segment?Number(segment.getAttribute('height')):0,
          background:rect?getComputedStyle(rect).fill.replace(/\s+/g,''):'',
          indexBackground:indexRect?getComputedStyle(indexRect).fill.replace(/\s+/g,''):''
        });
      }
      await handoffTransition;
      const readBackgrounds=async item=>{
        await player.render(item.index,{animatePositions:false,animateEvents:false});
        const tree=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
        return markedNodes(item.frame).map(({node,color})=>({
          node,color,fill:tree.querySelector(`[data-trace-index="${node}"] > rect`)?.getAttribute('fill')
        }));
      };
      const lazyBackgrounds=await readBackgrounds(lazyTagged);
      const setBackgrounds=await readBackgrounds(setTagged);
      await player.render(lazyTagged.index,{animatePositions:false,animateEvents:false});
      const tree=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
      const compositeTexts=[...tree.querySelectorAll('[data-trace-index] > text:not([data-trace-content-role="index"])')]
        .map(node=>node.textContent);
      const separateFields={
        lazy:document.querySelectorAll(`[data-trace-variable="${byName.lazy}"]`).length,
        sets:document.querySelectorAll(`[data-trace-variable="${byName.sets}"]`).length
      };
      const previousUnwindMarks=new Map(markedNodes(doc.frames[unwind.index-1])
        .map(mark=>[mark.node,mark.color]));
      const persistentUnwindMarks=markedNodes(unwind.frame)
        .filter(mark=>previousUnwindMarks.get(mark.node)===mark.color);
      await player.render(unwind.index-1,{animatePositions:false,animateEvents:false});
      const unwindSamples=[];
      let unwindSettled=false;
      const unwindTransition=player.render(unwind.index).finally(()=>{unwindSettled=true;});
      for(let count=0;count<180&&!unwindSettled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const currentTree=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
        persistentUnwindMarks.forEach(mark=>{
          const rect=currentTree?.querySelector(`[data-trace-index="${mark.node}"] > rect`);
          const indexRect=currentTree?.querySelector(`[data-trace-index-label="${mark.node}"] > rect`);
          unwindSamples.push({
            node:mark.node,
            expected:mark.color,
            background:rect?getComputedStyle(rect).fill.replace(/\s+/g,''):'',
            indexBackground:indexRect?getComputedStyle(indexRect).fill.replace(/\s+/g,''):''
          });
        });
      }
      await unwindTransition;
      const unwindSegments=document.querySelectorAll('#asm-trace-root .asm-trace-heap-cell-segment').length;
      const unwindTree=[...document.querySelectorAll(`[data-trace-variable="${byName.tree}"]`)].at(-1);
      const unwindBackgrounds=markedNodes(unwind.frame).map(({node,color})=>({
        color,fill:unwindTree.querySelector(`[data-trace-index="${node}"] > rect`)?.getAttribute('fill')
      }));
      await player.render(24,{animatePositions:false,animateEvents:false});
      const frame26ContinuitySamples=[];
      let frame26Settled=false;
      const frame26Transition=player.render(25).finally(()=>{frame26Settled=true;});
      for(let count=0;count<180&&!frame26Settled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const nodes=new Set([...document.querySelectorAll(
          '#asm-trace-root .asm-trace-heap-cell-segment'
        )].map(rect=>Number(rect.dataset.traceSegmentNode)));
        frame26ContinuitySamples.push([3,5,8,9].every(node=>nodes.has(node)));
      }
      await frame26Transition;
      const frame26Segments=[...document.querySelectorAll(
        '#asm-trace-root .asm-trace-heap-cell-segment'
      )].map(rect=>Number(rect.dataset.traceSegmentNode)).sort((a,b)=>a-b);
      await player.render(27,{animatePositions:false,animateEvents:false});
      const frame29ContinuitySamples=[];
      let frame29Settled=false;
      const frame29Transition=player.render(28).finally(()=>{frame29Settled=true;});
      for(let count=0;count<180&&!frame29Settled;count++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        const nodes=new Set([...document.querySelectorAll(
          '#asm-trace-root .asm-trace-heap-cell-segment'
        )].map(rect=>Number(rect.dataset.traceSegmentNode)));
        frame29ContinuitySamples.push([3,5,9].every(node=>nodes.has(node)));
      }
      await frame29Transition;
      const frame29Segments=[...document.querySelectorAll(
        '#asm-trace-root .asm-trace-heap-cell-segment'
      )].map(rect=>Number(rect.dataset.traceSegmentNode)).sort((a,b)=>a-b);
      const pointerLabel=document.querySelector(
        '#asm-trace-root .asm-trace-pointer-layer .trace-variable-marker-label-text'
      )?.textContent;
      const pointStyleCount=document.querySelectorAll(
        '#asm-trace-root [data-trace-style-kind="point"]'
      ).length;
      await player.render(doc.frames.length-1,{animatePositions:false,animateEvents:false});
      const answer=[...document.querySelectorAll(
        `[data-trace-object-key="${CSS.escape(`${byName.answer}#0`)}"] > text`
      )].at(-1)?.textContent;
      return {
        buildFrames:doc.frames.filter(frame=>frame.source?.function==='build').length,
        operationSegments,lazyBackgrounds,setBackgrounds,unwindBackgrounds,unwindSamples,
        handoffSamples,handoffColor:handoffMark.color,
        stateSegments:document.querySelectorAll('#asm-trace-root .asm-trace-state-segment').length,
        compositeTexts,separateFields,unwindSegments,
        frame26Segments,frame26ContinuitySamples,
        frame29Segments,frame29ContinuitySamples,
        pointerLabel,pointStyleCount,answer
      };
    });
    assert.equal(result.buildFrames,0);
    assert.ok(result.operationSegments>0);
    assert.ok(result.handoffSamples.every(sample=>sample.background===sample.indexBackground),
      JSON.stringify(result.handoffSamples));
    assert.ok(result.handoffSamples.some(sample=>sample.segmentHeight===40
      &&sample.background!=='rgb(255,255,255)'
      &&sample.background!==result.handoffColor),JSON.stringify(result.handoffSamples));
    const exiting=result.handoffSamples.filter(sample=>sample.segmentHeight>0
      &&sample.segmentHeight<40);
    assert.ok(exiting.length>0,JSON.stringify(result.handoffSamples));
    assert.ok(exiting.every(sample=>sample.background===result.handoffColor
      &&sample.indexBackground===result.handoffColor),
      JSON.stringify(result.handoffSamples));
    assert.ok(result.lazyBackgrounds.some(item=>item.color===item.fill),JSON.stringify(result));
    assert.ok(result.setBackgrounds.some(item=>item.color===item.fill),JSON.stringify(result));
    assert.ok(result.unwindBackgrounds.some(item=>item.color===item.fill),JSON.stringify(result));
    assert.ok(result.unwindSamples.length>0,JSON.stringify(result));
    assert.ok(result.unwindSamples.every(sample=>sample.background===sample.expected
      &&sample.indexBackground===sample.expected),JSON.stringify(result.unwindSamples));
    assert.equal(result.stateSegments,0);
    assert.ok(result.compositeTexts.some(text=>text.includes(',')),JSON.stringify(result));
    assert.deepEqual(result.separateFields,{lazy:0,sets:0});
    assert.equal(result.unwindSegments,0);
    assert.deepEqual(result.frame26Segments,[3,5,8,9]);
    assert.ok(result.frame26ContinuitySamples.length>0);
    assert.ok(result.frame26ContinuitySamples.every(Boolean));
    assert.deepEqual(result.frame29Segments,[3,5,9]);
    assert.ok(result.frame29ContinuitySamples.length>0);
    assert.ok(result.frame29ContinuitySamples.every(Boolean));
    assert.equal(result.pointerLabel,'now');
    assert.equal(result.pointStyleCount,0);
    assert.equal(result.answer,'12');
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
