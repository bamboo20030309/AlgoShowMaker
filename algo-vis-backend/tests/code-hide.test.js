const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findCodeHideRanges, instrumentSource } = require('../trace-instrumenter');

test('@code hide suppresses instrumentation without changing the C++ scope', () => {
  const source = `
int helper(int value) { return value + 1; }
int main() {
  int value = 0;
  // @code hide
  value = helper(value);
  // @endcode
  // @frame value
  return value;
}`;
  const result = instrumentSource(source);
  assert.equal(result.codeHideRanges.length, 1);
  assert.match(result.code, /TraceSuppressionScope __asm_trace_hidden_/);
  assert.match(result.code, /__asm_trace_hidden_\d+\.release\(\)/);
  assert.doesNotMatch(result.code, /\{ ::asm_trace::TraceSuppressionScope/);
  const hidden = result.code.slice(
    result.code.indexOf('// @code hide'), result.code.indexOf('// @endcode')
  );
  assert.doesNotMatch(hidden, /event_(?:assign|call|read|write)/);
});

test('@code hide can appear anywhere, nest, and contain drawing directives', () => {
  assert.throws(() => findCodeHideRanges('// @endcode'), /找不到對應/);
  assert.throws(() => findCodeHideRanges('int main() {\n// @code hide\nint x;\n}'), /缺少 @endcode/);
  const globalEmpty = findCodeHideRanges(`
// @code hide
// @endcode
int main() { return 0; }
`);
  assert.equal(globalEmpty.length, 1);
  assert.equal(globalEmpty[0].runtimeGuard, false);

  const nested = findCodeHideRanges(`
int main() {
// @code hide
// @code hide
// @endcode
// @endcode
}
`);
  assert.equal(nested.length, 2);
  assert.ok(nested.every(range => range.runtimeGuard));

  const visual = instrumentSource(`
int main() {
int value = 1;
// @code hide
// @frame value
// @endcode
return 0;
}
`);
  assert.equal(visual.frameDirectives.length, 1);
  assert.match(visual.code, /TraceSuppressionPause __asm_trace_visible_/);
});
