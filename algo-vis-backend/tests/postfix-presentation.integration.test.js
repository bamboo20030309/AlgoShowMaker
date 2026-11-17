'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');

test('postfix old-value consumption precedes visual update; prefix, other writes and sequencing barriers retain order', {timeout:60000},async t=>{
  const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
  const {trace,window}=await compile(`#include <bits/stdc++.h>
using namespace std;
int identity(int x){return x;}
int main(){vector<int> num={2,4,6},out;int i=0,j=0,a=0,b=0;
// @frame num,out,i,j,a,b
out.push_back(num[i++]);
// @frame num,out,i,j,a,b
out.push_back(num[++i]);
// @frame num,out,i,j,a,b
out.push_back(num[i--]);
// @frame num,out,i,j,a,b
out.push_back(num[--i]);
// @frame num,out,i,j,a,b
a=i++;
// @frame num,out,i,j,a,b
a=(i+=2);
// @frame num,out,i,j,a,b
a=(i++,b=i);
// @frame num,out,i,j,a,b
a=(i++ && (b=i));
// @frame num,out,i,j,a,b
a=(i++ ? (b=i) : b);
// @frame num,out,i,j,a,b
a=(i++ + j++);
// @frame num,out,i,j,a,b
int x=i++;
// @frame num,out,i,j,a,b,x
if(i++<10)b=2;
// @frame num,out,i,j,a,b,x
i++;j--;
// @frame num,out,i,j,a,b,x
out.push_back(num[j]++);
// @frame num,out,i,j,a,b,x
a=identity(i++);
// @frame num,out,i,j,a,b,x
}`);
  const original=JSON.stringify(trace.frames.map(f=>f.events));
  const display=frame=>window.ASMTraceEvents.presentationOrdered(trace.frames[frame].events,trace);
  const writes=events=>Array.from(events.filter(e=>['assign','write','sequence-operation'].includes(e.type)),e=>e.expression||e.source?.text);
  const state=(frame,name)=>Object.values(trace.frames[frame].state).find(v=>v.name===name).data;
  assert.deepEqual(writes(trace.frames[1].events),['i++','out.push_back(num[i++])']);
  assert.deepEqual(writes(display(1)),['out.push_back(num[i++])','i++']);
  assert.deepEqual(writes(display(2)),['++i','out.push_back(num[++i])']);
  assert.deepEqual(writes(display(3)),['out.push_back(num[i--])','i--']);
  assert.deepEqual(writes(display(4)),['--i','out.push_back(num[--i])']);
  assert.deepEqual(writes(display(5)),['a=i++','i++']);assert.equal(state(5,'a').value,0);assert.equal(state(5,'i').value,1);
  assert.deepEqual(writes(display(6)),['i+=2','a=(i+=2)']);
  assert.deepEqual(writes(display(7)),['i++','b=i','a=(i++,b=i)']);assert.equal(state(7,'b').value,4);
  assert.ok(writes(display(8)).indexOf('i++')<writes(display(8)).indexOf('b=i'));assert.equal(state(8,'b').value,5);
  assert.ok(writes(display(9)).indexOf('i++')<writes(display(9)).indexOf('b=i'));assert.equal(state(9,'b').value,6);
  assert.deepEqual(writes(display(10)),['a=(i++ + j++)','i++','j++']);assert.equal(state(10,'a').value,6);
  assert.deepEqual(writes(display(11)),['x = i++','i++']);assert.equal(state(11,'x').value,7);
  const compare=display(12).findIndex(e=>e.type==='compare'),post=display(12).findIndex(e=>e.expression==='i++');assert.ok(compare<post);
  assert.deepEqual(writes(display(13)),['i++','j--']);
  assert.deepEqual(writes(display(14)),['out.push_back(num[j]++)','num[j]++'],JSON.stringify(trace.frames[14].events));assert.equal(state(14,'out').items.at(-1).value,2);assert.equal(state(14,'num').items[0].value,3);
  const call=display(15);assert.ok(call.findIndex(e=>e.expression==='i++')<call.findIndex(e=>e.type==='function-enter'));
  assert.equal(JSON.stringify(trace.frames.map(f=>f.events)),original,'runtime records are unchanged');
  // Actual saved engine-15 documents lack these new optional source fields.
  const legacy=JSON.parse(JSON.stringify(trace));legacy.frames.flatMap(f=>f.events).forEach(e=>{delete e.source?.updateForm;delete e.source?.postfixConsumerRanges;});
  assert.deepEqual(writes(window.ASMTraceEvents.presentationOrdered(legacy.frames[1].events,legacy)),['out.push_back(num[i++])','i++']);
  const warnings=[];window.ASMCompileWarnings={report:(kind,message)=>warnings.push({kind,message})};
  window.ASMTraceEvents.presentationOrdered(legacy.frames[8].events,legacy);
  window.ASMTraceEvents.presentationOrdered(legacy.frames[8].events,legacy);
  assert.equal(warnings.length,1);assert.match(warnings[0].message,/重新 RUN/);
  // Playback values follow the same presentation order, not raw event order.
  const frame=trace.frames[5],ordered=display(5),assign=ordered.find(e=>e.type==='assign'),update=ordered.find(e=>e.type==='write');
  const slots=[{event:assign,animation:'assign',start:0,end:1260,effectStart:0},{event:update,animation:'position',start:1760,motionStart:1760,end:2280}];
  const plan=window.ASMTraceFrameTween.createForwardReplayPlan(trace,frame,slots);
  assert.ok(plan.checkpoints.findIndex(c=>c.event===assign)<plan.checkpoints.findIndex(c=>c.event===update));
  update.enabled=false;
  const disabled=window.ASMTraceFrameTween.createForwardReplayPlan(trace,frame,[slots[0]]);
  assert.equal(disabled.checkpoints.find(c=>c.event===update).mode,'instant');
  assert.equal(update.enabled,false,'presentation never overwrites an explicit disabled choice');
});
