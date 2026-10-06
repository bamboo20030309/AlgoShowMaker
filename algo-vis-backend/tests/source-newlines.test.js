const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {normalizeSource,analyzeSource,buildSyntaxTree,instrumentSource,findFrameDirectives}=require('../trace-instrumenter');
const source=fs.readFileSync(path.join(__dirname,'fixtures/kmp-source-newlines.cpp'),'utf8').replace(/\r\n?/g,'\n');
const variants=source=>{let i=0;return [source,source.replace(/\n/g,'\r\n'),source.replace(/\n/g,'\r'),source.replace(/\n/g,()=>i++%2?'\n':'\r\n')];};
test('KMP includes, directives, tree offsets and generated C++ are identical for all newline formats',()=>{
 const tree=buildSyntaxTree(source),generated=instrumentSource(source,[]);
 const visit=node=>{assert.notEqual(node.type,'Error');node.children.forEach(visit);};visit(tree.root);
 assert.ok(tree.nodeCount>200);assert.ok(generated.frameDirectives.length>5);
 for(const input of variants(source)){
  assert.equal(normalizeSource(input),source);
  assert.deepEqual(buildSyntaxTree(input),tree);
  assert.deepEqual(instrumentSource(input,[]),generated);
  assert.deepEqual(analyzeSource(input).variables,analyzeSource(source).variables);
  assert.deepEqual(findFrameDirectives(input,analyzeSource(input)),findFrameDirectives(source,analyzeSource(source)));
 }
});
test('continued preprocessing, raw string and Unicode retain canonical offsets',()=>{
 const source='#include <iostream>\n#define DOUBLE(x) \\\n ((x)+(x))\nint main(){const char* text=R"(中文②\ntext)";int n=DOUBLE(2);return n;}\n';
 for(const input of variants(source)){
  assert.deepEqual(buildSyntaxTree(input),buildSyntaxTree(source));
  assert.equal(normalizeSource(input),source);
 }
});
