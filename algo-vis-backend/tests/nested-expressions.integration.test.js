'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {startIsolatedServer}=require('./helpers/isolated-server');
const {compile}=require('./helpers/compile');

// Handwritten answers: never derive expected values/order from playback plans.
test('nested mutations retain values, references, short circuit and exact-once effects', {timeout:60000}, async t=>{
  const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
  const {trace}=await compile(`#include <bits/stdc++.h>
using namespace std;
int identity(int x){return x;}
int& reference(int& x){return x;}
int main(){
 vector<int> num={7,9,11},out;
 vector<vector<int>> matrix(2,vector<int>(3,0));
 int i=0,j=0,a=0,b=0,c=0,result=0;
 // @frame num,out,matrix,i,j,a,b,c,result
 out.push_back(num[j++]);
 // @frame num,out,matrix,i,j,a,b,c,result
 result=identity((a=(b+=3)));
 // @frame num,out,matrix,i,j,a,b,c,result
 result=(++a)+(b--);
 // @frame num,out,matrix,i,j,a,b,c,result
 result=false && (++a>0);
 result=true || (++b>0);
 // @frame num,out,matrix,i,j,a,b,c,result
 result=true ? (a+=2) : (b+=100);
 // @frame num,out,matrix,i,j,a,b,c,result
 num[i++]=(c=5);
 // @frame num,out,matrix,i,j,a,b,c,result
 result=(matrix[j++][i++]+=a);
 // @frame num,out,matrix,i,j,a,b,c,result
 result=(out.push_back((b=4)),identity(b));
 // @frame num,out,matrix,i,j,a,b,c,result
 reference(a=(c+=2))=12;
 // @frame num,out,matrix,i,j,a,b,c,result
 auto size=sizeof(i++);using T=decltype(++i);
 // @frame num,out,matrix,i,j,a,b,c,result
 for(int k=(c=0);k<2;k+=(c=1)){b+=k;}
 // @frame num,out,matrix,i,j,a,b,c,result
 result=*(out.insert(out.end(),(a=8)));
 // @frame num,out,matrix,i,j,a,b,c,result
}`);
  const value=(frame,name)=>Object.values(trace.frames[frame].state).find(v=>v.name===name)?.data;
  const mutations=frame=>trace.frames[frame].events.filter(e=>['assign','write','sequence-operation'].includes(e.type));
  const expressions=frame=>Array.from(mutations(frame),e=>e.expression||e.source?.text);
  assert.equal(trace.frames.length,13);
  assert.equal(value(1,'j').value,1);assert.equal(value(1,'out').items[0].value,7);
  assert.deepEqual(expressions(1),['j++','out.push_back(num[j++])']);
  assert.equal(mutations(1)[1].targets.find(e=>e.role==='source').resolvedIndex,0);
  assert.ok(mutations(1)[0].source.expressionPath.some(e=>e.type==='CallExpression'));
  assert.deepEqual(expressions(2),['b+=3','a=(b+=3)','result=identity((a=(b+=3)))']);
  assert.equal(value(2,'result').value,3);
  assert.equal(mutations(2).find(e=>e.expression==='b+=3').payload.source.value,3);
  assert.equal(value(3,'a').value,4);assert.equal(value(3,'b').value,2);assert.equal(value(3,'result').value,7);
  assert.ok(!expressions(4).some(e=>/\+\+[ab]/.test(e)&&!e.startsWith('result')));
  assert.equal(value(4,'a').value,4);assert.equal(value(4,'b').value,2);
  assert.equal(value(5,'a').value,6);assert.equal(value(5,'b').value,2);
  assert.deepEqual(expressions(6),['c=5','i++','num[i++]=(c=5)']);
  const target=mutations(6).at(-1).targets.find(v=>v.role==='target');assert.equal(target.resolvedIndex,0);
  assert.equal(value(6,'i').value,1);assert.equal(value(6,'num').items[0].value,5);
  assert.equal(value(7,'j').value,2);assert.equal(value(7,'i').value,2);assert.equal(value(7,'result').value,6);
  assert.equal(mutations(7).find(e=>e.expression==='matrix[j++][i++]+=a').payload.source.value,6);
  assert.deepEqual(Array.from(mutations(7).find(e=>e.expression==='matrix[j++][i++]+=a').targets[0].resolvedIndices),[1,1]);
  assert.equal(value(8,'out').items[1].value,4);assert.equal(value(8,'result').value,4);
  assert.equal(value(9,'a').value,12);assert.equal(value(9,'c').value,7);
  assert.equal(value(10,'i').value,2);assert.ok(!expressions(10).some(e=>e==='i++'||e==='++i'));
  assert.equal(value(11,'c').value,1);assert.equal(value(11,'b').value,5);
  assert.equal(value(12,'a').value,8);assert.equal(value(12,'result').value,8);
  assert.equal(value(12,'out').items[2].value,8);
});

test('nested calls, return expressions, comma, prefix and side-effecting source indices execute once', {timeout:60000}, async t=>{
  const {base}=await startIsolatedServer(t);process.env.ASM_TEST_BASE_URL=base;
  const {trace}=await compile(`#include <bits/stdc++.h>
using namespace std;
int identity(int x){return x;}
int nested(int& x){return identity(x+=2);}
int main(){vector<int> num={2,4,6},out;int i=0,a=1,b=2,result=0;
// @frame num,out,i,a,b,result
out.push_back(num[identity(i++)]);
result=identity(identity(a+=2));
result=(swap(num[i++],num[0]),--b);
// @frame num,out,i,a,b,result
result=nested(a);
out.emplace_back(++b);
// @frame num,out,i,a,b,result
out.push_back(num[(i=0)]);
// @frame num,out,i,a,b,result
}`);
  const value=(frame,name)=>Object.values(trace.frames[frame].state).find(v=>v.name===name)?.data;
  assert.equal(value(1,'i').value,2);assert.equal(value(1,'out').items[0].value,2);
  assert.equal(value(1,'num').items[0].value,4);assert.equal(value(1,'num').items[1].value,2);
  assert.equal(value(1,'a').value,3);assert.equal(value(1,'b').value,1);assert.equal(value(1,'result').value,1);
  assert.equal(trace.frames[1].events.filter(e=>e.expression==='i++').length,2);
  assert.equal(trace.frames[1].events.find(e=>e.operation==='push_back').targets.find(e=>e.role==='source').resolvedIndex,0);
  assert.equal(value(2,'a').value,5);assert.equal(value(2,'result').value,5);assert.equal(value(2,'out').items[1].value,2);
  assert.ok(trace.frames[2].events.some(e=>e.type==='write'&&e.expression==='x+=2'));
  assert.equal(value(3,'i').value,0);assert.equal(value(3,'out').items[2].value,4);
  assert.equal(trace.frames[3].events.find(e=>e.operation==='push_back').targets.find(e=>e.role==='source').resolvedIndex,0);
});
