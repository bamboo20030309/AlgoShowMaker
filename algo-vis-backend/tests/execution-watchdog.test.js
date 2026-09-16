const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

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
