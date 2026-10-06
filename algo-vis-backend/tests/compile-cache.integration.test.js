'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

const baseUrl = process.env.ASM_TEST_BASE_URL;
const compileSource = (salt) => `
#include <iostream>
using namespace std;
int main() {
  int n = 0;
  cin >> n;
  // @frame n
  cout << n << "\\n";
  return 0;
}
// ${salt}
`;

function createClient() {
  let cookie = '';
  return async (url, init = {}) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(init.headers || {}),
      },
    });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';', 1)[0];
    return response;
  };
}

async function compile(client, code, input) {
  const response = await client(`${baseUrl}/compile`, {
    method: 'POST',
    headers: { 'X-Compile-Cache': 'shared' },
    body: JSON.stringify({ code, input, trace: { enabled: true, watches: [] } }),
  });
  const body = await response.json();
  assert.equal(response.status, 200, body.error || JSON.stringify(body));
  return { response, body };
}

test('shared trace cache skips identical work and executable cache accepts another input', {
  skip: !baseUrl,
  timeout: 30_000,
}, async () => {
  const client = createClient();
  const code = compileSource(randomUUID());
  const first = await compile(client, code, '7\n');
  assert.equal(first.body.output.trim(), '7');
  assert.ok(first.body.traceDocument?.frames?.length > 0);

  const exact = await compile(client, code, '7\n');
  assert.equal(exact.response.headers.get('x-compile-trace-cache'), 'HIT');
  assert.equal(exact.body.output.trim(), '7');

  const anotherInput = await compile(client, code, '11\n');
  assert.equal(anotherInput.response.headers.get('x-compile-trace-cache'), 'MISS');
  assert.equal(anotherInput.response.headers.get('x-compile-executable-cache'), 'HIT');
  assert.equal(anotherInput.body.output.trim(), '11');
});

test('async jobs expose owner-scoped status and downloadable results', {
  skip: !baseUrl,
  timeout: 30_000,
}, async () => {
  const client = createClient();
  const requestBody = {
    code: compileSource(randomUUID()),
    input: '23\n',
    trace: { enabled: true, watches: [] },
  };
  const submit = async () => {
    const response = await client(`${baseUrl}/api/compile/jobs`, {
      method: 'POST', body: JSON.stringify(requestBody),
    });
    const accepted = await response.json();
    assert.equal(response.status, 202, JSON.stringify(accepted));
    return accepted;
  };
  const accepted = await submit();
  assert.match(accepted.jobId, /^[0-9a-f-]{36}$/i);

  const forbidden = await createClient()(`${baseUrl}${accepted.statusUrl}`);
  assert.equal(forbidden.status, 403);

  let status;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const poll = await client(`${baseUrl}${accepted.statusUrl}`);
    status = await poll.json();
    assert.equal(poll.status, 200, JSON.stringify(status));
    if (status.state === 'completed') break;
    if (status.state === 'failed' || status.state === 'cancelled') {
      assert.fail(JSON.stringify(status));
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(status?.state, 'completed');

  const resultResponse = await client(`${baseUrl}${accepted.resultUrl}`);
  const result = await resultResponse.json();
  assert.equal(resultResponse.status, 200, JSON.stringify(result));
  assert.equal(result.output.trim(), '23');
  assert.ok(result.traceDocument?.frames?.length > 0);

  // A later identical submission is no longer an in-flight dedupe. Its cached
  // response may contain different timing headers, but must still complete and
  // use a content-derived result artifact without key collisions.
  const repeated = await submit();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const poll = await client(`${baseUrl}${repeated.statusUrl}`);
    const repeatedStatus = await poll.json();
    if (repeatedStatus.state === 'completed') break;
    if (repeatedStatus.state === 'failed') assert.fail(JSON.stringify(repeatedStatus));
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const repeatedResultResponse = await client(`${baseUrl}${repeated.resultUrl}`);
  const repeatedResult = await repeatedResultResponse.json();
  assert.equal(repeatedResultResponse.status, 200, JSON.stringify(repeatedResult));
  assert.equal(repeatedResult.output.trim(), '23');
});
