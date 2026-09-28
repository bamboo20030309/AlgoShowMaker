/**
 * 測試模組：directive-assist.test
 *
 * 驗證重點：directive assist.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const publicFile = name => fs.readFileSync(path.join(__dirname, '../public', name), 'utf8');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('algorithm editor loads the layered directive assistant after Ace initialization', () => {
  const html = publicFile('algorithm.html');
  assert.match(html, /trace-directive-assist\.css\?v=directive-\d+/);
  assert.match(html, /trace-directive-assist\.js\?v=directive-\d+/);
  assert.ok(html.indexOf('front.js?v=') < html.indexOf('trace-directive-assist.js?v='));
});

test('old AV draw right-click code shortcuts are removed', () => {
  const gui = publicFile('gui_editor.js');
  assert.doesNotMatch(gui, /新增一幀|新增物件|新增箭頭|av\.start_frame_draw\(\)/);
  assert.doesNotMatch(gui, /codeEditorContainer\.addEventListener\('contextmenu'/);
});

test('directive assistant supplies keyboard navigation, examples, and native context-menu fallback', () => {
  const source = publicFile('trace-directive-assist.js');
  for (const directive of ['frame', 'preset', 'endpreset', 'object', 'let', 'keep', 'layout', 'branch', 'endbranch',
    'style', 'text', 'segment', 'place', 'camera', 'events', 'arrow', 'exit', 'code', 'endcode']) {
    assert.match(source, new RegExp(`id: '${directive}'`));
  }
  assert.match(source, /event\.code === 'Space'/);
  assert.match(source, /event\.key === 'Tab'/);
  assert.match(source, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /scrollIntoView\(\{ block: 'nearest' \}\)/);
  assert.match(source, /id === 'frame' && rule\[3\]\?\.startsWith\('\\n'\)/);
  assert.match(source, /\['最小', '常用', '完整'\]/);
  assert.match(source, /event\.button !== 2 \|\| window\.matchMedia/);
  assert.match(source, /if \(!byId\[id\]\) return;/);
  assert.doesNotMatch(source, /av\.start_frame_draw\(\)|av\.frame_draw\(/);
  assert.match(source, /with split\(now\)/);
  assert.match(source, /label: '@let'.*code: '\/\/ @let lb = i & -i'/);
  assert.match(source, /flow-arrows on/);
  assert.match(source, /branch-previews off/);
  assert.doesNotMatch(source, /@Let\b/);
});
