const { test } = require('node:test');
const assert = require('node:assert/strict');
const { instrumentSource } = require('../trace-instrumenter');

test('a named frame alone activates tracing and preserves its lexical variables', () => {
  for (const prefix of ['', 'heap: ', 'inside.view-1: ']) {
    const source = `int main() { int value=3;\n // ${prefix}@frame value\n return 0; }`;
    const result = instrumentSource(source);
    assert.equal(result.drawingEnabled, true, prefix);
    assert.equal(result.frameDirectives.length, 1);
    assert.equal(result.frameDirectives[0].variables.find(v => v.name === 'value')?.kind, 'scalar');
    assert.match(result.code, /::asm_trace::capture/);
  }
  const plain = 'int main() { int value=3; return value; }';
  const result = instrumentSource(plain);
  assert.equal(result.drawingEnabled, false, 'ordinary code remains uninstrumented');
  assert.equal(result.code, plain);
});
