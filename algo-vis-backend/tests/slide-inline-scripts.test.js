/**
 * 測試模組：slide-inline-scripts.test
 *
 * 驗證重點：slide inline scripts.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { format } = require('../public/slide-inline-scripts');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('simple superscripts and subscripts preserve source while styling only target characters', () => {
  const source = 'A_2 A^2 x_i^2';
  const styles = format(source, {}, 20);
  assert.equal(styles[0][1].fill, 'rgba(0, 0, 0, 0)');
  assert.equal(styles[0][2].fontSize, 12);
  assert.equal(styles[0][2].deltaY, 2.2);
  assert.equal(styles[0][5].fill, 'rgba(0, 0, 0, 0)');
  assert.equal(styles[0][6].deltaY, -7);
  assert.equal(styles[0][10].deltaY, 2.2);
  assert.equal(styles[0][12].deltaY, -7);
  assert.equal(source, 'A_2 A^2 x_i^2');
});

test('braces group scripts and escapes keep ordinary symbols', () => {
  const styles = format(String.raw`x_{i+1} A^{n+1} file\_name`, { 0: { 3: { fill: '#123456' } } }, 30);
  assert.equal(styles[0][3].fill, '#123456');
  for (const index of [3, 4, 5]) assert.equal(styles[0][index].deltaY, 3.3);
  for (const index of [11, 12, 13]) assert.equal(styles[0][index].deltaY, -10.5);
  assert.equal(styles[0][20].fill, 'rgba(0, 0, 0, 0)');
  assert.equal(styles[0][21], undefined);
});
