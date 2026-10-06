'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives } = require('../trace-instrumenter');

test('char view preserves source name, identity and index bindings', () => {
  const frames = findFrameDirectives(`#include <string>
int main(){std::string s="abc"; int i=0,j=2;
// @frame char(s)[i,j]
// @style s[i] highlight
// @frame s
}`);
  const object = frames[0].objects[0];
  assert.equal(object.primaryName, 's');
  assert.equal(object.dataTransform.type, 'char');
  assert.equal(object.dataTransform.sourceVariableId, object.primaryVariableId);
  assert.equal(object.renderer, 'original-array');
  assert.deepEqual(frames[0].bindings.map(b => b.indexExpression), ['i','j']);
  assert.equal(frames[1].objects[0].dataTransform, null);
});

test('char view works in preset and object directives and rejects invalid sources', () => {
  const source = `#include <string>
// @preset view
// @object char(s) with labels(value,index)
// @endpreset
int main(){std::string s="";
// @frame use view
}`;
  assert.equal(findFrameDirectives(source)[0].objects[0].dataTransform.type, 'char');
  for (const expression of ['char(s,2)', 'char()', 'char(s+1)']) {
    assert.throws(() => findFrameDirectives(source.replace('char(s)', expression)));
  }
  assert.throws(() => findFrameDirectives('int main(){int n=1;\n// @frame char(n)\n}'), /char\(\).*字串/);
});
