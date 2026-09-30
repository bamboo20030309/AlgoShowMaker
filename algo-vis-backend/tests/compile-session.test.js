const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('browser compile session stays stable and supplies scheduling headers', () => {
  const values = new Map();
  const window = {
    crypto: { randomUUID: () => '550e8400-e29b-41d4-a716-446655440000' },
    localStorage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/compile-session.js'), 'utf8');
  vm.runInNewContext(source, { window, globalThis: window });

  assert.equal(window.ASMCompileSession.id(), '550e8400-e29b-41d4-a716-446655440000');
  assert.deepEqual(
    { ...window.ASMCompileSession.headers('manual') },
    {
      'X-ASM-Session': '550e8400-e29b-41d4-a716-446655440000',
      'X-Compile-Purpose': 'manual',
    },
  );
  assert.equal(window.ASMCompileSession.id(), window.ASMCompileSession.id());
});
