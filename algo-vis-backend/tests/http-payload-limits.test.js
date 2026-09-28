/**
 * 測試模組：http-payload-limits.test
 *
 * 驗證重點：http payload limits.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(backendRoot, file), 'utf8');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('Nginx and Express accept the same 8 MB request size', () => {
  const server = read('server.js');
  const nginx = read('nginx.conf');

  assert.match(server, /HTTP_JSON_SIZE:\s*'8mb'/);
  assert.match(server, /express\.json\(\{\s*limit:\s*LIMITS\.HTTP_JSON_SIZE\s*\}\)/);
  assert.match(server, /entity\.too\.large[\s\S]*?status\(413\)[\s\S]*?8 MB/);
  assert.match(nginx, /client_max_body_size\s+8m\s*;/);
});

test('slide editor uses chunked cloud saves and preserves actionable server errors', () => {
  const slides = read(path.join('public', 'slides.js'));
  const cloud = read(path.join('public', 'slides-cloud.js'));
  assert.match(slides, /ASMSlideCloud\.save\(snapshot/);
  assert.match(cloud, /256 \* 1024/);
  assert.match(cloud, /new Error\(data\.error \|\|/);
  assert.doesNotMatch(slides, /投影片資料超過 8 MB/);
  assert.match(slides, /setCloudStatus\('error', err\?\.message \|\| '儲存失敗'\)/);
});

test('new slide exports use a detached compressed asmdeck projection', () => {
  const slides = read(path.join('public', 'slides.js'));
  const exportDeck = slides.match(/function exportDeckJson\(\)[\s\S]*?function importDeckJsonText/)?.[0] || '';
  assert.match(exportDeck, /ASMDeck\.project\(deck, draft\)/);
  assert.match(exportDeck, /ASMDeck\.encode\(projected\)/);
  assert.match(exportDeck, /\.asmdeck/);
  assert.doesNotMatch(exportDeck, /JSON\.stringify\(payload/);
});
