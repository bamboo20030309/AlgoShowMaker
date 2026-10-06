const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { findLayoutDirectives, instrumentSource } = require('../trace-instrumenter');
const context = vm.createContext({ window: {}, document: { documentElement: { dataset: {} } }, queueMicrotask() {} });
vm.runInContext(fs.readFileSync('public/trace-renderer.js', 'utf8'), context);
const coordinates = context.window.ASMTraceRenderers.recursionLayoutCoordinates;

test('growth/reserve defaults, explicit off, reset and global layout place survive serialized reload', () => {
  const base = '// @layout recursion as tree\n';
  const [legacy] = findLayoutDirectives(base);
  assert.equal(legacy.growFrom, 'root');
  assert.equal(legacy.reserve, false);
  const [custom] = findLayoutDirectives(base + '// @layout tree grow-from leaves\n// @layout tree reserve on\n// @place tree.top-left at canvas.bottom-left offset(4,40)\n');
  const reopened = JSON.parse(JSON.stringify(custom));
  assert.equal(reopened.growFrom, 'leaves');
  assert.equal(reopened.reserve, true);
  assert.equal(reopened.placeBinding.sourceAnchor, 'top-left');
  assert.equal(reopened.placeBinding.offsetY, 40);
  assert.equal(findLayoutDirectives(base + '// @layout tree reserve off\n')[0].reserve, false);
  const [reset] = findLayoutDirectives(base + '// @layout tree grow-from leaves\n// @layout tree reserve on\n// @layout tree reset\n');
  assert.equal(reset.growFrom, 'root');
  assert.equal(reset.reserve, false);
  assert.throws(() => findLayoutDirectives(base + '// @layout tree grow-from middle\n'), /root 或 leaves/);
  assert.throws(() => findLayoutDirectives(base + '// @layout tree reserve maybe\n'), /on 或 off/);
  assert.throws(() => findLayoutDirectives(base + '// @layout recursion as other\n// @place tree.top at other.bottom\n// @place other.top at tree.bottom\n'), /不可形成循環/);
  instrumentSource(base + '// @place tree.top-left at canvas.top-left\nint main(){ int a=1;\n// @frame a in tree\n}\n');
});

test('leaf growth keeps short subtrees at the leaf edge and every actual edge at the configured gap', () => {
  const nodes = [
    { id: 'p', box: { width: 80, height: 55 } },
    { id: 'q', parentId: 'p', box: { width: 50, height: 40 } },
    { id: 'leaf', parentId: 'q', box: { width: 30, height: 35 } },
    { id: 'short', box: { width: 20, height: 25 }, rootIndex: 1 }
  ];
  for (const direction of ['bottom-up', 'top-down', 'left-right', 'right-left']) {
    const layout = { growFrom: 'leaves', direction, levelGap: 60, siblingGap: 40 };
    const result = coordinates(layout, nodes);
    const vertical = ['bottom-up', 'top-down'].includes(direction);
    const start = b => vertical ? b.y : b.x;
    const size = b => vertical ? b.height : b.width;
    for (const [p, c] of [['p', 'q'], ['q', 'leaf']]) {
      const parent = result.get(p), child = result.get(c);
      const gap = ['bottom-up', 'right-left'].includes(direction)
        ? start(parent) - start(child) - size(child)
        : start(child) - start(parent) - size(parent);
      assert.equal(gap, 60, `${direction} ${p}/${c}`);
    }
    const before = coordinates(layout, [nodes[2], nodes[3]]);
    assert.equal(start(result.get('short')), start(before.get('short')), 'unrelated shallow root stays at leaf edge');
    assert.equal(start(result.get('leaf')), start(before.get('leaf')), 'long branch retains leaf edge while parents appear');
  }
});

test('missing saved growth fields retain exact old root geometry', () => {
  const nodes = [{ id: 'root', box: { width: 100, height: 40 } },
    { id: 'child', parentId: 'root', box: { width: 40, height: 40 } }];
  for (const direction of ['bottom-up', 'top-down', 'left-right', 'right-left']) {
    const legacy = { direction, levelGap: 60 };
    assert.equal(JSON.stringify([...coordinates(legacy, nodes)]),
      JSON.stringify([...coordinates({ ...legacy, growFrom: 'root', reserve: false }, nodes)]));
  }
});
