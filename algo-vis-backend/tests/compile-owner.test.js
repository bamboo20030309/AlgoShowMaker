const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  COOKIE_NAME,
  resolveCompileOwner,
  signSession,
  verifySignedSession,
} = require('../compile-owner');

function responseStub() {
  const headers = new Map();
  return {
    getHeader(name) { return headers.get(name); },
    setHeader(name, value) { headers.set(name, value); },
    headers,
  };
}

const secret = 'test-secret-with-enough-entropy';

test('authenticated compile owner uses the verified account id', () => {
  const req = { headers: { authorization: 'Bearer valid' }, secure: false };
  const res = responseStub();
  const owner = resolveCompileOwner(req, res, {
    secret,
    verifyBearer: token => token === 'valid' ? { id: 'user-7' } : null,
  });
  assert.equal(owner, 'user:user-7');
  assert.equal(res.getHeader('Set-Cookie'), undefined);
});

test('anonymous browsers receive distinct signed queue sessions behind one IP', () => {
  const firstRes = responseStub();
  const secondRes = responseStub();
  const first = resolveCompileOwner({ headers: {}, secure: false }, firstRes, { secret });
  const second = resolveCompileOwner({ headers: {}, secure: false }, secondRes, { secret });
  assert.notEqual(first, second);
  assert.match(firstRes.getHeader('Set-Cookie')[0], new RegExp(`^${COOKIE_NAME}=`));
  assert.match(firstRes.getHeader('Set-Cookie')[0], /HttpOnly; SameSite=Lax/);
});

test('a browser-provided UUID is stable across the first parallel request burst', () => {
  const browserId = '550e8400-e29b-41d4-a716-446655440000';
  const owners = [responseStub(), responseStub()].map(res => resolveCompileOwner({
    headers: { 'x-asm-session': browserId },
    secure: false,
  }, res, { secret }));
  assert.deepEqual(owners, [`browser:${browserId}`, `browser:${browserId}`]);
});

test('a valid signed session remains the same owner and tampering is rejected', () => {
  const sessionId = '550e8400-e29b-41d4-a716-446655440000';
  const signed = `${sessionId}.${signSession(sessionId, secret)}`;
  const res = responseStub();
  const owner = resolveCompileOwner({
    headers: { cookie: `${COOKIE_NAME}=${encodeURIComponent(signed)}` },
    secure: true,
  }, res, { secret });
  assert.equal(owner, `session:${sessionId}`);
  assert.equal(res.getHeader('Set-Cookie'), undefined);
  assert.equal(verifySignedSession(`${signed}x`, secret), '');
});
