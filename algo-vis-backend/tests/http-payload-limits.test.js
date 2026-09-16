const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(backendRoot, file), 'utf8');

test('Nginx and Express accept the same 8 MB request size', () => {
  const server = read('server.js');
  const nginx = read('nginx.conf');

  assert.match(server, /HTTP_JSON_SIZE:\s*'8mb'/);
  assert.match(server, /express\.json\(\{\s*limit:\s*LIMITS\.HTTP_JSON_SIZE\s*\}\)/);
  assert.match(server, /entity\.too\.large[\s\S]*?status\(413\)[\s\S]*?8 MB/);
  assert.match(nginx, /client_max_body_size\s+8m\s*;/);
});

test('slide editor reports an actionable 8 MB save error', () => {
  const slides = read(path.join('public', 'slides.js'));
  assert.match(slides, /response\.status === 413/);
  assert.match(slides, /投影片資料超過 8 MB/);
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
