/**
 * 測試模組：editor-clipboard.test
 *
 * 驗證重點：editor clipboard.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('the editor header leaves clipboard actions to the editor and operating system', () => {
  const html = read('algorithm.html');
  assert.doesNotMatch(html, /id="(?:copyCodeBtn|pasteCodeBtn)"/);
  assert.match(html, /id="runBtn"/);
});

test('mobile mode delegates Ace long-press clipboard actions to the operating system', () => {
  const mobileSource = read('mobile-ui.js');
  const mobileCss = read('mobile-ui.css');
  assert.match(mobileSource, /setOption\('enableMobileMenu', !query\.matches\)/);
  assert.match(mobileSource, /createElement\('textarea'\)/);
  assert.match(mobileSource, /session\.replace\(/);
  assert.doesNotMatch(mobileSource, /editor\.session\.setValue\(input\.value\)/);
  assert.match(mobileCss, /#editor \.asm-mobile-code-input[\s\S]*-webkit-user-select: text/);
  assert.match(mobileCss, /-webkit-touch-callout: default/);
});
