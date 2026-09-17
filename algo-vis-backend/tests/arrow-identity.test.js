const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findArrowDirectives, findFrameDirectives } = require('../trace-instrumenter');
const { pair } = require('../public/trace-arrow-model');

test('arrow source identity survives line shifts and keeps explicit IDs separate', () => {
  const code = 'int main(){int arr[3]; // @frame arr\n// @arrow from arr[0] to arr[1]\n// @arrow from arr[1] to arr[2] as "link"\n}';
  const before = findArrowDirectives(code), after = findArrowDirectives('\n\n' + code);
  assert.deepEqual(after.map(a => a.id), before.map(a => a.id));
  assert.equal(before[0].displayName, 'arrow_1');
  assert.equal(before[0].explicitId, false);
  assert.equal(before[1].explicitId, true);
  assert.throws(() => findFrameDirectives(code.replace('as "link"', `as "${before[0].id}"`)), /ID 重複/);
});

test('preset arrow identity is independent of earlier presets in use list', () => {
  const definitions = '// @preset first\n// @arrow from arr[0] to arr[1]\n// @endpreset\n'
    + '// @preset second\n// @object arr\n// @arrow from arr[1] to arr[2]\n// @endpreset\n';
  const single = findFrameDirectives(definitions + 'int main(){int arr[3];\n// @frame use second\n}')[0];
  const multiple = findFrameDirectives(definitions + 'int main(){int arr[3];\n// @frame use first,second\n}')[0];
  assert.equal(single.arrows[0].id, multiple.arrows[1].id);
});

test('arrow pairing is conservative, scope-aware and explicit-role controlled', () => {
  const arrow = (id, extra = {}) => ({ id, source: 'directive', explicitId: false,
    scope: 'call-1', fromObject: 'arr', toObject: 'arr', line: 'straight', headEnd: 'arrow', ...extra });
  const old = arrow('one'), next = arrow('two');
  assert.equal(pair([old], [next]).get(next), old);
  assert.equal(pair([old, arrow('three')], [next]).size, 0);
  assert.equal(pair([old], [next, arrow('four')]).size, 0);
  assert.equal(pair([old], [arrow('one', { scope: 'call-2' })]).size, 0);
  const explicit = arrow('link', { explicitId: true });
  const rebound = arrow('link', { explicitId: true, scope: 'call-2', toObject: 'other' });
  assert.equal(pair([explicit], [rebound]).get(rebound), explicit);
  assert.equal(pair([explicit], [arrow('different', { explicitId: true })]).size, 0);
  const survivor = arrow('survivor');
  assert.equal(pair([old, survivor], [survivor]).get(survivor), survivor);
});
