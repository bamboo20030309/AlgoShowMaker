'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {compile}=require('./helpers/compile');

// Independent arithmetic answers: do not derive these from the playback plan.
test('all compound operators share exact-once nested evaluation and retain operation semantics', {timeout:60000}, async()=>{
 const cases=[['+=',15],['-=',9],['*=',36],['/=',4],['%=',0],['&=',0],['|=',15],['^=',15],['<<=',96],['>>=',1]];
 const steps=cases.map(([op])=>`a=12;rhs=2;result=(a ${op} (rhs+=1));\n// @frame a,rhs,result\n`).join('');
 const {trace}=await compile(`#include <bits/stdc++.h>\nusing namespace std;int main(){int a=12,rhs=2,result=0;\n// @frame a,rhs,result\n${steps}}`);
 const value=(f,name)=>Object.values(f.state).find(v=>v.name===name).data.value;
 for(let n=0;n<cases.length;n++){
  const [op,answer]=cases[n],frame=trace.frames[n+1];
  assert.equal(value(frame,'a'),answer,op);assert.equal(value(frame,'result'),answer,op);assert.equal(value(frame,'rhs'),3,op);
  const writes=Array.from(frame.events).filter(e=>['assign','write'].includes(e.type));
  const inner=writes.filter(e=>(e.expression||e.operation)==='rhs+=1');assert.equal(inner.length,1,op);
  const outer=writes.find(e=>(e.expression||e.operation)===`a ${op} (rhs+=1)`);assert.ok(outer,op);
  assert.equal(outer.payload.before.value,12,op);assert.equal(outer.payload.after.value,answer,op);assert.equal(outer.payload.source.value,3,op);
  assert.ok(inner[0].order<outer.order,op);
  const receiver=writes.find(e=>(e.expression||e.operation)===`result=(a ${op} (rhs+=1))`);assert.ok(receiver.order>outer.order,op);
  if(op==='<<='||op==='>>=')assert.deepEqual(JSON.parse(JSON.stringify(outer.bitShift)),{direction:op==='<<='?'left':'right',amount:3});
  if(['&=','|=','^='].includes(op)){
   assert.equal(outer.bitwise.operator,op[0]);assert.equal(outer.payload.left.value,12);assert.equal(outer.payload.right.value,3);
   assert.deepEqual(Array.from(outer.targets,t=>t.role),['target','source-left','source-right']);
  }
 }
});

test('nested shift binds side-effecting indices once after RHS and preserves reference results', {timeout:60000},async()=>{
 const {trace}=await compile(`#include <bits/stdc++.h>
using namespace std;
int main(){vector<int> a={9,6};int i=0,k=1,result=0,mask=0;
// @frame a,i,k,result
result=(a[i++] <<= k++);
// @frame a,i,k,result
result=(a[--i] >>= (k=1));
// @frame a,i,k,result
(a[i++] += 2)=7;
// @frame a,i,k,result
mask |= (a[i++]);
// @frame a,i,k,result,mask
}`);
 const value=(f,name)=>Object.values(f.state).find(v=>v.name===name).data;
 const mutations=f=>Array.from(f.events).filter(e=>['assign','write'].includes(e.type));
 for(const [index,answer,direction,order]of [[1,18,'left',['k++','i++']],[2,9,'right',['k=1','--i']]]){
  const f=trace.frames[index],events=mutations(f),shift=events.find(e=>e.bitShift);
  assert.equal(shift.targets[0].resolvedIndex,0);assert.equal(shift.bitShift.direction,direction);assert.equal(shift.bitShift.amount,1);
  assert.equal(value(f,'a').items[0].value,answer);assert.equal(value(f,'result').value,answer);
  const ranks=order.map(expression=>events.find(e=>e.expression===expression)?.order);assert.ok(ranks.every(Number.isFinite));assert.ok(ranks[0]<ranks[1]&&ranks[1]<shift.order);
 }
 assert.equal(value(trace.frames[1],'i').value,1);assert.equal(value(trace.frames[1],'k').value,2);
 assert.equal(value(trace.frames[2],'i').value,0);assert.equal(value(trace.frames[3],'i').value,1);assert.equal(value(trace.frames[3],'a').items[0].value,7);
 assert.equal(mutations(trace.frames[3]).at(-1).targets[0].resolvedIndex,0,'reference-valued nested target keeps its actual cell');
 const bitwise=mutations(trace.frames[4]).find(e=>e.bitwise);assert.equal(value(trace.frames[4],'mask').value,6);assert.equal(value(trace.frames[4],'i').value,2);assert.equal(bitwise.targets.find(t=>t.role==='source-right').resolvedIndex,1);assert.equal(bitwise.payload.right.value,6);
});

test('outer prefix and postfix operators are not confused by opposite updates inside their targets', {timeout:30000},async()=>{
 const {trace}=await compile(`#include <vector>
int main(){std::vector<int>a={4,6};int i=0,result=0;
// @frame a,i,result
result=a[i++]--;
// @frame a,i,result
result=++a[i--];
// @frame a,i,result
}`);
 const value=(f,name)=>Object.values(f.state).find(v=>v.name===name).data;
 assert.equal(value(trace.frames[1],'result').value,4);assert.equal(value(trace.frames[1],'a').items[0].value,3);assert.equal(value(trace.frames[1],'i').value,1);
 assert.equal(value(trace.frames[2],'result').value,7);assert.equal(value(trace.frames[2],'a').items[1].value,7);assert.equal(value(trace.frames[2],'i').value,0);
 for(const [index,expressions]of [[1,['i++','a[i++]--']],[2,['i--','++a[i--]']]]){
  const writes=Array.from(trace.frames[index].events).filter(e=>e.type==='write');
  assert.deepEqual(writes.map(e=>e.expression),expressions);assert.equal(writes[1].targets[0].resolvedIndex,index-1);
 }
});
