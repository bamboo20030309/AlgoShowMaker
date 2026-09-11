'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const {
  JWT_SIGN_OPTIONS,
  JWT_VERIFY_OPTIONS,
  loadJwtSecret
} = require('../jwt-config');

test('JWT_SECRET 缺少或只有空白時拒絕啟動', () => {
  assert.throws(() => loadJwtSecret({}), /缺少 JWT_SECRET/);
  assert.throws(() => loadJwtSecret({ JWT_SECRET: '   ' }), /缺少 JWT_SECRET/);
});

test('server 在 JWT_SECRET 無效時以非零狀態停止啟動', () => {
  const env = { ...process.env };
  delete env.JWT_SECRET;
  const serverPath = path.resolve(__dirname, '..', 'server.js');
  const result = spawnSync(process.execPath, [serverPath], {
    // 避開開發者本機的 .env，模擬乾淨部署環境。
    cwd: os.tmpdir(),
    env,
    encoding: 'utf8',
    timeout: 5000,
    windowsHide: true
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;

  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(output, /缺少 JWT_SECRET/);
  assert.doesNotMatch(output, /MongoDB 連線成功/);
});

test('JWT_SECRET 拒絕舊有公開預設值', () => {
  assert.throws(
    () => loadJwtSecret({ JWT_SECRET: 'dev-secret-key' }),
    /不可使用公開的範例或預設值/
  );
});

test('JWT_SECRET 保留部署端設定的密鑰內容', () => {
  const secret = 'a-unique-random-secret-with-32-bytes-minimum';
  assert.equal(loadJwtSecret({ JWT_SECRET: secret }), secret);
});

test('JWT 驗證只接受共用設定指定的 HS256', () => {
  const secret = 'another-unique-random-secret-with-32-bytes';
  const payload = { id: 'test-user', username: 'test@example.invalid' };
  const validToken = jwt.sign(payload, secret, JWT_SIGN_OPTIONS);
  const invalidAlgorithmToken = jwt.sign(payload, secret, { algorithm: 'HS384' });

  assert.equal(jwt.verify(validToken, secret, JWT_VERIFY_OPTIONS).id, payload.id);
  assert.throws(
    () => jwt.verify(invalidAlgorithmToken, secret, JWT_VERIFY_OPTIONS),
    /invalid algorithm/
  );
});
