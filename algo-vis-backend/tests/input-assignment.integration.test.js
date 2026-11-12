'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict');
const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');

test('input writes preserve successful targets, order, indices, partial scanf and EOF', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  process.env.ASM_TEST_BASE_URL = base;
  t.after(() => { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; });
  const cases = [
    ['cin', 'int a=1,b=2,i=0;vector<int>arr(2);\n// @frame a,b,arr,i\ncin>>a>>arr[i++]>>b;\n// @frame a,b,arr,i\n', '7 8 9', [7,8,9]],
    ['scanf', 'int a=1,b=2;\n// @frame a,b\nint count=scanf("%d %d",&a,&b);\n// @frame a,b\n', '7 bad', [7]],
    ['scanf-suppressed', 'int a=1,b=2;\n// @frame a,b\nscanf("%*d %d %d",&a,&b);\n// @frame a,b\n', '99 7 8', [7,8]],
    ['scanf-index', 'int i=0;vector<int>a(2);\n// @frame a,i\nscanf("%d",&a[i++]);\n// @frame a,i\n', '7', [7]],
    ['while-cin', 'int a;while(cin>>a){\n// @frame a\n}\n// @frame a\n', '7 8', [7,8]],
    ['getline', 'string s="old";\n// @frame s\ngetline(cin,s);\n// @frame s\n', 'hello world\n', ['hello world']],
    ['get-ref', 'char c=\'a\';\n// @frame c\ncin.get(c);\n// @frame c\n', 'Z', ['Z']],
    ['get-value', 'char c=\'a\';\n// @frame c\nc=cin.get();\n// @frame c\n', 'Z', ['Z']],
    ['get-init', 'char c=cin.get();\n// @frame c\n', 'Z', ['Z']],
    ['member-getline', 'char buf[8]={};\n// @frame buf\ncin.getline(buf,8);\n// @frame buf\n', 'hello\n', ['hello']],
    ['get-buffer', 'char buf[8]={};\n// @frame buf\ncin.get(buf,8);\n// @frame buf\n', 'hello\n', ['hello']],
    ['EOF', 'int a=4;\n// @frame a\ncin>>a;\n// @frame a\n', '', []]
  ];
  for (const [name, body, input, expected] of cases) {
    const { trace, window } = await compile('#include <bits/stdc++.h>\nusing namespace std;\nint main(){' + body + '}\n', input);
    const events = trace.frames.flatMap(frame => frame.events).filter(event => event.type === 'input-assign');
    assert.deepEqual(Array.from(events, event => event.payload.after.items
      ? Array.from(event.payload.after.items, item => item.value).join('').split('\0')[0] : event.payload.after.value), expected, name);
    assert.ok(events.every(event => event.source && event.targets[0].role === 'target'), name + ' source and target metadata');
    assert.equal(window.ASMTraceEvents.animation('input-assign'), 'assign');
    if (name === 'cin') {
      assert.equal(events[1].targets[0].resolvedIndex, 0, 'i++ is evaluated exactly once');
      const index = Object.keys(trace.variables).find(id => trace.variables[id].name === 'i');
      assert.equal(trace.frames.at(-1).state[index].data.value, 1);
    }
  }
});
