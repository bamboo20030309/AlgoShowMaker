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
`);
  assert.ok(result.code.includes('"continue", "for-update")'));
  assert.ok(result.code.includes('"break", "loop-exit")'));
  assert.ok(Object.keys(result.eventSources).some(key => key.startsWith('continue:')));
  assert.ok(Object.keys(result.eventSources).some(key => key.startsWith('break:')));
});
