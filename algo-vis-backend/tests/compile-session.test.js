const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('browser scheduling headers rely on the server-signed cookie identity', () => {
  const window = {};
  const source = fs.readFileSync(path.join(__dirname, '../public/compile-session.js'), 'utf8');
  vm.runInNewContext(source, { window, globalThis: window });

  assert.deepEqual(
    { ...window.ASMCompileSession.headers('manual') },
    { 'X-Compile-Purpose': 'manual' },
  );
  assert.deepEqual({ ...window.ASMCompileSession.headers() }, {});
});
