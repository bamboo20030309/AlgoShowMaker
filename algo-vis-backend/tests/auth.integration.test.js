'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');
const { JWT_SIGN_OPTIONS } = require('../jwt-config');

const baseUrl = process.env.ASM_TEST_BASE_URL;
const configuredSecret = process.env.JWT_SECRET;

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
