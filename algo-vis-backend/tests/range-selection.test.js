'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../public/trace-selection'),I=require('../trace-instrumenter');
const source=directives=>'#include <vector>\n#include <string>\nint main(){int n=5,i=2;std::vector<int>a={10,20,30,40,50};std::vector<std::vector<int>>g(3,std::vector<int>(3));std::string s="abcde";\n'+directives+'\n}';
test('closed ranges, omitted bounds and nested ternaries share one grammar',()=>{
 for(const [raw,answer] of [['1:3',[1,2,3]],[':2',[0,1,2]],['3:',[3,4]],[':',[0,1,2,3,4]],['4:2',[]],['-2:9',[0,1,2,3,4]]])assert.deepEqual(S.indices(S.dimension(raw),5,Number),answer);
 assert.equal(S.dimension('(i?1:2):n-1').startExpression,'(i?1:2)');assert.equal(S.dimension('i?1:2').type,'index');
 assert.throws(()=>S.dimension('1:2:3'));assert.throws(()=>S.dimension('1:]'));
});
test('frame/object slicing preserves scalar indexing and captures bounds',()=>{
 const frames=I.findFrameDirectives(source('// @frame a[1:n-1]\n// @object char(s)[:3]\n// @frame a[i]\n// @frame g[1:][1:2]'));
 assert.equal(frames[0].objects[0].dataTransform.type,'slice');assert.ok(frames[0].variables.some(v=>v.name==='n'));
 assert.equal(frames[0].objects[1].dataTransform.characterView,true);assert.equal(frames[1].objects[0].dataTransform.type,'element');assert.equal(frames[2].objects[0].dataTransform.dimensions.length,2);
 assert.throws(()=>I.findFrameDirectives(source('// @frame a[1:3] with range(0,2)')),/同時/);
});
test('styles, semantic endpoints, loops, pointer target ranges use the common selection grammar',()=>{
 const result=I.instrumentSource(source('// @frame a[:]\n// @object g[1:][1:]\n// @style a[:] mark\n// @pointer i at a[1:3]\n// @text "range" at a[1:n-1].bottom\n// @place g.top at a[1:3].bottom\n// @camera focus a[1:3]\n// @for k in [0:1]\n// @arrow from a[k:k+1] to g[1:2][1:].index-label.top\n// @endfor'));
 assert.ok(result);
});
module.exports={source};
