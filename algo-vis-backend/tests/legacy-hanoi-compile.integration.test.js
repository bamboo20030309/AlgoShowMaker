const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const baseUrl = process.env.ASM_TEST_BASE_URL || 'http://localhost:3000';
const sourcePath = path.join(__dirname, '../algorithm_sample/Backtracking/hanoi.cpp');

async function post(endpoint, body) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  assert.equal(response.ok, true, JSON.stringify(result));
  return result;
}

test('legacy Hanoi stays on the AV animation compiler when trace is requested', async () => {
  const code = fs.readFileSync(sourcePath, 'utf8');
  const analysis = await post('/trace/analyze', { code });
  const watches = [...new Set((analysis.frameDirectives || [])
    .flatMap(frame => frame.variableIds || []))];

  const result = await post('/compile', {
    code,
    input: '4\n',
    trace: { enabled: true, watches, sliceMode: 'manual' }
  });

  assert.equal(result.error, '');
  assert.equal(result.traceDocument, null);
  assert.ok(result.debug_log.some(entry => /舊版動畫編譯器/.test(entry.msg)));
  assert.match(result.scriptContent, /CodeScript/);
  assert.equal((result.output.match(/^[ABC] -> [ABC]$/gm) || []).length, 15);
});
