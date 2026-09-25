/**
 * 測試模組：arrow-identity.test
 *
 * 驗證重點：arrow identity.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findArrowDirectives, findFrameDirectives } = require('../trace-instrumenter');
const { pair } = require('../public/trace-arrow-model');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
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
