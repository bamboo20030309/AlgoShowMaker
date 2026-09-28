/**
 * 測試模組：auth.integration.test
 *
 * 驗證重點：auth.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const { JWT_SIGN_OPTIONS } = require('../jwt-config');

const baseUrl = process.env.ASM_TEST_BASE_URL;
const configuredSecret = process.env.JWT_SECRET;

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('受保護 API 拒絕匿名、舊預設密鑰與非 HS256 token', {
  skip: !baseUrl || !configuredSecret
}, async () => {
  const payload = { id: 'jwt-regression-user', username: 'jwt@example.invalid' };
  const publicFallbackToken = jwt.sign(payload, 'dev-secret-key', JWT_SIGN_OPTIONS);
  const wrongAlgorithmToken = jwt.sign(payload, configuredSecret, { algorithm: 'HS384' });

  const anonymousResponse = await fetch(`${baseUrl}/api/auth/me`);
  const fallbackResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${publicFallbackToken}` }
  });
  const algorithmResponse = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${wrongAlgorithmToken}` }
  });

  assert.equal(anonymousResponse.status, 401);
  assert.equal(fallbackResponse.status, 403);
  assert.equal(algorithmResponse.status, 403);
});

test('受保護 API 接受目前設定的 HS256 token', {
  skip: !baseUrl || !configuredSecret
}, async () => {
  const payload = { id: 'jwt-regression-user', username: 'jwt@example.invalid' };
  const token = jwt.sign(payload, configuredSecret, JWT_SIGN_OPTIONS);
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.message, '驗證成功');
  assert.equal(body.user.id, payload.id);
  assert.equal(body.user.username, payload.username);
  assert.equal(typeof body.user.iat, 'number');
  assert.equal(typeof body.user.exp, 'number');
});
