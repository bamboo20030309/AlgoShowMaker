/**
 * 測試模組：execution-watchdog.test
 *
 * 驗證重點：execution watchdog.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('Linux execution uses a same-UID hard timeout after the application TLE boundary', () => {
  assert.match(serverSource, /const hardTimeoutMs = LIMITS\.TIME_MS \+ 250/);
  assert.match(serverSource, /timeout --signal=TERM --kill-after=1s/);
  assert.match(serverSource, /spawn\('sh', \['-c', ulimitCmd\], runOptions\)/);
  assert.match(serverSource, /執行 watchdog 已啟動/);
});

test('failed TLE and OLE signals are recorded instead of silently ignored', () => {
  assert.match(serverSource, /TLE: SIGKILL 送出失敗[\s\S]*?code: error\.code/);
  assert.match(serverSource, /OLE: SIGKILL 送出失敗[\s\S]*?code: error\.code/);
  assert.match(serverSource, /\(isTLE \|\| isOLE\) && e\.code === 'EPERM'[\s\S]*?等待外部 watchdog/);
  assert.doesNotMatch(serverSource, /child\.kill\('SIGKILL'\);\s*}\s*catch \(e\) \{\s*}/);
});
