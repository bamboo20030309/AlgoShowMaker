'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');const{load}=require('./helpers/compile');
test('local strings and arrays share frame-variable postfix evaluation without invalidating unrelated lets',()=>{
 const c=vm.createContext({});c.window=c;load(c,'trace-model.js');load(c,'trace-rules.js');
 const doc={variables:{s:{name:'S'},t:{name:'T'},j:{name:'j'}}};
 const frame={state:{s:{name:'S',data:{kind:'string',value:'old'}},t:{name:'T',data:{kind:'string',value:'old'}},j:{name:'j',data:{kind:'scalar',value:99}}},lets:[{name:'rows',expression:'S.size()'},{name:'columns',expression:'T.size()'}]};
 const locals={S:'abcdedcba',T:'edcbabcde',j:2,items:[4,5],zero:0,off:false};const resolve=e=>c.ASMTraceRules.resolveExpression(doc,frame,e,locals);
 for(const [expression,answer]of [['j',2],['j+1',3],['S.size()',9],['T.length',9],['T[j-1]','d'],['S[0]','a'],['rows+columns',18],['items.size()',2],['items[j-1]',5],['zero',0],['off',false]])assert.equal(resolve(expression),answer,expression);
 assert.equal(resolve('T[j]'),'c');assert.equal(resolve('S.substr(1)'),null,'unsupported methods remain invalid');assert.equal(resolve('missing.size()'),null);
});
