const { test } = require('node:test');
const assert = require('node:assert/strict');
const { instrumentSource } = require('../trace-instrumenter');

test('break and continue emit code-only control-flow events with their jump target', () => {
  const result = instrumentSource(`
int main() {
  for (int i = 0; i < 4; ++i) {
    if (i == 1) continue;
    if (i == 2) break;
  }
  return 0;
}
` + '\n// @layout linear as validation_scene\n');
  assert.match(result.code, /"continue",\s*"for-update"(?:\s*,|\))/);
  assert.match(result.code, /"break",\s*"loop-exit"(?:\s*,|\))/);
  assert.ok(Object.keys(result.eventSources).some(key => key.startsWith('continue:')));
  assert.ok(Object.keys(result.eventSources).some(key => key.startsWith('break:')));
});
